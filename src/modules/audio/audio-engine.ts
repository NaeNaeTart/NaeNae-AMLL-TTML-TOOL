import { convertFileSrc } from "@tauri-apps/api/core";
import {
	type AudioTaskType,
	audioBufferAtom,
	audioCoverArtAtom,
	audioErrorAtom,
	audioTaskStateAtom,
	auditionTimeAtom,
	EQ_FREQUENCIES,
	equalizerEnabledAtom,
	equalizerGainsAtom,
	loadedAudioAtom,
} from "$/modules/audio/states/index.ts";
import { bufferSliceToWav } from "$/modules/audio/utils/wav-slice";
import { AudioWorkerClient } from "$/modules/audio/workers/audio-worker-client";
import { globalStore } from "$/states/store.ts";
import { log } from "$/utils/logging";

// Magic, pending original dev's explanation
// Even don't know where should I put this after refactoring
// const DELAY = 0.05; // 50ms

let auditionRafId: number | null = null;

class AudioEngine extends EventTarget {
	public workerClient: AudioWorkerClient;

	//#region Audio context basics
	private _ctx: AudioContext | null = null;
	get ctx() {
		if (this._ctx) return this._ctx;
		this._ctx = new AudioContext({
			latencyHint: "interactive",
		});
		log(
			"AudioContext created with latency",
			this._ctx.baseLatency,
			this._ctx.outputLatency,
		);
		return this._ctx;
	}

	private _volume = 0.5;
	private gainNode: GainNode | null = null;
	private get gain() {
		if (this.gainNode) return this.gainNode;
		this.gainNode = this.ctx.createGain();
		this.gainNode.gain.value = this._volume;
		this.gainNode.connect(this.ctx.destination);
		return this.gainNode;
	}

	private _eqNodes: BiquadFilterNode[] = [];
	private get eqNodes() {
		if (this._eqNodes.length > 0) return this._eqNodes;

		const nodes: BiquadFilterNode[] = [];
		const gains = globalStore.get(equalizerGainsAtom);
		const enabled = globalStore.get(equalizerEnabledAtom);

		EQ_FREQUENCIES.forEach((freq, i) => {
			const node = this.ctx.createBiquadFilter();
			node.type =
				i === 0
					? "lowshelf"
					: i === EQ_FREQUENCIES.length - 1
						? "highshelf"
						: "peaking";
			node.frequency.value = freq;
			node.gain.value = enabled ? gains[i] : 0;
			node.Q.value = 1;
			nodes.push(node);
		});

		// Connect chain
		for (let i = 0; i < nodes.length - 1; i++) {
			nodes[i].connect(nodes[i + 1]);
		}

		// Final node connects to gain
		nodes[nodes.length - 1].connect(this.gain);

		this._eqNodes = nodes;
		return nodes;
	}

	public updateEqGains() {
		const gains = globalStore.get(equalizerGainsAtom);
		const enabled = globalStore.get(equalizerEnabledAtom);
		this.eqNodes.forEach((node, i) => {
			node.gain.setTargetAtTime(
				enabled ? gains[i] : 0,
				this.ctx.currentTime,
				0.05,
			);
		});
	}

	private _analyserNode: AnalyserNode | null = null;
	/** A read-only analysis tap for visualizers. It is connected in parallel and never changes playback output. */
	get analyserNode() {
		if (this._analyserNode) return this._analyserNode;
		const analyser = this.ctx.createAnalyser();
		analyser.fftSize = 512;
		analyser.smoothingTimeConstant = 0.78;
		this.eqNodes[this.eqNodes.length - 1].connect(analyser);
		this._analyserNode = analyser;
		return analyser;
	}

	public get eqEntryPoint() {
		return this.eqNodes[0];
	}
	//#endregion

	constructor() {
		super();
		this.workerClient = new AudioWorkerClient({
			onTaskStart: (type: AudioTaskType) => {
				globalStore.set(audioTaskStateAtom, { type, progress: 0 });
			},
			onTaskProgress: (progress: number) => {
				const current = globalStore.get(audioTaskStateAtom);
				if (current) {
					globalStore.set(audioTaskStateAtom, { ...current, progress });
				}
			},
			onTaskEnd: () => {
				globalStore.set(audioTaskStateAtom, null);
			},
			onError: (errorMessage: string) => {
				console.error("[AudioEngine] Worker Error:", errorMessage);
				globalStore.set(audioTaskStateAtom, null);
				globalStore.set(audioErrorAtom, errorMessage);
			},
		});
	}

	//#region Audio element
	// Since an element is required to sync with waveform.js,
	// all audio playback is done through this element
	private _audioEl: HTMLAudioElement | null = null;
	get audioEl() {
		if (this._audioEl) return this._audioEl;
		this._audioEl = document.createElement("audio");
		this._audioEl.crossOrigin = "anonymous";
		if (import.meta.env.TAURI_ENV_PLATFORM === "linux") {
			this._audioEl.volume = this._volume;
		}
		this._audioEl.preload = "metadata";
		return this._audioEl;
	}

	private _auditionBlobUrl: string | null = null;
	private _auditionAudioEl: HTMLAudioElement | null = null;
	private get auditionAudioEl() {
		if (this._auditionAudioEl) return this._auditionAudioEl;
		this._auditionAudioEl = document.createElement("audio");
		this._auditionAudioEl.crossOrigin = "anonymous";
		this._auditionAudioEl.preload = "auto";
		this._auditionAudioEl.volume = this._volume;
		return this._auditionAudioEl;
	}

	private _mediaSourceNode: MediaElementAudioSourceNode | null = null;

	private connectAudioToContext() {
		if (!this._audioEl || !this.ctx || this._audioEl.src === "") return;
		if (this._mediaSourceNode) return; // already connected!

		// Bypass on Linux due to WebKitGTK / GStreamer bugs with MediaElementAudioSourceNode
		// which causes audio to be silent and seeking to fail/jump back.
		if (import.meta.env.TAURI_ENV_PLATFORM === "linux") {
			console.warn(
				"[AudioEngine] Bypassing createMediaElementSource on Linux to prevent playback bugs.",
			);
			return;
		}
		try {
			this._mediaSourceNode = this.ctx.createMediaElementSource(this._audioEl);
			this._mediaSourceNode.connect(this.eqEntryPoint);
			log("AudioElement connected to AudioContext (via EQ)");
		} catch (e) {
			log("Failed to connect AudioElement:", e);
		}
	}

	/** Handle browser autoplay policy */
	private async resumeContext() {
		if (this.ctx.state !== "running") {
			await this.ctx.resume();
			log("AudioContext resumed");
		}
	}

	private _listenersSetup = false;

	/** Link audio element events into engine events */
	private setupAudioListeners() {
		if (this._listenersSetup) return;
		const audioEl = this._audioEl;
		if (!audioEl) return;

		this._listenersSetup = true;

		const events = {
			play: "music-resume",
			pause: "music-pause",
			timeupdate: "music-timeupdate",
			ended: "music-pause",
			seeked: "music-seeked",
			volumechange: "volume-change",
			ratechange: "music-playback-rate-change",
		};
		Object.entries(events).forEach(([event, engineEvent]) => {
			audioEl.addEventListener(event, () => {
				this.dispatchEvent(new Event(engineEvent));
			});
		});
	}
	//#endregion

	//#region Playback
	private auditionSourceNode: AudioBufferSourceNode | null = null;
	private reversePlaybackSourceNode: AudioBufferSourceNode | null = null;

	get musicLoaded() {
		return !!this.musicBuffer;
	}

	get musicPlaying() {
		if (!this._audioEl) return false;
		return !this._audioEl.paused && !this._audioEl.ended;
	}

	get musicCurrentTime() {
		return this._audioEl?.currentTime ?? 0;
	}

	private _lastReportedTime = 0;
	private _lastPerformanceTime = performance.now();

	get interpolatedCurrentTime() {
		if (!this._audioEl) return 0;
		if (!this.musicPlaying) return this._audioEl.currentTime;

		const currentTime = this._audioEl.currentTime;
		if (currentTime !== this._lastReportedTime) {
			this._lastReportedTime = currentTime;
			this._lastPerformanceTime = performance.now();
			return currentTime;
		}

		const dt = (performance.now() - this._lastPerformanceTime) / 1000;
		return currentTime + dt * this._musicPlayBackRate;
	}

	get musicDuration() {
		return this._audioEl?.duration ?? 0;
	}

	private _musicPlayBackRate = 1;
	get musicPlayBackRate() {
		return this._musicPlayBackRate;
	}
	set musicPlayBackRate(v: number) {
		if (this._audioEl) {
			this._audioEl.playbackRate = v;
		}
		if (this._auditionAudioEl) {
			this._auditionAudioEl.playbackRate = v;
		}
		this._musicPlayBackRate = v;
		this.dispatchEvent(new Event("music-playback-rate-change"));
	}

	get volume() {
		return this._volume;
	}
	set volume(v: number) {
		if (this._volume === v) return;
		this._volume = v;
		if (import.meta.env.TAURI_ENV_PLATFORM === "linux") {
			if (this._audioEl) this._audioEl.volume = v;
		} else {
			this.gain.gain.value = v;
		}
		if (this._auditionAudioEl) this._auditionAudioEl.volume = v;
		this.dispatchEvent(new Event("volume-change"));
	}

	get preservesPitch() {
		return this.audioEl.preservesPitch;
	}
	set preservesPitch(v: boolean) {
		this.audioEl.preservesPitch = v;
		if (this._auditionAudioEl) this._auditionAudioEl.preservesPitch = v;
		this.dispatchEvent(new Event("music-preserves-pitch-change"));
	}

	get ctxCurrentTime() {
		return this.ctx.currentTime;
	}
	get ctxBaseLatency() {
		return this.ctx.baseLatency;
	}
	get ctxOutputLatency() {
		return this.ctx.outputLatency;
	}

	seekMusic(offset: number) {
		if (this._audioEl) {
			this._audioEl.currentTime = offset;
			this._lastReportedTime = offset;
			this._lastPerformanceTime = performance.now();
			this.dispatchEvent(new Event("music-seeked"));
		}
	}

	async resumeOrSeekMusic(offset = this.musicCurrentTime) {
		if (!this._audioEl) return;
		await this.resumeContext();
		this._audioEl.currentTime = offset;
		this._lastReportedTime = offset;
		this._lastPerformanceTime = performance.now();
		this._audioEl.play();
		this.dispatchEvent(new Event("music-resume"));
	}

	stopAudition() {
		if (auditionRafId) {
			cancelAnimationFrame(auditionRafId);
			auditionRafId = null;
		}
		if (this._auditionAudioEl) {
			this._auditionAudioEl.pause();
			this._auditionAudioEl.currentTime = 0;
		}
		if (this._auditionBlobUrl) {
			URL.revokeObjectURL(this._auditionBlobUrl);
			this._auditionBlobUrl = null;
		}
		if (this.auditionSourceNode) {
			try {
				this.auditionSourceNode.stop(0);
				this.auditionSourceNode.disconnect();
			} catch {
				// ignore
			}
			this.auditionSourceNode = null;
		}
		globalStore.set(auditionTimeAtom, null);
	}

	pauseMusic() {
		if (!this._audioEl) return;
		this._audioEl.pause();
		this.stopAudition();
		this.dispatchEvent(new Event("music-pause"));
	}

	async auditionRange(startTimeInSeconds: number, endTimeInSeconds: number) {
		if (!this.musicBuffer) {
			console.warn("musicBuffer 为 null, 无法预览音频");
			return;
		}

		const totalDuration = this.musicBuffer.duration;
		const validStartTime = Math.max(
			0,
			Math.min(startTimeInSeconds, totalDuration),
		);
		const validEndTime = Math.max(
			validStartTime,
			Math.min(endTimeInSeconds, totalDuration),
		);
		const durationInSeconds = validEndTime - validStartTime;

		if (durationInSeconds <= 0) {
			return;
		}

		this.stopAudition();

		try {
			const wavBlob = bufferSliceToWav(
				this.musicBuffer,
				validStartTime,
				validEndTime,
			);
			const blobUrl = URL.createObjectURL(wavBlob);
			this._auditionBlobUrl = blobUrl;

			const auditionEl = this.auditionAudioEl;
			auditionEl.src = blobUrl;
			auditionEl.volume = this._volume;
			auditionEl.playbackRate = this._musicPlayBackRate;
			auditionEl.preservesPitch = this.preservesPitch;

			const startTimeWall = performance.now();
			const durationMS = (durationInSeconds / this._musicPlayBackRate) * 1000;

			const progressLoop = () => {
				const elapsedMS = performance.now() - startTimeWall;
				const progressRatio = Math.min(1, elapsedMS / durationMS);
				const currentAuditionTime =
					validStartTime + progressRatio * durationInSeconds;

				if (progressRatio >= 1 || auditionEl.paused || auditionEl.ended) {
					globalStore.set(auditionTimeAtom, null);
					auditionRafId = null;
					this.stopAudition();
				} else {
					globalStore.set(auditionTimeAtom, currentAuditionTime);
					auditionRafId = requestAnimationFrame(progressLoop);
				}
			};

			auditionEl.onended = () => {
				this.stopAudition();
			};

			await auditionEl.play();
			auditionRafId = requestAnimationFrame(progressLoop);
		} catch (e) {
			console.error("[AudioEngine] Audition failed:", e);
			this.stopAudition();
		}
	}

	/**
	 * Play a range of the loaded music reversed (sample-reversed), used by the reverse playback zone.
	 * Calls onComplete when playback finishes naturally; a manual stopReversePlayback() call does not.
	 */
	async playReversedRange(
		startTimeInSeconds: number,
		endTimeInSeconds: number,
		onComplete?: () => void,
	) {
		if (!this.musicBuffer) {
			console.warn("musicBuffer is null, cannot play reversed range");
			return;
		}

		const totalDuration = this.musicBuffer.duration;
		const validStartTime = Math.max(
			0,
			Math.min(startTimeInSeconds, totalDuration),
		);
		const validEndTime = Math.max(
			validStartTime,
			Math.min(endTimeInSeconds, totalDuration),
		);
		const durationInSeconds = validEndTime - validStartTime;
		if (durationInSeconds <= 0) return;

		this.stopReversePlayback();
		await this.resumeContext();

		const sampleRate = this.musicBuffer.sampleRate;
		const startSample = Math.floor(validStartTime * sampleRate);
		const frameCount = Math.floor(durationInSeconds * sampleRate);
		const channelCount = this.musicBuffer.numberOfChannels;

		const reversedBuffer = this.ctx.createBuffer(
			channelCount,
			frameCount,
			sampleRate,
		);
		for (let channel = 0; channel < channelCount; channel++) {
			const sourceData = this.musicBuffer.getChannelData(channel);
			const reversedData = reversedBuffer.getChannelData(channel);
			for (let i = 0; i < frameCount; i++) {
				reversedData[i] = sourceData[startSample + frameCount - 1 - i] ?? 0;
			}
		}

		const source = this.ctx.createBufferSource();
		source.buffer = reversedBuffer;
		source.playbackRate.value = this._musicPlayBackRate;
		source.connect(this.eqEntryPoint);
		source.onended = () => {
			if (this.reversePlaybackSourceNode === source) {
				this.reversePlaybackSourceNode = null;
			}
			source.disconnect();
			onComplete?.();
		};
		this.reversePlaybackSourceNode = source;
		source.start(0);
	}

	/** Stop any in-progress reversed playback started via playReversedRange(). Does not trigger its onComplete. */
	stopReversePlayback() {
		const source = this.reversePlaybackSourceNode;
		if (!source) return;
		this.reversePlaybackSourceNode = null;
		source.onended = null;
		try {
			source.stop(0);
			source.disconnect();
		} catch {
			// ignore
		}
	}

	//#endregion

	//#region Load sound
	private musicBuffer: AudioBuffer | null = null;
	private coverArtRequest = 0;

	private setEmbeddedCoverArt(coverUrl: string | null) {
		const previous = globalStore.get(audioCoverArtAtom);
		if (previous && previous !== coverUrl) URL.revokeObjectURL(previous);
		globalStore.set(audioCoverArtAtom, coverUrl);
	}

	/** Unload the currently loaded music, resetting playback state and buffers. No-op if nothing is loaded. */
	unloadMusic() {
		if (!this.musicBuffer) return;
		this.pauseMusic();
		this.stopAudition();
		this.musicBuffer = null;
		globalStore.set(audioBufferAtom, null);
		globalStore.set(loadedAudioAtom, new Blob([]));
		this.audioEl.src = "";
		this.dispatchEvent(new Event("music-unload"));
	}

	async loadMusic(src: Blob, isRetry = false): Promise<HTMLAudioElement> {
		const audioEl = this.audioEl;

		if (!isRetry) {
			const request = ++this.coverArtRequest;
			this.setEmbeddedCoverArt(null);
			void this.workerClient
				.readMetadata(src)
				.then((metadata) => {
					if (request !== this.coverArtRequest) {
						if (metadata.coverUrl) URL.revokeObjectURL(metadata.coverUrl);
						return;
					}
					this.setEmbeddedCoverArt(metadata.coverUrl ?? null);
				})
				.catch(() => {
					// Audio playback is still valid when a format has no readable tags.
				});
			this.unloadMusic();
			this.dispatchEvent(new Event("music-loading"));
		}

		return new Promise((resolve, reject) => {
			audioEl.onloadedmetadata = null;
			audioEl.onerror = null;

			const handleError = (errorMsg: string, errorCode?: number) => {
				console.warn(
					`[AudioEngine] Load error. Retry: ${isRetry}. Code: ${errorCode}. Msg: ${errorMsg}`,
				);

				const canRetry =
					!isRetry &&
					(errorCode === MediaError.MEDIA_ERR_DECODE ||
						errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED);

				if (canRetry) {
					this.performTranscodeFallback(src, resolve, reject);
				} else {
					this.dispatchEvent(new Event("music-load-error"));
					reject(new Error(`Audio load error: ${errorMsg}`));
				}
			};

			audioEl.onerror = (e: Event | string) => {
				const error = audioEl.error;
				const msg = error?.message || e.toString();
				handleError(msg, error?.code);
			};

			audioEl.onloadedmetadata = async () => {
				try {
					const audioData = await src.arrayBuffer();
					this.musicBuffer = await this.ctx.decodeAudioData(audioData);
					globalStore.set(audioBufferAtom, this.musicBuffer);
					globalStore.set(loadedAudioAtom, src);

					this.connectAudioToContext();
					this.setupAudioListeners();

					audioEl.onloadedmetadata = null;
					audioEl.onerror = null;

					audioEl.playbackRate = this._musicPlayBackRate;

					this.dispatchEvent(new Event("music-load"));
					resolve(audioEl);
				} catch (err) {
					console.warn("[AudioEngine] decodeAudioData failed:", err);

					if (!isRetry) {
						this.performTranscodeFallback(src, resolve, reject);
					} else {
						reject(err);
					}
				}
			};

			const filePath = (src as Blob & { path?: string }).path;
			if (filePath && import.meta.env.TAURI_ENV_PLATFORM) {
				audioEl.src = convertFileSrc(filePath);
			} else {
				audioEl.src = URL.createObjectURL(src);
			}
		});
	}

	private async performTranscodeFallback(
		src: Blob,
		resolve: (value: HTMLAudioElement | PromiseLike<HTMLAudioElement>) => void,
		reject: (reason?: Error) => void,
	) {
		console.log("[AudioEngine] Attempting transcoding fallback...");
		try {
			const wavBlob = await this.workerClient.transcodeToWav(src);

			const el = await this.loadMusic(wavBlob, true);
			resolve(el);
		} catch (error) {
			console.error("[AudioEngine] Transcoding fallback failed:", error);
			reject(error as Error);
		}
	}

	async playSound(
		audioBuffer: AudioBuffer,
		when?: number,
		offset?: number,
		duration?: number,
	) {
		if (!this.ctx) return;
		await this.resumeContext();
		const source = this.ctx.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(this.eqEntryPoint);
		source.start(when, offset, duration);
		source.addEventListener("ended", () => {
			source.disconnect();
		});
	}

	async playNode(node: AudioScheduledSourceNode, when?: number, stop?: number) {
		await this.resumeContext();
		node.connect(this.eqEntryPoint);
		node.start(when);
		node.addEventListener("ended", () => {
			node.disconnect();
		});
		if (stop) node.stop(stop);
	}
	//#endregion

	//#region Misc
	decodeAudioData(
		audioData: ArrayBuffer,
		successCallback?: DecodeSuccessCallback | null,
		errorCallback?: DecodeErrorCallback | null,
	): Promise<AudioBuffer> {
		return this.ctx.decodeAudioData(audioData, successCallback, errorCallback);
	}
	//#endregion
}

export const audioEngine = new AudioEngine();
