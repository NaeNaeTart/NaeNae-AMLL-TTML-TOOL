import { describe, expect, it } from "vitest";
import { PcmClock, replayFrame, seekFrame } from "./pcm-clock";

describe("PCM clock", () => {
	it("clamps seeks and restarts playback near EOF", () => {
		expect(seekFrame(-10, 44100, 100000)).toBe(0);
		expect(seekFrame(Infinity, 44100, 100000)).toBe(100000);
		expect(seekFrame(Number.NaN, 44100, 100000)).toBe(0);
		expect(seekFrame(0.1, 44100, 100000)).toBe(4410);
		expect(replayFrame(99900, 44100, 100000)).toBe(0);
		expect(replayFrame(90000, 44100, 100000)).toBe(90000);
	});
	it("interpolates only audible rendered frames and freezes on underrun", () => {
		const clock = new PcmClock();
		clock.reset(1, 100);
		clock.push({
			generation: 1,
			startFrame: 100,
			endFrame: 164,
			contextTime: 5,
			renderedFrames: 128,
			ended: false,
		});
		expect(clock.frameAt(4.99, 1000)).toBe(100);
		expect(clock.frameAt(5.064, 1000)).toBeCloseTo(132);
		expect(clock.frameAt(20, 1000)).toBe(164);
		clock.push({
			generation: 1,
			startFrame: 164,
			endFrame: 164,
			contextTime: 6,
			renderedFrames: 0,
			ended: false,
		});
		expect(clock.frameAt(21, 1000)).toBe(164);
	});
	it("ignores late reports from any previous seek generation", () => {
		const clock = new PcmClock();
		clock.reset(4, 500);
		expect(
			clock.push({
				generation: 3,
				startFrame: 0,
				endFrame: 128,
				contextTime: 0,
				renderedFrames: 128,
				ended: true,
			}),
		).toBe(false);
		expect(clock.frameAt(100, 44100)).toBe(500);
	});
	it("keeps audible history across a speed change that continues from the rendered frame", () => {
		const clock = new PcmClock();
		clock.reset(1, 0);
		clock.push({
			generation: 1,
			startFrame: 0,
			endFrame: 128,
			contextTime: 0,
			renderedFrames: 128,
			ended: false,
		});
		clock.push({
			generation: 1,
			startFrame: 128,
			endFrame: 256,
			contextTime: 128 / 44100,
			renderedFrames: 128,
			ended: false,
		});
		expect(clock.renderedFrame).toBe(256);
		clock.continueAs(2);
		expect(
			clock.push({
				generation: 1,
				startFrame: 256,
				endFrame: 384,
				contextTime: 1,
				renderedFrames: 128,
				ended: false,
			}),
		).toBe(false);
		// Audio still in flight from the old speed keeps its own timing.
		expect(clock.frameAt(64 / 44100, 44100)).toBeCloseTo(64);
		clock.push({
			generation: 2,
			startFrame: 256,
			endFrame: 320,
			contextTime: 256 / 44100,
			renderedFrames: 128,
			ended: false,
		});
		expect(clock.frameAt(256 / 44100 + 64 / 44100, 44100)).toBeCloseTo(288);
	});
});
