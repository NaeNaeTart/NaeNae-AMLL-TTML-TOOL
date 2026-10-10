// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { TTMLLyric } from "$/types/ttml";
import { parseLyric } from "./ttml-parser";
import exportTTMLText from "./ttml-writer";

function ttml(paragraph: string) {
	return `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:amll="http://www.example.com/ns/amll"><head/><body><div>${paragraph}</div></body></tt>`;
}

function withoutIds(lyric: TTMLLyric) {
	return lyric.lyricLines.map(({ id: _id, words, ...line }) => ({
		...line,
		agent: line.agent ?? "v1",
		words: words.map(({ id: _wordId, ...word }) => word),
	}));
}

function roundTrip(xml: string) {
	const parsed = parseLyric(xml);
	const reparsed = parseLyric(exportTTMLText(parsed));
	expect(withoutIds(reparsed)).toEqual(withoutIds(parsed));
	return parsed.lyricLines;
}

describe("TTML round trip", () => {
	it("moves trailing spaces out of a timed syllable and keeps them on export", () => {
		const [line] = roundTrip(
			ttml(
				'<p begin="00:01.000" end="00:03.000"><span begin="00:01.000" end="00:03.000">hello  </span></p>',
			),
		);
		expect(line.words.map((w) => w.word)).toEqual(["hello", "  "]);
		expect(line.words[0]).toMatchObject({ startTime: 1000, endTime: 3000 });
		expect(line.words[1]).toMatchObject({ startTime: 0, endTime: 0 });
	});

	it("keeps timing on each syllable of a multi-word line", () => {
		const [line] = roundTrip(
			ttml(
				'<p begin="00:01.000" end="00:03.000"><span begin="00:01.000" end="00:02.000">one </span><span begin="00:02.000" end="00:03.000">two</span></p>',
			),
		);
		expect(line.words.map((w) => [w.word, w.startTime])).toEqual([
			["one", 1000],
			[" ", 0],
			["two", 2000],
		]);
	});

	it("leaves line-synced text whole", () => {
		const [line] = roundTrip(
			ttml('<p begin="00:01.000" end="00:03.000">a whole line  </p>'),
		);
		expect(line.words.map((w) => w.word).join("")).toBe("a whole line  ");
	});
});
