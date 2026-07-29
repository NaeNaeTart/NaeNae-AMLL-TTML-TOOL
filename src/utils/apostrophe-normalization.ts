import type { TTMLLyric } from "$/types/ttml";

const APOSTROPHE_LIKE_CHARACTERS =
	/[`´\u02BB\u02BC\u055A\u2018\u2019\u201A\u201B\u2032\u2035\uFF07]/g;

/** Converts common apostrophe-like characters to the ASCII apostrophe. */
export const normalizeApostrophes = (text: string): string =>
	text.replace(APOSTROPHE_LIKE_CHARACTERS, "'");

/**
 * Converts Cyrillic Е/е only when it is embedded in an otherwise Latin word.
 * This catches hidden lookalikes such as "thе" without changing genuine
 * Cyrillic words such as "привет".
 */
export const normalizeCyrillicEs = (text: string): string =>
	text.replace(/[\p{L}\p{N}]+/gu, (token) => {
		if (!/[Ее]/.test(token) || !/[A-Za-z]/.test(token)) return token;
		return token.replace(/[Ее]/g, (character) =>
			character === "Е" ? "E" : "e",
		);
	});

/**
 * Returns imported lyric content with apostrophe-like characters normalized.
 * Project metadata and section labels are intentionally preserved verbatim.
 */
export const normalizeImportedLyricApostrophes = (
	lyrics: TTMLLyric,
	enabled: boolean,
): TTMLLyric => {
	if (!enabled) return lyrics;

	return {
		...lyrics,
		lyricLines: lyrics.lyricLines.map((line) => ({
			...line,
			translatedLyric: normalizeApostrophes(line.translatedLyric ?? ""),
			romanLyric: normalizeApostrophes(line.romanLyric ?? ""),
			words: line.words.map((word) => ({
				...word,
				word: normalizeApostrophes(word.word),
				romanWord: normalizeApostrophes(word.romanWord ?? ""),
			})),
		})),
	};
};

/**
 * Returns imported lyric content with isolated Cyrillic Е/е lookalikes normalized.
 * Project metadata and section labels are intentionally preserved verbatim.
 */
export const normalizeImportedLyricCyrillicEs = (
	lyrics: TTMLLyric,
	enabled: boolean,
): TTMLLyric => {
	if (!enabled) return lyrics;

	return {
		...lyrics,
		lyricLines: lyrics.lyricLines.map((line) => ({
			...line,
			translatedLyric: normalizeCyrillicEs(line.translatedLyric ?? ""),
			romanLyric: normalizeCyrillicEs(line.romanLyric ?? ""),
			words: line.words.map((word) => ({
				...word,
				word: normalizeCyrillicEs(word.word),
				romanWord: normalizeCyrillicEs(word.romanWord ?? ""),
			})),
		})),
	};
};
