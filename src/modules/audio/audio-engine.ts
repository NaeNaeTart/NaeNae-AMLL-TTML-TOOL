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
import { AudioWorkerClient } from "$/modules/audio/workers/audio-worker-client";
import { globalStore } from "$/states/store.ts";
import { log } from "$/utils/logging";

let auditionRafId: number | null = null;

type ReversePlayback = {
	source: AudioBufferSourceNode | null;
	buffer: AudioBuffer;
	start: number;
	end: number;
	elapsed: number;
	startedAt: number;
	rate: number;
	paused: boolean;
	onEnded?: () => void;
};

class AudioEngine extends EventTarget {
	public workerClient: AudioWorkerClient;

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

		for (let i = 0; i < nodes.length - 1; i++) {
			nodes[i].connect(nodes[i + 1]);
		}

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

	private _mediaSourceNode: MediaElementAudioSourceNode | null = null;

	private connectAudioToContext() {
		if (!this._audioEl || !this.ctx || this._audioEl.src === "") return;
		if (this._mediaSourceNode) return;

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

	private async resumeContext() {
		if (this.ctx.state === "suspended") {
			await this.ctx.resume();
			log("AudioContext resumed");
		}
	}

	private _listenersSetup = false;

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
	private auditionSourceNode: AudioBufferSourceNode | null = null;
	private reversePlayback: ReversePlayback | null = null;

	get musicLoaded() {
		return !!this.musicBuffer;
	}

	get musicPlaying() {
		if (this.reversePlayback) return !this.reversePlayback.paused;
		if (!this._audioEl) return false;
		return !this._audioEl.paused && !this._audioEl.ended;
	}

	get musicCurrentTime() {
		if (this.reversePlayback) return this.getReversePlaybackTime();
		return this._audioEl?.currentTime ?? 0;
	}

	private _lastReportedTime = 0;
	private _lastPerformanceTime = performance.now();

	get interpolatedCurrentTime() {
		if (this.reversePlayback) return this.getReversePlaybackTime();
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
		this._musicPlayBackRate = v;
		if (this.reversePlayback) {
			this.updateReverseElapsed();
			this.reversePlayback.rate = v;
			this.reversePlayback.source?.playbackRate.setValueAtTime(
				v,
				this.ctx.currentTime,
			);
		}
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
		this.dispatchEvent(new Event("volume-change"));
	}

	get preservesPitch() {
		return this.audioEl.preservesPitch;
	}
	set preservesPitch(v: boolean) {
		this.audioEl.preservesPitch = v;
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
		if (this.reversePlayback) {
			this.seekReversePlayback(offset);
			return;
		}
		this.stopReversePlayback();
		if (this._audioEl) {
			this._audioEl.currentTime = offset;
			this._lastReportedTime = offset;
			this._lastPerformanceTime = performance.now();
			this.dispatchEvent(new Event("music-seeked"));
		}
	}

	async resumeOrSeekMusic(offset = this.musicCurrentTime) {
		if (this.reversePlayback?.paused) {
			this.seekReversePlayback(offset);
			await this.resumeReversePlayback();
			return;
		}
		this.stopReversePlayback();
		if (!this._audioEl) return;
		await this.resumeContext();
		this._audioEl.currentTime = offset;
		this._lastReportedTime = offset;
		this._lastPerformanceTime = performance.now();
		this._audioEl.play();
		this.dispatchEvent(new Event("music-resume"));
	}

	pauseMusic() {
		if (this.reversePlayback) {
			this.pauseReversePlayback();
			return;
		}
		if (!this._audioEl) return;
		this._audioEl.pause();
		this.dispatchEvent(new Event("music-pause"));
	}

	unloadMusic() {
		if (this.musicBuffer) {
			this.pauseMusic();
			this.musicBuffer = null;
			globalStore.set(audioBufferAtom, null);
			globalStore.set(loadedAudioAtom, new Blob([]));
			if (this._audioEl) this._audioEl.src = "";
			this.dispatchEvent(new Event("music-unload"));
		}
	}

	private getReversePlaybackTime() {
		const playback = this.reversePlayback;
		if (!playback) return 0;
		const elapsed =
			playback.elapsed +
			(playback.paused
				? 0
				: (this.ctx.currentTime - playback.startedAt) * playback.rate);
		return Math.min(playback.end, playback.start + elapsed);
	}

	private updateReverseElapsed() {
		const playback = this.reversePlayback;
		if (!playback || playback.paused) return;
		playback.elapsed +=
			(this.ctx.currentTime - playback.startedAt) * playback.rate;
		playback.startedAt = this.ctx.currentTime;
	}

	async playReversedRange(start: number, end: number, onEnded?: () => void) {
		if (!this.musicBuffer || end <= start) return;
		this.stopReversePlayback();
		this._audioEl?.pause();
		await this.resumeContext();

		const sourceBuffer = this.musicBuffer;
		const startFrame = Math.max(0, Math.floor(start * sourceBuffer.sampleRate));
		const endFrame = Math.min(
			sourceBuffer.length,
			Math.ceil(end * sourceBuffer.sampleRate),
		);
		const frameLength = endFrame - startFrame;
		if (frameLength <= 0) return;

		const reversedBuffer = this.ctx.createBuffer(
			sourceBuffer.numberOfChannels,
			frameLength,
			sourceBuffer.sampleRate,
		);
		for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel++) {
			const sourceData = sourceBuffer.getChannelData(channel);
			const targetData = reversedBuffer.getChannelData(channel);
			for (let index = 0; index < frameLength; index++) {
				targetData[index] = sourceData[endFrame - index - 1];
			}
		}

		const source = this.ctx.createBufferSource();
		source.buffer = reversedBuffer;
		source.playbackRate.value = this._musicPlayBackRate;
		source.connect(this.eqEntryPoint);
		const playback: ReversePlayback = {
			source,
			buffer: reversedBuffer,
			start,
			end,
			elapsed: 0,
			startedAt: this.ctx.currentTime,
			rate: this._musicPlayBackRate,
			paused: false,
			onEnded,
		};
		this.reversePlayback = playback;
		source.addEventListener("ended", () => {
			if (
				this.reversePlayback !== playback ||
				playback.paused ||
				playback.source !== source
			)
				return;
			this.reversePlayback = null;
			source.disconnect();
			this.dispatchEvent(new Event("music-pause"));
			onEnded?.();
		});
		source.start(playback.startedAt);
		this.dispatchEvent(new Event("music-resume"));
	}

	private pauseReversePlayback() {
		const playback = this.reversePlayback;
		if (!playback || playback.paused) return;
		this.updateReverseElapsed();
		playback.paused = true;
		const source = playback.source;
		playback.source = null;
		try {
			source?.stop();
			source?.disconnect();
		} catch {}
		this.dispatchEvent(new Event("music-pause"));
	}

	private seekReversePlayback(offset: number) {
		const playback = this.reversePlayback;
		if (!playback) return;
		this._audioEl?.pause();
		const position = Math.max(playback.start, Math.min(offset, playback.end));
		const wasPlaying = !playback.paused;

		if (wasPlaying) {
			this.updateReverseElapsed();
			playback.paused = true;
			const source = playback.source;
			playback.source = null;
			try {
				source?.stop();
				source?.disconnect();
			} catch {}
		}

		playback.elapsed = position - playback.start;
		playback.startedAt = this.ctx.currentTime;
		this.dispatchEvent(new Event("music-seeked"));
		if (wasPlaying) void this.resumeReversePlayback();
	}

	private async resumeReversePlayback() {
		const playback = this.reversePlayback;
		if (!playback || !playback.paused) return;
		this._audioEl?.pause();
		await this.resumeContext();
		const source = this.ctx.createBufferSource();
		source.buffer = playback.buffer;
		source.playbackRate.value = playback.rate;
		source.connect(this.eqEntryPoint);
		playback.source = source;
		playback.paused = false;
		playback.startedAt = this.ctx.currentTime;
		source.addEventListener("ended", () => {
			if (
				this.reversePlayback !== playback ||
				playback.paused ||
				playback.source !== source
			)
				return;
			this.reversePlayback = null;
			source.disconnect();
			this.dispatchEvent(new Event("music-pause"));
			playback.onEnded?.();
		});
		source.start(playback.startedAt, playback.elapsed);
		this.dispatchEvent(new Event("music-resume"));
	}

	stopReversePlayback() {
		const playback = this.reversePlayback;
		if (!playback) return;
		this.reversePlayback = null;
		try {
			playback.source?.stop();
			playback.source?.disconnect();
		} catch {}
		this.dispatchEvent(new Event("music-pause"));
	}

	auditionRange(startTimeInSeconds: number, endTimeInSeconds: number) {
		if (!this.musicBuffer) {
			console.warn("Cannot audition without a loaded audio buffer");
			return;
		}

		if (this.auditionSourceNode) {
			try {
				this.auditionSourceNode.stop(0);
				this.auditionSourceNode.disconnect();
			} catch (e) {
				console.error("Failed to stop AudioNode:", e);
			}
			this.auditionSourceNode = null;
		}

		if (auditionRafId) {
			cancelAnimationFrame(auditionRafId);
			auditionRafId = null;
		}

		globalStore.set(auditionTimeAtom, null);

		const durationInSeconds = endTimeInSeconds - startTimeInSeconds;

		if (durationInSeconds <= 0) {
			return;
		}

		this.resumeContext();

		const audioCtxStartTime = this.ctx.currentTime;
		const mediaStartTime = startTimeInSeconds;

		const source = this.ctx.createBufferSource();
		source.buffer = this.musicBuffer;
		source.connect(this.eqEntryPoint);
		this.auditionSourceNode = source;

		const progressLoop = () => {
			const elapsedTime = this.ctx.currentTime - audioCtxStartTime;
			const currentAuditionTime = mediaStartTime + elapsedTime;

			if (currentAuditionTime >= endTimeInSeconds) {
				globalStore.set(auditionTimeAtom, null);
				auditionRafId = null;
			} else {
				globalStore.set(auditionTimeAtom, currentAuditionTime);
				auditionRafId = requestAnimationFrame(progressLoop);
			}
		};

		source.addEventListener("ended", () => {
			if (this.auditionSourceNode === source) {
				if (auditionRafId) {
					cancelAnimationFrame(auditionRafId);
					auditionRafId = null;
				}
				globalStore.set(auditionTimeAtom, null);
				this.auditionSourceNode = null;
			}
			source.disconnect();
		});

		source.start(audioCtxStartTime, mediaStartTime, durationInSeconds);
		auditionRafId = requestAnimationFrame(progressLoop);
	}

	private musicBuffer: AudioBuffer | null = null;
	private coverArtRequest = 0;

	private setEmbeddedCoverArt(coverUrl: string | null) {
		const previous = globalStore.get(audioCoverArtAtom);
		if (previous && previous !== coverUrl) URL.revokeObjectURL(previous);
		globalStore.set(audioCoverArtAtom, coverUrl);
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
				.catch(() => {});
			if (this.musicBuffer) {
				this.pauseMusic();
				this.musicBuffer = null;
				globalStore.set(audioBufferAtom, null);
				globalStore.set(loadedAudioAtom, new Blob([]));
				audioEl.src = "";
				this.dispatchEvent(new Event("music-unload"));
			}
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

			if ((src as any).path && import.meta.env.TAURI_ENV_PLATFORM) {
				audioEl.src = convertFileSrc((src as any).path);
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

	playSound(
		audioBuffer: AudioBuffer,
		when?: number,
		offset?: number,
		duration?: number,
	) {
		if (!this.ctx) return;
		const source = this.ctx.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(this.eqEntryPoint);
		source.start(when, offset, duration);
		source.addEventListener("ended", () => {
			source.disconnect();
		});
	}

	playNode(node: AudioScheduledSourceNode, when?: number, stop?: number) {
		node.connect(this.eqEntryPoint);
		node.start(when);
		node.addEventListener("ended", () => {
			node.disconnect();
		});
		if (stop) node.stop(stop);
	}
	decodeAudioData(
		audioData: ArrayBuffer,
		successCallback?: DecodeSuccessCallback | null,
		errorCallback?: DecodeErrorCallback | null,
	): Promise<AudioBuffer> {
		return this.ctx.decodeAudioData(audioData, successCallback, errorCallback);
	}
}

export const audioEngine = new AudioEngine();
