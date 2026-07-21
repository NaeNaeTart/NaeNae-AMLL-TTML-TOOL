import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord, type LyricLine } from "$/types/ttml.ts";
import {
	copySectionTimings,
	findPreviousMatchingSection,
	getGeniusHeader,
	getSectionBounds,
	shiftSectionToTime,
} from "./genius-sections.ts";

const line = (
	header: string | undefined,
	startTime = 0,
	words = 1,
): LyricLine => ({
	...newLyricLine(),
	geniusHeader: header,
	startTime,
	endTime: startTime + 100,
	words: Array.from({ length: words }, (_, index) => ({
		...newLyricWord(),
		startTime: startTime + index * 10,
		endTime: startTime + index * 10 + 5,
	})),
});

describe("Genius sections", () => {
	it("recognizes arbitrary bracket-only Genius labels", () => {
		expect(getGeniusHeader(" [Chorus] ")).toBe("[Chorus]");
		expect(getGeniusHeader("[Verse 2: Guest]")).toBe("[Verse 2: Guest]");
		expect(getGeniusHeader("[Post-Chorus]")).toBe("[Post-Chorus]");
		expect(getGeniusHeader("[ ]")).toBe("[ ]");
		expect(getGeniusHeader("[Chorus] lyric")).toBeUndefined();
	});

	it("uses exact labels and contiguous lines as section boundaries", () => {
		const lines = [line("[Chorus]", 100), line("[Chorus]"), line("[Chorus 2]")];
		expect(getSectionBounds(lines, 1)).toMatchObject({ start: 0, end: 2 });
		expect(
			findPreviousMatchingSection([...lines, line("[Chorus]", 500)], 3),
		).toMatchObject({ start: 0, end: 2 });
	});

	it("shifts whole sections and copies matching line/word timing only", () => {
		const lines = [
			line("[Chorus]", 100, 2),
			line("[Chorus]", 250),
			line("[Verse]", 400),
			line("[Chorus]", 700, 2),
			line("[Chorus]", 850),
			line("[Chorus]", 1000),
		];
		shiftSectionToTime(lines, 3, 900);
		expect(lines[3].startTime).toBe(900);
		expect(lines[4].startTime).toBe(1050);
		const previous = findPreviousMatchingSection(lines, 3);
		expect(previous).toMatchObject({ start: 0, end: 2 });
		if (!previous) throw new Error("Expected a previous Chorus section");
		const result = copySectionTimings(lines, 3, previous);
		expect(result).toEqual({ copiedLineCount: 2, lengthsMatch: false });
		expect(lines[3].startTime).toBe(100);
		expect(lines[3].words[1].endTime).toBe(115);
		expect(lines[5].startTime).toBe(1200);
	});
});
