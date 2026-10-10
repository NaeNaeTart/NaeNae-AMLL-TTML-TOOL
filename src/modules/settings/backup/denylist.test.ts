import { describe, expect, it } from "vitest";
import { isDeniedKey, isExportDeniedKey } from "./denylist";

describe("removed audio preferences", () => {
	it.each([
		"mp3ConversionMode",
		"hideMp3ConversionWarning",
	])("excludes %s from import and export", (key) => {
		expect(isDeniedKey(key)).toBe(true);
		expect(isExportDeniedKey(key)).toBe(true);
	});
});
