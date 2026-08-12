import type { TTMLLyric } from "$/types/ttml";

export type GuideStepId =
	| "audio"
	| "lyrics"
	| "review"
	| "sync"
	| "songwriters"
	| "export"
	| "test";

export const GUIDE_STEP_IDS: GuideStepId[] = [
	"audio",
	"lyrics",
	"review",
	"sync",
	"songwriters",
	"export",
	"test",
];

export const hasImportedLyrics = (lyrics: TTMLLyric) =>
	lyrics.lyricLines.some((line) =>
		line.words.some((word) => word.word.trim().length > 0),
	);

export const hasNoEmptyLyricLines = (lyrics: TTMLLyric) =>
	hasImportedLyrics(lyrics) &&
	lyrics.lyricLines.every((line) =>
		line.words.some((word) => word.word.trim().length > 0),
	);

export const hasCompleteTiming = (lyrics: TTMLLyric) => {
	const applicableLines = lyrics.lyricLines.filter((line) => !line.ignoreSync);
	return (
		applicableLines.length > 0 &&
		applicableLines.every(
			(line) =>
				line.startTime >= 0 &&
				line.endTime > line.startTime &&
				(line.isLineSynced ||
					line.words
						.filter((word) => word.word.trim().length > 0)
						.every(
							(word) =>
								word.endTime > word.startTime &&
								word.startTime >= line.startTime &&
								word.endTime <= line.endTime,
						)),
		)
	);
};

export const hasSongwriters = (lyrics: TTMLLyric) =>
	lyrics.metadata.some(
		(entry) =>
			entry.key === "songwriter" && entry.value.some((value) => value.trim()),
	);
