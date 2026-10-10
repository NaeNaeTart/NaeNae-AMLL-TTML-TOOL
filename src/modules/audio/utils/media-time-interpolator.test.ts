import { describe, expect, it } from "vitest";
import { MediaTimeInterpolator } from "./media-time-interpolator";

describe("MediaTimeInterpolator", () => {
	it("smooths a coarse media clock using elapsed wall time", () => {
		const clock = new MediaTimeInterpolator();
		expect(clock.sample(10, 1_000, 1, true)).toBe(10);
		expect(clock.sample(10, 1_080, 1, true)).toBeCloseTo(10.08);
	});

	it("scales interpolation with playback rate", () => {
		const clock = new MediaTimeInterpolator();
		clock.reset(10, 1_000);
		expect(clock.sample(10, 1_100, 0.5, true)).toBeCloseTo(10.05);
	});

	it("does not run ahead while playback is stalled or seeking", () => {
		const clock = new MediaTimeInterpolator();
		clock.reset(10, 1_000);
		expect(clock.sample(10, 2_000, 1, false)).toBe(10);
	});

	it("caps extrapolation when the media clock stops reporting progress", () => {
		const clock = new MediaTimeInterpolator();
		clock.reset(10, 1_000);
		expect(clock.sample(10, 6_000, 1, true)).toBeCloseTo(10.25);
	});

	it("re-anchors immediately when the media clock advances", () => {
		const clock = new MediaTimeInterpolator();
		clock.reset(10, 1_000);
		expect(clock.sample(10.2, 1_100, 1, true)).toBe(10.2);
		expect(clock.sample(10.2, 1_150, 1, true)).toBeCloseTo(10.25);
	});
});
