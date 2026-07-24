import { describe, expect, it } from "vitest";
import {
	getSyllabificationEngine,
	splitJapaneseText,
} from "./syllabification-engines";

describe("syllabification engines", () => {
	it("uses Prosodic dictionary entries before its speech fallback", () => {
		const parts = getSyllabificationEngine("prosodic").split("everything");
		expect(parts.join("")).toBe("everything");
		expect(parts.length).toBeGreaterThan(1);
	});

	it("handles dropped-g lyric spellings", () => {
		const parts = getSyllabificationEngine("prosodic").split("singin");
		expect(parts.join("")).toBe("singin");
		expect(parts.length).toBeGreaterThan(1);
	});

	it("keeps basic and none engines unsplit", () => {
		expect(getSyllabificationEngine("basic").split("beautiful")).toEqual([
			"beautiful",
		]);
		expect(getSyllabificationEngine("none").split("beautiful")).toEqual([
			"beautiful",
		]);
	});

	it("keeps Japanese modifiers and punctuation with their mora", () => {
		expect(splitJapaneseText("キャット。")).toEqual(["キャ", "ッ", "ト。"]);
	});

	it.each([
		["silabas", "corazón"],
		["syllabify-fr", "bonjour"],
		["syllabify", "привет"],
	] as const)("preserves text with the %s engine", (engine, word) => {
		const parts = getSyllabificationEngine(engine).split(word);
		expect(parts.join("")).toBe(word);
	});
});
