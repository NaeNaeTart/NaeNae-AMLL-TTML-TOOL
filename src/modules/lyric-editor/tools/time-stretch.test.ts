import { describe, expect, it } from "vitest";
import type { TTMLLyric } from "$/types/ttml";
import { parseDurationInput, scaleTTMLTimings } from "./time-stretch";

describe("parseDurationInput", () => {
	it("accepts seconds and timestamp formats", () => {
		expect(parseDurationInput("210.5")).toBe(210_500);
		expect(parseDurationInput("03:30.500")).toBe(210_500);
		expect(parseDurationInput("1:02:03.004")).toBe(3_723_004);
		expect(parseDurationInput(" 01:00 ")).toBe(60_000);
	});

	it("handles zero and rejects invalid values", () => {
		expect(parseDurationInput("0")).toBe(0);
		expect(parseDurationInput("-1")).toBeNull();
		expect(parseDurationInput("not a duration")).toBeNull();
		expect(parseDurationInput("")).toBeNull();
	});
});

describe("scaleTTMLTimings", () => {
	it("scales every stored timeline timestamp and preserves other data", () => {
		const lyrics = {
			metadata: [{ key: "ttml:language", value: ["en"] }],
			marks: [{ timeMs: 501, label: "Verse" }],
			lyricLines: [
				{
					id: "line-1",
					startTime: 1_001,
					endTime: 2_001,
					ignoreSync: false,
					isBG: false,
					isDuet: false,
					translatedLyric: "",
					romanLyric: "",
					endTimeLink: {
						originalEndTime: 2_101,
						originalNextStartTime: 2_201,
					},
					words: [
						{
							id: "word-1",
							word: "hello",
							startTime: 1_101,
							endTime: 1_901,
							obscene: false,
							emptyBeat: 3,
							romanWord: "",
							ruby: [{ word: "he", startTime: 1_101, endTime: 1_401 }],
						},
					],
				},
			],
		} as TTMLLyric;

		scaleTTMLTimings(lyrics, 0.5);

		expect(lyrics.lyricLines[0].startTime).toBe(501);
		expect(lyrics.lyricLines[0].endTime).toBe(1_001);
		expect(lyrics.lyricLines[0].words[0].startTime).toBe(551);
		expect(lyrics.lyricLines[0].words[0].endTime).toBe(951);
		expect(lyrics.lyricLines[0].words[0].ruby?.[0]).toMatchObject({
			startTime: 551,
			endTime: 701,
		});
		expect(lyrics.lyricLines[0].endTimeLink).toEqual({
			originalEndTime: 1_051,
			originalNextStartTime: 1_101,
		});
		expect(lyrics.marks?.[0]).toEqual({ timeMs: 251, label: "Verse" });
		expect(lyrics.lyricLines[0].words[0].emptyBeat).toBe(3);
		expect(lyrics.metadata).toEqual([{ key: "ttml:language", value: ["en"] }]);
	});

	it("preserves zero and nullable linked timestamps", () => {
		const lyrics = {
			metadata: [],
			lyricLines: [
				{
					id: "line-1",
					startTime: 0,
					endTime: 100,
					ignoreSync: false,
					isBG: false,
					isDuet: false,
					translatedLyric: "",
					romanLyric: "",
					words: [],
					endTimeLink: {
						originalEndTime: 100,
						originalNextStartTime: null,
					},
				},
			],
		} as TTMLLyric;

		scaleTTMLTimings(lyrics, 2);

		expect(lyrics.lyricLines[0].startTime).toBe(0);
		expect(lyrics.lyricLines[0].endTime).toBe(200);
		expect(lyrics.lyricLines[0].endTimeLink?.originalNextStartTime).toBeNull();
	});

	it("rejects invalid scale factors", () => {
		const lyrics = { metadata: [], lyricLines: [] } as TTMLLyric;
		expect(() => scaleTTMLTimings(lyrics, 0)).toThrow(RangeError);
		expect(() => scaleTTMLTimings(lyrics, Number.POSITIVE_INFINITY)).toThrow(
			RangeError,
		);
	});
});
