import { describe, expect, it, vi } from "vitest";
import type { AppearancePresetSettings } from "../states";
import { applyDefinedPresetSettings } from "./appearance-presets";

describe("appearance preset compatibility", () => {
	it("leaves font, image adjustments and scale intact when old presets omit them", () => {
		const appFont = vi.fn();
		const interfaceScale = vi.fn();
		const customBackgroundOpacity = vi.fn();
		applyDefinedPresetSettings<AppearancePresetSettings>(
			{ accentColor: "pink" },
			{ appFont, interfaceScale, customBackgroundOpacity },
		);
		expect(appFont).not.toHaveBeenCalled();
		expect(interfaceScale).not.toHaveBeenCalled();
		expect(customBackgroundOpacity).not.toHaveBeenCalled();
	});
	it("restores new fields, including false, zero and explicit font removal", () => {
		const appFont = vi.fn();
		const interfaceScale = vi.fn();
		const customFontData = vi.fn();
		const customBackgroundBlur = vi.fn();
		const legacyDarkTheme = vi.fn();
		applyDefinedPresetSettings<AppearancePresetSettings>(
			{
				appFont: "Inter",
				interfaceScale: 1.25,
				customFontData: null,
				customBackgroundBlur: 0,
				legacyDarkTheme: false,
			},
			{
				appFont,
				interfaceScale,
				customFontData,
				customBackgroundBlur,
				legacyDarkTheme,
			},
		);
		expect(appFont).toHaveBeenCalledWith("Inter");
		expect(interfaceScale).toHaveBeenCalledWith(1.25);
		expect(customFontData).toHaveBeenCalledWith(null);
		expect(customBackgroundBlur).toHaveBeenCalledWith(0);
		expect(legacyDarkTheme).toHaveBeenCalledWith(false);
	});
});
