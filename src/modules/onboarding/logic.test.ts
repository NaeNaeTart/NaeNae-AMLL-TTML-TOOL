import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	GUIDE_STEP_IDS,
	getGuideProgress,
	getGuideStepNumber,
	getGuideUrl,
	hasCompleteTiming,
	hasImportedLyrics,
	hasNoEmptyLyricLines,
	hasSongwriters,
} from "./logic";

const createLyrics = () => {
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

describe("beginner guide navigation", () => {
	it("numbers the preparation step as zero without increasing the task count", () => {
		expect(GUIDE_STEP_IDS).toEqual([
			"intro",
			"audio",
			"lyrics",
			"review",
			"sync",
			"songwriters",
			"export",
			"test",
		]);
		expect(getGuideStepNumber(0)).toEqual({ current: 0, total: 7 });
		expect(getGuideStepNumber(7)).toEqual({ current: 7, total: 7 });
		expect(getGuideProgress(0)).toBe(0);
		expect(getGuideProgress(7)).toBe(100);
	});

	it("builds URLs using the documentation's generated heading IDs", () => {
		expect(getGuideUrl("intro")).toBe("https://docs.tx24.dev/guides/ttml.html");
		expect(getGuideUrl("audio")).toBe(
			"https://docs.tx24.dev/guides/ttml.html#_1-import-the-song",
		);
		expect(getGuideUrl("lyrics")).toBe(
			"https://docs.tx24.dev/guides/ttml.html#_2-import-the-lyrics",
		);
		expect(getGuideUrl("review")).toBe(
			"https://docs.tx24.dev/guides/ttml.html#_3-check-the-lyrics",
		);
		expect(getGuideUrl("sync")).toBe(
			"https://docs.tx24.dev/guides/ttml.html#_4-sync-the-lyrics",
		);
		expect(getGuideUrl("songwriters")).toBe(
			"https://docs.tx24.dev/guides/ttml.html#_5-add-songwriters",
		);
		expect(getGuideUrl("export")).toBe(
			"https://docs.tx24.dev/guides/ttml.html#_6-export-and-test-the-ttml",
		);
		expect(getGuideUrl("test")).toBe(
			"https://docs.tx24.dev/guides/ttml.html#test-locally",
		);
	});
});
