// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { LyricLine } from "../../../types/ttml";
import { newLyricLine, newLyricWord } from "../../../types/ttml";
import exportTTMLText, {
	collectFollowingBackgroundLines,
	hasExportableLineContent,
	shouldExportAsLineSynced,
} from "./ttml-writer";

function backgroundLine(id: string): LyricLine {
	return { ...newLyricLine(), id, isBG: true };
}

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

describe("collectFollowingBackgroundLines", () => {
	it("collects every consecutive background line when enabled", () => {
		const lines = [
			{ ...newLyricLine(), id: "main" },
			backgroundLine("bg-1"),
			backgroundLine("bg-2"),
			backgroundLine("bg-3"),
			{ ...newLyricLine(), id: "next-main" },
		];
		expect(
			collectFollowingBackgroundLines(lines, 0, true).map((line) => line.id),
		).toEqual(["bg-1", "bg-2", "bg-3"]);
	});

	it("keeps legacy one-line grouping when disabled", () => {
		const lines = [
			{ ...newLyricLine(), id: "main" },
			backgroundLine("bg-1"),
			backgroundLine("bg-2"),
		];
		expect(
			collectFollowingBackgroundLines(lines, 0, false).map((line) => line.id),
		).toEqual(["bg-1"]);
	});

	it("collects the full run after a standalone background line when enabled", () => {
		const lines = [
			backgroundLine("orphan"),
			backgroundLine("bg-2"),
			backgroundLine("bg-3"),
		];
		expect(
			collectFollowingBackgroundLines(lines, 0, true).map((line) => line.id),
		).toEqual(["bg-2", "bg-3"]);
	});
});

describe("hasExportableLineContent", () => {
	it("ignores a completely empty editor line", () => {
		expect(hasExportableLineContent(newLyricLine())).toBe(false);
	});

	it("keeps standalone background lines with content", () => {
		const line = backgroundLine("standalone-bg");
		line.words = [{ ...newLyricWord(), word: "Oh" }];
		expect(hasExportableLineContent(line)).toBe(true);
	});
});

describe("exportTTMLText background lines", () => {
	it("exports consecutive standalone background lines with independent p elements and timestamps", () => {
		const bg1: LyricLine = {
			...newLyricLine(),
			id: "bg-1",
			isBG: true,
			startTime: 10_000,
			endTime: 12_000,
			words: [
				{
					...newLyricWord(),
					word: "First",
					startTime: 10_000,
					endTime: 11_000,
				},
				{ ...newLyricWord(), word: "bg", startTime: 11_000, endTime: 12_000 },
			],
		};
		const bg2: LyricLine = {
			...newLyricLine(),
			id: "bg-2",
			isBG: true,
			startTime: 13_000,
			endTime: 16_000,
			words: [
				{
					...newLyricWord(),
					word: "Second",
					startTime: 13_000,
					endTime: 14_500,
				},
				{ ...newLyricWord(), word: "bg", startTime: 14_500, endTime: 16_000 },
			],
		};

		const ttml = exportTTMLText({
			metadata: [],
			lyricLines: [bg1, bg2],
		});

		const parser = new DOMParser();
		const doc = parser.parseFromString(ttml, "application/xml");
		const pElements = doc.querySelectorAll("body p");

		expect(pElements.length).toBe(2);
		expect(pElements[0].getAttribute("begin")).toBe("00:10.000");
		expect(pElements[0].getAttribute("end")).toBe("00:12.000");
		expect(pElements[1].getAttribute("begin")).toBe("00:13.000");
		expect(pElements[1].getAttribute("end")).toBe("00:16.000");

		const bgSpans1 = pElements[0].querySelectorAll("span[ttm\\:role='x-bg']");
		const bgSpans2 = pElements[1].querySelectorAll("span[ttm\\:role='x-bg']");
		expect(bgSpans1.length).toBe(1);
		expect(bgSpans2.length).toBe(1);
	});

	it("exports a non-overlapping background line after a main line as its own p tag", () => {
		const mainLine: LyricLine = {
			...newLyricLine(),
			id: "main",
			isBG: false,
			startTime: 43_119,
			endTime: 43_627,
			words: [
				{
					...newLyricWord(),
					word: "Check",
					startTime: 43_119,
					endTime: 43_262,
				},
				{ ...newLyricWord(), word: "it", startTime: 43_262, endTime: 43_364 },
				{ ...newLyricWord(), word: "out", startTime: 43_364, endTime: 43_627 },
			],
		};
		const bgLine: LyricLine = {
			...newLyricLine(),
			id: "bg",
			isBG: true,
			startTime: 50_131,
			endTime: 51_600,
			words: [
				{
					...newLyricWord(),
					word: "tniop",
					startTime: 50_131,
					endTime: 50_383,
				},
				{ ...newLyricWord(), word: "siht", startTime: 50_383, endTime: 51_600 },
			],
		};

		const ttml = exportTTMLText({
			metadata: [],
			lyricLines: [mainLine, bgLine],
		});

		const parser = new DOMParser();
		const doc = parser.parseFromString(ttml, "application/xml");
		const pElements = doc.querySelectorAll("body p");

		expect(pElements.length).toBe(2);
		expect(pElements[0].getAttribute("begin")).toBe("00:43.119");
		expect(pElements[0].getAttribute("end")).toBe("00:43.627");
		expect(pElements[1].getAttribute("begin")).toBe("00:50.131");
		expect(pElements[1].getAttribute("end")).toBe("00:51.600");
	});
});
