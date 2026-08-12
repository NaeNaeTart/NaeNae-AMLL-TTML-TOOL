import { describe, expect, it } from "vitest";
import { replaceRomanization } from "./replace-romanization";

const lines = () => [
	{
		words: [
			{ word: "Hello", romanWord: "old-one" },
			{ word: "hello", romanWord: "old-two" },
		],
	},
	{ words: [{ word: "Hello", romanWord: "old-three" }] },
];

describe("replaceRomanization", () => {
	it("updates only the targeted word by default", () => {
		const lyricLines = lines();
		replaceRomanization(lyricLines, {
			lineIndex: 0,
			wordIndex: 0,
			targetWord: "Hello",
			replacement: "new",
			applyToAll: false,
			caseSensitive: true,
		});

		expect(
			lyricLines.map((line) => line.words.map((word) => word.romanWord)),
		).toEqual([["new", "old-two"], ["old-three"]]);
	});

	it("updates every exact source-word match", () => {
		const lyricLines = lines();
		replaceRomanization(lyricLines, {
			lineIndex: 0,
			wordIndex: 0,
			targetWord: "Hello",
			replacement: "new",
			applyToAll: true,
			caseSensitive: true,
		});

		expect(
			lyricLines.map((line) => line.words.map((word) => word.romanWord)),
		).toEqual([["new", "old-two"], ["new"]]);
	});

	it("supports case-insensitive source-word matching", () => {
		const lyricLines = lines();
		replaceRomanization(lyricLines, {
			lineIndex: 0,
			wordIndex: 0,
			targetWord: "Hello",
			replacement: "new",
			applyToAll: true,
			caseSensitive: false,
		});

		expect(
			lyricLines.flatMap((line) => line.words.map((word) => word.romanWord)),
		).toEqual(["new", "new", "new"]);
	});
});
