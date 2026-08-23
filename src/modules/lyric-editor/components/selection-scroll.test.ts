import { describe, expect, it } from "vitest";
import { ToolMode } from "$/states/main.ts";
import {
	findClosestLineToViewportCenter,
	shouldAutoCenterSelection,
} from "./selection-scroll";

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
