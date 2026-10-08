import { describe, expect, it } from "vitest";
import { clampPlaybackRate, stepPlaybackRate } from "./playback-rate";

describe("playback speed bounds", () => {
	it("clamps shortcut steps to the same 0.1-2x range as sliders", () => {
		expect(stepPlaybackRate(1.9, 1)).toBe(2);
		expect(stepPlaybackRate(0.25, -1)).toBe(0.1);
		expect(stepPlaybackRate(2, 1)).toBe(2);
		expect(stepPlaybackRate(0.1, -1)).toBe(0.1);
	});
	it("keeps quarter steps precise from non-quarter slider values", () => {
		expect(stepPlaybackRate(0.1, 1)).toBe(0.35);
		expect(stepPlaybackRate(1.05, -1)).toBe(0.8);
	});
	it("normalizes old saved speeds and invalid values", () => {
		expect(clampPlaybackRate(4)).toBe(2);
		expect(clampPlaybackRate(0)).toBe(0.1);
		expect(clampPlaybackRate(Number.NaN)).toBe(1);
	});
});
