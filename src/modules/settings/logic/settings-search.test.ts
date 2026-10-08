import { describe, expect, it } from "vitest";
import {
	matchesSettingsSearch,
	settingsSearchKeywords,
} from "./settings-search";

describe("settings search", () => {
	it("keeps all categories for an empty query", () => {
		expect(matchesSettingsSearch("Appearance", "  ")).toBe(true);
	});

	it("ignores case and extra whitespace", () => {
		expect(
			matchesSettingsSearch(
				"Music volume playback speed",
				"  PLAYBACK   speed ",
			),
		).toBe(true);
	});

	it("matches words in any order and requires every word", () => {
		expect(
			matchesSettingsSearch("Global Sync Time Offset", "offset sync"),
		).toBe(true);
		expect(
			matchesSettingsSearch("Global Sync Time Offset", "offset volume"),
		).toBe(false);
	});

	it("matches translated labels", () => {
		expect(matchesSettingsSearch("Apariencia", "apariencia")).toBe(true);
	});

	it.each([
		["folder project", "files"],
		["compact background", "common"],
		["autosave", "files"],
		["wrap", "editor"],
		["equalizer", "audio"],
		["font", "appearance"],
		["shortcut", "keybinding"],
	])("finds %s in the current dev category", (query, expected) => {
		const matches = Object.entries(settingsSearchKeywords)
			.filter(([, keywords]) => matchesSettingsSearch(keywords, query))
			.map(([value]) => value);
		expect(matches).toContain(expected);
	});

	it("returns no matches for an unknown setting", () => {
		expect(
			Object.values(settingsSearchKeywords).some((keywords) =>
				matchesSettingsSearch(keywords, "nonexistent-setting"),
			),
		).toBe(false);
	});
});
