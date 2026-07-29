import { describe, expect, it } from "vitest";
import type { TTMLLyric } from "$/types/ttml";
import {
	normalizeApostrophes,
	normalizeCyrillicEs,
	normalizeImportedLyricApostrophes,
	normalizeImportedLyricCyrillicEs,
} from "./apostrophe-normalization";

describe("normalizeApostrophes", () => {
	it("converts supported apostrophe-like characters to ASCII apostrophes", () => {
		expect(normalizeApostrophes("`´ʻʼ՚‘’‚‛′‵＇")).toBe("''''''''''''");
	});

	it("leaves unrelated text unchanged while normalizing apostrophe-like characters", () => {
		expect(normalizeApostrophes('"Keep — punctuation, 1′ 2″"')).toBe(
			'"Keep — punctuation, 1\' 2″"',
		);
	});
});

describe("normalizeCyrillicEs", () => {
	it("converts Cyrillic Е and е embedded in Latin words", () => {
		expect(normalizeCyrillicEs("thе Еcho тeст")).toBe("the Echo тeст");
	});

	it("preserves genuine Cyrillic words", () => {
		expect(normalizeCyrillicEs("Елена, привет, ещё")).toBe(
			"Елена, привет, ещё",
		);
	});
});

describe("normalizeImportedLyricApostrophes", () => {
	const lyrics: TTMLLyric = {
		metadata: [{ key: "musicName", value: ["Don’t normalize metadata"] }],
		sections: [{ id: "section", label: "Verse ‘One’", category: "verse" }],
		lyricLines: [
			{
				id: "line",
				startTime: 0,
				endTime: 1,
				ignoreSync: false,
				isBG: false,
				isDuet: false,
				translatedLyric: "You’re here",
				romanLyric: "Lʼamour",
				words: [
					{
						id: "word",
						startTime: 0,
						endTime: 1,
						word: "It‘s fine",
						romanWord: "d’Accord",
						obscene: false,
						emptyBeat: 0,
					},
				],
			},
		],
	};

	it("normalizes all lyric text while preserving metadata and section labels", () => {
		const normalized = normalizeImportedLyricApostrophes(lyrics, true);

		expect(normalized.lyricLines[0]).toMatchObject({
			translatedLyric: "You're here",
			romanLyric: "L'amour",
			words: [{ word: "It's fine", romanWord: "d'Accord" }],
		});
		expect(normalized.metadata).toEqual(lyrics.metadata);
		expect(normalized.sections).toEqual(lyrics.sections);
	});

	it("preserves source text when disabled", () => {
		expect(normalizeImportedLyricApostrophes(lyrics, false)).toBe(lyrics);
	});

	it("normalizes all lyric text when enabled", () => {
		const normalized = normalizeImportedLyricCyrillicEs(
			{
				...lyrics,
				lyricLines: [
					{
						...lyrics.lyricLines[0],
						translatedLyric: "Теst",
						romanLyric: "Еcho",
						words: [
							{
								...lyrics.lyricLines[0].words[0],
								word: "Неy",
								romanWord: "Еcho",
							},
						],
					},
				],
			},
			true,
		);

		expect(normalized.lyricLines[0]).toMatchObject({
			translatedLyric: "Тest",
			romanLyric: "Echo",
			words: [{ word: "Нey", romanWord: "Echo" }],
		});
	});
});
