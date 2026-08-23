import { describe, expect, it } from "vitest";
import {
	DEFAULT_INTERFACE_SCALE,
	getInterfaceScaleForShortcut,
	normalizeInterfaceScale,
} from "./interface-scale";

describe("interface scale", () => {
	it("clamps and rounds stored scale values to supported steps", () => {
		expect(normalizeInterfaceScale(0.2)).toBe(0.75);
		expect(normalizeInterfaceScale(1.234)).toBe(1.25);
		expect(normalizeInterfaceScale(2)).toBe(1.5);
	});

	it("handles zoom shortcuts without exceeding the supported range", () => {
		expect(getInterfaceScaleForShortcut(1, "+")).toBe(1.05);
		expect(getInterfaceScaleForShortcut(1, "-")).toBe(0.95);
		expect(getInterfaceScaleForShortcut(1.5, "+")).toBe(1.5);
		expect(getInterfaceScaleForShortcut(0.75, "-")).toBe(0.75);
		expect(getInterfaceScaleForShortcut(1.3, "0")).toBe(
			DEFAULT_INTERFACE_SCALE,
		);
	});

	it("ignores unrelated keys", () => {
		expect(getInterfaceScaleForShortcut(1, "ArrowUp", true)).toBeUndefined();
	});

	it("leaves zoom shortcuts to the browser outside Tauri", () => {
		expect(getInterfaceScaleForShortcut(1, "+", false)).toBeUndefined();
	});
});
