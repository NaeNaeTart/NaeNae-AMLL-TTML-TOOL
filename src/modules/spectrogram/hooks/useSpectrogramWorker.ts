import { useCallback, useEffect, useRef, useState } from "react";
import { LRUCache } from "$/modules/spectrogram/utils/lru-cache";
import type {
	SpectrogramWorker,
	TileGenerationParams,
	WorkerResponse,
} from "$/modules/spectrogram/workers/types";

const MAX_CACHED_TILES = 70;

export type TileEntry = {
	bitmap: ImageBitmap;
	width: number;
	height: number;
	gain: number;
	paletteId: string;
	fftSize?: number;
};

class SpectrogramWorkerClient {
	private worker: SpectrogramWorker;
	private reqIdCounter = 0;
	private audioGeneration = 0;
	private audioReady = Promise.resolve();
	private resolveAudioReady: (() => void) | null = null;
	private pendingRequests = new Map<
		number,
		{
			generation: number;
			resolve: (bmp: ImageBitmap) => void;
			reject: (err: Error) => void;
		}
	>();

	constructor() {
		this.worker = new Worker(
			new URL("../workers/spectrogram.worker.ts", import.meta.url),
			{ type: "module" },
		);
		this.worker.onmessage = this.handleMessage.bind(this);
	}

	private handleMessage(event: MessageEvent<WorkerResponse>) {
		const msg = event.data;
		if (msg.type === "INIT_COMPLETE") {
			if (msg.generation === this.audioGeneration) {
				this.resolveAudioReady?.();
				this.resolveAudioReady = null;
			}
		} else if (msg.type === "TILE_READY") {
			const request = this.pendingRequests.get(msg.reqId);
			if (request) {
				if (request.generation !== this.audioGeneration) {
					msg.imageBitmap.close();
					this.pendingRequests.delete(msg.reqId);
					return;
				}
				request.resolve(msg.imageBitmap);
				this.pendingRequests.delete(msg.reqId);
			} else {
				msg.imageBitmap.close();
			}
		} else if (msg.type === "ERROR") {
			const request = this.pendingRequests.get(msg.reqId);
			if (request) {
				console.warn(`Worker Error req ${msg.reqId}:`, msg.message);
				request.reject(new Error(msg.message));
				this.pendingRequests.delete(msg.reqId);
			}
		}
	}

	public getTile(params: TileGenerationParams): Promise<ImageBitmap> {
		const reqId = this.reqIdCounter++;
		const generation = this.audioGeneration;
		return new Promise((resolve, reject) => {
			void this.audioReady.then(() => {
				if (generation !== this.audioGeneration) {
					reject(new Error("Audio buffer changed"));
					return;
				}
				this.pendingRequests.set(reqId, { generation, resolve, reject });
				this.worker.postMessage({
					type: "GET_TILE",
					reqId,
					params,
				});
			});
		});
	}

	public initAudio(audioData: Float32Array, sampleRate: number) {
		this.resolveAudioReady?.();
		this.audioGeneration += 1;
		this.audioReady = new Promise((resolve) => {
			this.resolveAudioReady = resolve;
		});
		for (const [reqId, request] of this.pendingRequests.entries()) {
			request.reject(new Error("Audio buffer changed"));
			this.pendingRequests.delete(reqId);
		}
		this.worker.postMessage(
			{
				type: "INIT",
				audioData,
				sampleRate,
				generation: this.audioGeneration,
			},
			[audioData.buffer],
		);
	}

	public setPalette(palette: Uint8Array) {
		this.worker.postMessage({ type: "SET_PALETTE", palette });
	}

	public terminate() {
		this.worker.terminate();
		this.pendingRequests.clear();
	}
}

export const useSpectrogramWorker = (
	audioBuffer: AudioBuffer | null,
	paletteData: Uint8Array,
) => {
	const clientRef = useRef<SpectrogramWorkerClient | null>(null);
	const tileCache = useRef<LRUCache<string, TileEntry>>(
		new LRUCache(MAX_CACHED_TILES, (_key, entry) => {
			entry.bitmap.close();
		}),
	);
	const activeRequests = useRef<Set<string>>(new Set());
	const [lastTileTimestamp, setLastTileTimestamp] = useState(0);

	const paletteDataRef = useRef(paletteData);
	useEffect(() => {
		paletteDataRef.current = paletteData;
		if (clientRef.current) {
			clientRef.current.setPalette(paletteData);
		}
	}, [paletteData]);

	useEffect(() => {
		const client = new SpectrogramWorkerClient();
		clientRef.current = client;

		if (paletteDataRef.current) {
			client.setPalette(paletteDataRef.current);
		}

		return () => client.terminate();
	}, []);

	useEffect(() => {
		if (audioBuffer && clientRef.current) {
			tileCache.current.clear();
			activeRequests.current.clear();

			const channelData = audioBuffer.getChannelData(0);
			const channelDataCopy = channelData.slice();

			clientRef.current.initAudio(channelDataCopy, audioBuffer.sampleRate);

			if (paletteDataRef.current) {
				clientRef.current.setPalette(paletteDataRef.current);
			}

			setLastTileTimestamp(Date.now());
		}
	}, [audioBuffer]);

	const requestTileIfNeeded = useCallback(
		async (params: TileGenerationParams) => {
			if (!clientRef.current) return;

			const cacheKey = `tile-${params.tileIndex}`;
			const requestFingerprint = `${params.tileIndex}-w${params.tileWidthPx}-h${params.height}-g${params.gain}-p${params.paletteId}-f${params.fftSize || 1024}`;

			const cacheEntry = tileCache.current.get(cacheKey);

			const isStale =
				!cacheEntry ||
				cacheEntry.width < params.tileWidthPx ||
				cacheEntry.height !== params.height ||
				cacheEntry.gain !== params.gain ||
				cacheEntry.paletteId !== params.paletteId ||
				cacheEntry.fftSize !== params.fftSize;

			if (isStale && !activeRequests.current.has(requestFingerprint)) {
				activeRequests.current.add(requestFingerprint);

				try {
					const bitmap = await clientRef.current.getTile(params);

					tileCache.current.set(cacheKey, {
						bitmap,
						width: params.tileWidthPx,
						height: params.height,
						gain: params.gain,
						paletteId: params.paletteId,
						fftSize: params.fftSize,
					});

					setLastTileTimestamp(Date.now());
				} catch (err) {
					if (err instanceof Error && err.message === "Audio buffer changed") {
						return;
					}
					console.error("生成频谱图瓦片失败", err);
				} finally {
					activeRequests.current.delete(requestFingerprint);
				}
			}
		},
		[],
	);

	return { tileCache, requestTileIfNeeded, lastTileTimestamp };
};
