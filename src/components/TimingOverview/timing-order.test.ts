import { describe, expect, it } from "vitest";
import type { LyricLine } from "$/types/ttml";
import {
	calculateTimingOverviewStats,
	getDisplayedTimingLines,
} from "./timing-order";

describe("Timing Overview Ordering & Stats", () => {
	const createSampleLine = (
		id: string,
		text: string,
		startTime: number,
		endTime: number,
	): LyricLine => ({
		id,
		startTime,
		endTime,
		words: [
			{
				id: `${id}-w1`,
				word: text,
				startTime,
				endTime,
				emptyBeat: 0,
			},
		],
		translatedLyric: "",
		romanLyric: "",
		isBG: false,
		isDuet: false,
	});

	const sampleLines: LyricLine[] = [
		createSampleLine("l1", "First line", 14000, 16000),
		createSampleLine("l2", "Second line", 17000, 20000),
		createSampleLine("l3", "Unsynced chorus", 0, 0),
		createSampleLine("l4", "Unsynced outro", 0, 0),
	];

	it("sorts lines chronologically in chronological mode", () => {
		const result = getDisplayedTimingLines(sampleLines, "chronological");
		// In chronological mode, unsynced lines (startTime = 0) precede timed lines
		expect(result[0].id).toBe("l3");
		expect(result[1].id).toBe("l4");
		expect(result[2].id).toBe("l1");
		expect(result[3].id).toBe("l2");
	});

	it("preserves original document order in textual mode without moving unsynced lines to the top", () => {
		const result = getDisplayedTimingLines(sampleLines, "textual");
		expect(result[0].id).toBe("l1");
		expect(result[1].id).toBe("l2");
		expect(result[2].id).toBe("l3");
		expect(result[3].id).toBe("l4");
	});

	it("calculates total duration accurately even when the last document line is unsynced", () => {
		const stats = calculateTimingOverviewStats(sampleLines);
		expect(stats.lineCount).toBe(4);
		expect(stats.wordCount).toBe(4);
		// Span is 20000 - 14000 = 6000ms
		expect(stats.totalMs).toBe(6000);
	});

	it("handles empty line array gracefully", () => {
		const stats = calculateTimingOverviewStats([]);
		expect(stats.lineCount).toBe(0);
		expect(stats.wordCount).toBe(0);
		expect(stats.totalMs).toBe(0);
	});
});
