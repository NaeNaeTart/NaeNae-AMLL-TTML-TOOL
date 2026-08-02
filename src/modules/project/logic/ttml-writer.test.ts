import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "../../../types/ttml";
import { shouldExportAsLineSynced } from "./ttml-writer";

describe("shouldExportAsLineSynced", () => {
	it("keeps a genuine whole-line lyric line-synced", () => {
		const line = newLyricLine();
		line.isLineSynced = true;
		line.words = [{ ...newLyricWord(), word: "Whole line" }];

		expect(shouldExportAsLineSynced(line)).toBe(true);
	});

	it("preserves word timing when a stale line-synced flag has multiple words", () => {
		const line = newLyricLine();
		line.isLineSynced = true;
		line.words = [
			{ ...newLyricWord(), word: "Timed", startTime: 100, endTime: 400 },
			{ ...newLyricWord(), word: " ", startTime: 0, endTime: 0 },
			{ ...newLyricWord(), word: "words", startTime: 400, endTime: 800 },
		];

		expect(shouldExportAsLineSynced(line)).toBe(false);
	});
});
