import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import {
	GUIDE_STEP_IDS,
	getGuideProgress,
	getGuideStepNumber,
	getGuideUrl,
	getWordTimingProgress,
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
	it("counts applicable words using the same bounds as the completion gate", () => {
		const lyrics = createLyrics();
		const line = lyrics.lyricLines[0];
		line.startTime = 0;
		line.endTime = 2000;
		line.words = [
			{ ...newLyricWord(), word: "Hello", startTime: 0, endTime: 500 },
			{ ...newLyricWord(), word: " ", startTime: 0, endTime: 0 },
			{ ...newLyricWord(), word: "world", startTime: 0, endTime: 0 },
		];
		lyrics.lyricLines.push({ ...line, id: "ignored", ignoreSync: true });
		expect(getWordTimingProgress(lyrics)).toEqual({ timed: 1, total: 2 });
		expect(hasCompleteTiming(lyrics)).toBe(false);
		line.words[2].startTime = 500;
		line.words[2].endTime = 1500;
		expect(getWordTimingProgress(lyrics)).toEqual({ timed: 2, total: 2 });
		expect(hasCompleteTiming(lyrics)).toBe(true);
		line.words[2].endTime = 2500;
		expect(getWordTimingProgress(lyrics)).toEqual({ timed: 1, total: 2 });
	});

	it("counts words in a line-synced lyric once the line is timed", () => {
		const lyrics = createLyrics();
		const line = lyrics.lyricLines[0];
		line.isLineSynced = true;
		expect(getWordTimingProgress(lyrics)).toEqual({ timed: 0, total: 1 });
		line.endTime = 1000;
		expect(getWordTimingProgress(lyrics)).toEqual({ timed: 1, total: 1 });
		expect(hasCompleteTiming(lyrics)).toBe(true);
	});
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
		expect(getGuideUrl("intro")).toBe("https://guides.spicylyrics.org/s/ttml");
		expect(getGuideUrl("audio")).toBe(
			"https://guides.spicylyrics.org/s/ttml/doc/1-import-the-song-iHfycCuOSU",
		);
		expect(getGuideUrl("lyrics")).toBe(
			"https://guides.spicylyrics.org/s/ttml/doc/2-import-the-lyrics-CK0YxRxPwp",
		);
		expect(getGuideUrl("review")).toBe(
			"https://guides.spicylyrics.org/s/ttml/doc/3-check-the-lyrics-ZHDMonddCz",
		);
		expect(getGuideUrl("sync")).toBe(
			"https://guides.spicylyrics.org/s/ttml/doc/4-sync-the-lyrics-MJsQ3M0dIS",
		);
		expect(getGuideUrl("songwriters")).toBe(
			"https://guides.spicylyrics.org/s/ttml/doc/5-add-the-songwriters-cP7OWZhyKd",
		);
		expect(getGuideUrl("export")).toBe(
			"https://guides.spicylyrics.org/s/ttml/doc/6-export-and-test-the-ttml-nzae0Py9JJ",
		);
		expect(getGuideUrl("test")).toBe(
			"https://guides.spicylyrics.org/s/ttml/doc/6-export-and-test-the-ttml-nzae0Py9JJ#h-run-a-local-test",
		);
	});
});
