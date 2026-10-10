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
});
