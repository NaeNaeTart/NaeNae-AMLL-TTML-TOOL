import { describe, expect, it } from "vitest";
import { ToolMode } from "$/states/main.ts";
import { shouldAutoCenterSelection } from "./selection-scroll";

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
