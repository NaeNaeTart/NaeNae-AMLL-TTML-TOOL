import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import {
	hasCompleteTiming,
	hasImportedLyrics,
	hasNoEmptyLyricLines,
	hasSongwriters,
} from "./logic";

const createLyrics = (): TTMLLyric => {
	const line = newLyricLine();
	line.words = [{ ...newLyricWord(), word: "Hello" }];
	return { lyricLines: [line], metadata: [] };
};

describe("beginner guide predicates", () => {
	it("recognizes imported, non-empty lyrics", () => {
		const lyrics = createLyrics();
		expect(hasImportedLyrics(lyrics)).toBe(true);
		expect(hasNoEmptyLyricLines(lyrics)).toBe(true);
		expect(hasCompleteTiming(lyrics)).toBe(false);
	});

	it("requires every word to have valid timing", () => {
		const lyrics = createLyrics();
		for (const [lineIndex, line] of lyrics.lyricLines.entries()) {
			line.startTime = lineIndex * 2000 + 500;
			line.endTime = lineIndex * 2000 + 2400;
			for (const [wordIndex, word] of line.words.entries()) {
				word.startTime = line.startTime + wordIndex * 900;
				word.endTime = word.startTime + 800;
			}
		}
		expect(hasCompleteTiming(lyrics)).toBe(true);
	});

	it("rejects empty lines and accepts a non-empty songwriter", () => {
		const lyrics = createLyrics();
		const empty = newLyricLine();
		empty.words = [newLyricWord()];
		lyrics.lyricLines.push(empty);
		expect(hasNoEmptyLyricLines(lyrics)).toBe(false);
		expect(hasSongwriters(lyrics)).toBe(false);
		lyrics.metadata.push({ key: "songwriter", value: ["Practice Composer"] });
		expect(hasSongwriters(lyrics)).toBe(true);
	});
});
