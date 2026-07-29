import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import { createReviewMessages, createReviewPayload } from "./logic";

const lyric = (): TTMLLyric => {
	const line = newLyricLine();
	const word = newLyricWord();
	word.word = "hello";
	line.words = [word];
	line.translatedLyric = "ciao";
	return { metadata: [{ key: "title", value: ["Test"] }], lyricLines: [line] };
};

describe("AI fun sidebar payload", () => {
	it("includes lyric text and supported project context", () => {
		const payload = createReviewPayload(lyric());
		expect(payload.metadata).toEqual([{ key: "title", value: ["Test"] }]);
		expect(payload.lyrics[0]).toMatchObject({
			text: "hello",
			translation: "ciao",
		});
	});

	it("uses the selected personality and the no-audio disclaimer", () => {
		const messages = createReviewMessages(lyric(), "roast");
		expect(messages[0].content).toContain("cannot hear the song");
		expect(messages[0].content).toContain("Roast the TTML");
	});

	it("keeps large projects under the request payload budget", () => {
		const large = lyric();
		large.lyricLines = Array.from({ length: 180 }, (_, index) => {
			const line = newLyricLine();
			const word = newLyricWord();
			word.word = `line ${index} ${"x".repeat(500)}`;
			line.words = [word];
			return line;
		});
		const payload = createReviewPayload(large);
		expect(JSON.stringify(payload).length).toBeLessThanOrEqual(12_000);
		expect(payload.truncated).toBe(true);
	});
});
