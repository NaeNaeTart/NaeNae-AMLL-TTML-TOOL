import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { seekFrame } from "../utils/pcm-clock";
import { PcmVoice, type StretchProcessor } from "./pcm-voice";
import type { VoiceState } from "./protocol";
import {
	initSync,
	SoundTouchProcessor,
	StretchAlgorithm,
} from "./vendor/soundtouch";

let memory: WebAssembly.Memory;
beforeAll(() => {
	memory = initSync({
		module: readFileSync("src/modules/audio/worklet/vendor/soundtouch_bg.wasm"),
	}).memory;
});

function state(overrides: Partial<VoiceState> = {}): VoiceState {
	return {
		generation: 1,
		frame: 0,
		endFrame: 44100,
		playing: true,
		rate: 1,
		preservesPitch: true,
		...overrides,
	};
}
function realVoice(channels: Float32Array[], sampleRate = 44100) {
	return new PcmVoice(
		channels,
		sampleRate,
		memory,
		() =>
			new SoundTouchProcessor(
				channels.length,
				sampleRate,
				StretchAlgorithm.Wsola,
			),
	);
}

describe("decoded PCM playback", () => {
	it.each([
		44100, 48000,
	])("seeks to the requested frame regardless of the original format at %i Hz", (sampleRate) => {
		// Once decoded, format/header/bitrate never enters the playback API. Give each
		// representative format the same deterministic PCM and inspect the first sample.
		for (const format of [
			"CBR MP3",
			"LAME VBR MP3",
			"VBR MP3 without Xing",
			"FLAC",
			"Opus",
		]) {
			const pcm = Float32Array.from(
				{ length: sampleRate * 151 },
				(_, index) => index / (sampleRate * 151),
			);
			const voice = realVoice([pcm], sampleRate);
			let generation = 0;
			for (const seconds of [20, 90, 150, 20.12345]) {
				const frame = seekFrame(seconds, sampleRate, pcm.length);
				voice.setState(
					state({ generation: ++generation, frame, endFrame: pcm.length }),
				);
				const output = [new Float32Array(128)];
				const report = voice.render(output, 0);
				expect(report?.startFrame, format).toBe(frame);
				expect(output[0][0], format).toBe(pcm[frame]);
			}
			voice.destroy();
		}
	});
	it("retains fractional rate accounting and zeroes samples beyond audition EOF", () => {
		const voice = realVoice([new Float32Array(100).fill(1)]);
		voice.setState(
			state({ frame: 10, endFrame: 13, rate: 0.3, preservesPitch: false }),
		);
		const output = [new Float32Array(128)];
		const report = voice.render(output, 0);
		expect(report?.endFrame).toBe(13);
		expect(report?.renderedFrames).toBe(10);
		expect(report?.ended).toBe(true);
		expect([...output[0].subarray(0, 10)]).toEqual(new Array(10).fill(1));
		expect([...output[0].subarray(10)]).toEqual(new Array(118).fill(0));
		expect(voice.render(output, 1)).toBeNull();
		voice.destroy();
	});
	it("flushes DSP once for the latest generation when multiple seeks arrive between callbacks", () => {
		const clear = vi.fn();
		const processor: StretchProcessor = {
			clear,
			free: vi.fn(),
			setTempo: vi.fn(),
			setRate: vi.fn(),
			setPitch: vi.fn(),
			getInputChunkSize: () => 128,
			getInputPtr: () => 0,
			getOutputPtr: () => 0,
			processInput: vi.fn(),
			numSamples: () => 128,
			extractOutput: () => 128,
		};
		const voice = new PcmVoice(
			[new Float32Array(44100)],
			44100,
			memory,
			() => processor,
		);
		voice.setState(state({ rate: 0.5 }));
		const output = [new Float32Array(128)];
		expect(voice.render(output, 0)?.endFrame).toBe(64);
		voice.setState(state({ generation: 2, frame: 1234, rate: 0.5 }));
		voice.setState(state({ generation: 3, frame: 5678, rate: 0.5 }));
		voice.setState(state({ generation: 2, frame: 9, rate: 0.5 }));
		const report = voice.render(output, 1);
		expect(clear).toHaveBeenCalledTimes(1);
		expect(report?.startFrame).toBe(5678);
		expect(report?.endFrame).toBe(5742);
		expect(report?.generation).toBe(3);
		voice.destroy();
	});
	it("does not advance the source clock when DSP extracts no output", () => {
		const processor: StretchProcessor = {
			clear: vi.fn(),
			free: vi.fn(),
			setTempo: vi.fn(),
			setRate: vi.fn(),
			setPitch: vi.fn(),
			getInputChunkSize: () => 128,
			getInputPtr: () => 0,
			getOutputPtr: () => 0,
			processInput: vi.fn(),
			numSamples: () => 128,
			extractOutput: () => 0,
		};
		const voice = new PcmVoice(
			[new Float32Array(44100)],
			44100,
			memory,
			() => processor,
		);
		voice.setState(state({ frame: 42, rate: 0.75 }));
		const report = voice.render([new Float32Array(128)], 0);
		expect(report?.endFrame).toBe(42);
		expect(report?.renderedFrames).toBe(0);
		voice.destroy();
	});
	it.each([
		0.1, 0.5, 0.75, 1.25, 2,
	])("drains real SoundTouch at %sx and reaches the exact range endpoint", (rate) => {
		const pcm = Float32Array.from({ length: 44100 }, (_, index) =>
			Math.sin(index * 0.062),
		);
		const voice = realVoice([pcm, pcm]);
		const start = 10000;
		const end = 16000;
		voice.setState(state({ frame: start, endFrame: end, rate }));
		const output = [new Float32Array(128), new Float32Array(128)];
		let rendered = 0;
		let nonzero = false;
		let finalFrame = start;
		let ended = false;
		for (let block = 0; block < 1000 && !ended; block++) {
			const report = voice.render(output, (block * 128) / 44100);
			rendered += report?.renderedFrames ?? 0;
			finalFrame = report?.endFrame ?? finalFrame;
			ended = report?.ended ?? false;
			nonzero ||= output[0].some((value) => Math.abs(value) > 0.01);
		}
		expect(nonzero).toBe(true);
		expect(ended).toBe(true);
		expect(finalFrame).toBe(end);
		expect(rendered).toBeCloseTo(Math.ceil((end - start) / rate), 0);
		voice.destroy();
	});
	it("switches from buffered stretching to direct PCM at the audible seek frame", () => {
		const pcm = Float32Array.from({ length: 44100 }, (_, i) =>
			Math.sin(i * 0.062),
		);
		const voice = realVoice([pcm]);
		const output = [new Float32Array(128)];
		voice.setState(state({ rate: 0.5 }));
		const prior = voice.render(output, 0);
		voice.setState(state({ generation: 2, frame: prior?.endFrame ?? 0 }));
		const next = voice.render(output, 1);
		expect(next?.startFrame).toBe(64);
		expect(output[0][0]).toBe(pcm[64]);
		voice.destroy();
	});
});
