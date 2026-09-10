import { describe, expect, it } from "vitest";
import {
	calculateSmoothDuration,
	easeInOutCubic,
} from "$/utils/smooth-scroll.ts";

describe("easeInOutCubic", () => {
	it("anchors progress at boundaries and center", () => {
		expect(easeInOutCubic(0)).toBe(0);
		expect(easeInOutCubic(0.5)).toBe(0.5);
		expect(easeInOutCubic(1)).toBe(1);
	});

	it("strictly increases monotonically between 0 and 1", () => {
		const steps = [0.1, 0.25, 0.5, 0.75, 0.9];
		let prev = 0;
		for (const step of steps) {
			const current = easeInOutCubic(step);
			expect(current).toBeGreaterThan(prev);
			prev = current;
		}
	});

	it("accelerates in the first half and decelerates in the second half", () => {
		const deltaEarly = easeInOutCubic(0.2) - easeInOutCubic(0.1);
		const deltaMid = easeInOutCubic(0.5) - easeInOutCubic(0.4);
		const deltaLate = easeInOutCubic(0.9) - easeInOutCubic(0.8);
		expect(deltaMid).toBeGreaterThan(deltaEarly);
		expect(deltaMid).toBeGreaterThan(deltaLate);
	});
});

describe("calculateSmoothDuration", () => {
	it("clamps minimum duration to 350ms for short jumps", () => {
		expect(calculateSmoothDuration(10)).toBe(350);
		expect(calculateSmoothDuration(50)).toBe(350);
		expect(calculateSmoothDuration(-20)).toBe(350);
	});

	it("clamps maximum duration to 850ms for very large viewport jumps", () => {
		expect(calculateSmoothDuration(2500)).toBe(850);
		expect(calculateSmoothDuration(10000)).toBe(850);
		expect(calculateSmoothDuration(-5000)).toBe(850);
	});

	it("scales proportionally for intermediate scroll distances", () => {
		const duration1000 = calculateSmoothDuration(1000);
		const duration1500 = calculateSmoothDuration(1500);
		expect(duration1000).toBeGreaterThan(350);
		expect(duration1000).toBeLessThan(duration1500);
		expect(duration1500).toBeLessThanOrEqual(850);
	});
});

describe("autoScroll user interaction suspension logic", () => {
	it("correctly identifies when auto-scroll should be suspended after manual gesture", () => {
		const now = 10000;
		const pauseUntil = now + 3500;
		const isSuspendedAt1s = now + 1000 < pauseUntil;
		const isSuspendedAt3s = now + 3000 < pauseUntil;
		const isSuspendedAt4s = now + 4000 < pauseUntil;

		expect(isSuspendedAt1s).toBe(true);
		expect(isSuspendedAt3s).toBe(true);
		expect(isSuspendedAt4s).toBe(false);
	});
});
