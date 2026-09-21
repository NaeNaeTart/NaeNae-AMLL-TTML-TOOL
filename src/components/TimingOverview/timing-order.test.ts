import { describe, expect, it } from "vitest";
import type { LyricLine } from "$/types/ttml";
import {
	calculateTimingOverviewStats,
	findActiveTimingLine,
	findActiveTimingLineIndex,
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

	it("correctly selects upcoming line by timestamp with out-of-order timestamps in textual mode", () => {
		// Document order has out-of-order start times: l1 at 100s, l2 at 20s
		const outOfOrderLines: LyricLine[] = [
			createSampleLine("l1", "Later line in document first", 100000, 110000),
			createSampleLine("l2", "Earlier line in document second", 20000, 30000),
		];
		const displayed = getDisplayedTimingLines(outOfOrderLines, "textual");
		// Directly verify findActiveTimingLine picks the line with earlier start time
		expect(findActiveTimingLine(displayed, 10000)?.id).toBe("l2");
		// At 10s (gap before any line starts), upcoming line by timestamp is l2 (20s) at index 1
		expect(findActiveTimingLineIndex(displayed, 10000)).toBe(1);
		// At 25s (during l2), l2 is active at index 1
		expect(findActiveTimingLineIndex(displayed, 25000)).toBe(1);
		// At 50s (gap between l2 and l1), upcoming line is l1 (100s) at index 0
		expect(findActiveTimingLineIndex(displayed, 50000)).toBe(0);
		// At 105s (during l1), l1 is active at index 0
		expect(findActiveTimingLineIndex(displayed, 105000)).toBe(0);
		// At 120s (after all lines), no line is active or upcoming
		expect(findActiveTimingLineIndex(displayed, 120000)).toBe(-1);
	});

	it("correctly selects active and upcoming lines with interspersed unsynced lines in textual mode", () => {
		const mixedLines: LyricLine[] = [
			createSampleLine("l0", "Unsynced header", 0, 0),
			createSampleLine("l1", "Later line", 100000, 110000),
			createSampleLine("l2", "Unsynced bridge", 0, 0),
			createSampleLine("l3", "Earlier line", 20000, 30000),
		];
		const displayed = getDisplayedTimingLines(mixedLines, "textual");
		// At 10s: upcoming is l3 (20s) at index 3
		expect(findActiveTimingLineIndex(displayed, 10000)).toBe(3);
		// At 25s: active is l3 at index 3
		expect(findActiveTimingLineIndex(displayed, 25000)).toBe(3);
		// At 60s: upcoming is l1 (100s) at index 1
		expect(findActiveTimingLineIndex(displayed, 60000)).toBe(1);
		// At 105s: active is l1 at index 1
		expect(findActiveTimingLineIndex(displayed, 105000)).toBe(1);
	});
});
