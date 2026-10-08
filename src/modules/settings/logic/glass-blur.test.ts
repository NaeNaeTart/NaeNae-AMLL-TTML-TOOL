import { describe, expect, it } from "vitest";
import { clampGlassBlur, getPresetGlassBlur } from "./glass-blur";

describe("unified glass blur", () => {
	it("uses the canonical value when an old preset has conflicting sliders", () => {
		expect(getPresetGlassBlur({ glassBlur: 24, vBackdrop: 16 })).toBe(24);
		expect(getPresetGlassBlur({ glassBlur: 0, vBackdrop: 16 })).toBe(0);
	});
	it("accepts old advanced-only presets and clamps their former 100px range", () => {
		expect(getPresetGlassBlur({ vBackdrop: 40 })).toBe(40);
		expect(getPresetGlassBlur({ vBackdrop: 100 })).toBe(64);
		expect(getPresetGlassBlur({})).toBeUndefined();
	});
	it("has one default and range", () => {
		expect(clampGlassBlur(-1)).toBe(0);
		expect(clampGlassBlur(Number.NaN)).toBe(24);
	});
});
