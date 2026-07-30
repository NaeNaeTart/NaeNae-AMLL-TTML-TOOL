import { describe, expect, it } from "vitest";
import {
	clampScrollTop,
	getDragScrollDirection,
	normalizeWheelDelta,
} from "./drag-scroll";

const viewport = { top: 100, bottom: 500 };

describe("getDragScrollDirection", () => {
	it("scrolls upward in the top edge zone", () => {
		expect(getDragScrollDirection(148, viewport)).toBe(-1);
	});

	it("does not scroll away from either edge", () => {
		expect(getDragScrollDirection(300, viewport)).toBe(0);
	});

	it("scrolls downward in the bottom edge zone", () => {
		expect(getDragScrollDirection(452, viewport)).toBe(1);
	});
});

describe("clampScrollTop", () => {
	it("keeps scrolling within the viewport bounds", () => {
		expect(clampScrollTop(10, -20, 100)).toBe(0);
		expect(clampScrollTop(90, 20, 100)).toBe(100);
		expect(clampScrollTop(40, 10, 100)).toBe(50);
	});
});

describe("normalizeWheelDelta", () => {
	it("normalizes pixel, line, and page wheel modes", () => {
		expect(normalizeWheelDelta(12, 0, 16, 400)).toBe(12);
		expect(normalizeWheelDelta(3, 1, 16, 400)).toBe(48);
		expect(normalizeWheelDelta(-1, 2, 16, 400)).toBe(-400);
	});
});
