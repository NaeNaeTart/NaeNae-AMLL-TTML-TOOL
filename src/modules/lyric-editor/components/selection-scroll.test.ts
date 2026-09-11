import { describe, expect, it } from "vitest";
import { ToolMode } from "$/states/main.ts";
import {
	AUTO_SCROLL_PAUSE_MS,
	calculateScrollDuration,
	easeInOutSine,
	findClosestLineToViewportCenter,
	shouldAutoCenterSelection,
} from "./selection-scroll";

describe("AUTO_SCROLL_PAUSE_MS", () => {
	it("pauses auto-scroll for 3.5 seconds on user interaction", () => {
		expect(AUTO_SCROLL_PAUSE_MS).toBe(3500);
	});
});

describe("shouldAutoCenterSelection", () => {
	it("keeps direct Edit-mode selections stationary", () => {
		expect(shouldAutoCenterSelection(ToolMode.Edit)).toBe(false);
	});

	it("preserves automatic centering in Sync mode", () => {
		expect(shouldAutoCenterSelection(ToolMode.Sync)).toBe(true);
	});

	it("does not auto-center selections in Preview mode", () => {
		expect(shouldAutoCenterSelection(ToolMode.Preview)).toBe(false);
	});
});

describe("findClosestLineToViewportCenter", () => {
	it("uses the rendered line nearest the viewport center as the mode anchor", () => {
		expect(
			findClosestLineToViewportCenter(500, [
				{ index: 7, top: 100, height: 100 },
				{ index: 8, top: 430, height: 100 },
				{ index: 9, top: 650, height: 100 },
			]),
		).toBe(8);
	});

	it("returns no anchor when no rendered lines are available", () => {
		expect(findClosestLineToViewportCenter(500, [])).toBe(-1);
	});
});

describe("calculateScrollDuration", () => {
	it("provides snappy duration for small distances", () => {
		expect(calculateScrollDuration(50)).toBe(297);
		expect(calculateScrollDuration(0)).toBe(280);
	});

	it("scales duration proportionally for medium distances", () => {
		expect(calculateScrollDuration(500)).toBe(419);
		expect(calculateScrollDuration(1000)).toBe(493);
	});

	it("caps duration at 750ms for large and extreme distances", () => {
		expect(calculateScrollDuration(3600)).toBe(720);
		expect(calculateScrollDuration(10000)).toBe(750);
		expect(calculateScrollDuration(-5000)).toBe(750);
	});

	it("honors explicit duration override when supplied", () => {
		expect(calculateScrollDuration(3600, 450)).toBe(450);
	});
});

describe("easeInOutSine", () => {
	it("starts at 0 and ends at 1", () => {
		expect(easeInOutSine(0)).toBeCloseTo(0, 5);
		expect(easeInOutSine(1)).toBeCloseTo(1, 5);
	});

	it("evaluates midpoint at 0.5 with symmetric progression", () => {
		expect(easeInOutSine(0.5)).toBeCloseTo(0.5, 5);
		expect(easeInOutSine(0.25) + easeInOutSine(0.75)).toBeCloseTo(1, 5);
	});
});
