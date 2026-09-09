import type { TTMLLyric } from "$/types/ttml";

export type GuideStepId =
	| "intro"
	| "audio"
	| "lyrics"
	| "review"
	| "sync"
	| "songwriters"
	| "export"
	| "test";

export const GUIDE_STEP_IDS: GuideStepId[] = [
	"intro",
	"audio",
	"lyrics",
	"review",
	"sync",
	"songwriters",
	"export",
	"test",
];

const DOCS_BASE = "https://guides.spicylyrics.org/s/ttml";

const GUIDE_ANCHORS: Record<GuideStepId, string> = {
	intro: "",
	audio: "/doc/1-import-the-song-iHfycCuOSU",
	lyrics: "/doc/2-import-the-lyrics-CK0YxRxPwp",
	review: "/doc/3-check-the-lyrics-ZHDMonddCz",
	sync: "/doc/4-sync-the-lyrics-MJsQ3M0dIS",
	songwriters: "/doc/5-add-the-songwriters-cP7OWZhyKd",
	export: "/doc/6-export-and-test-the-ttml-nzae0Py9JJ",
	test: "/doc/6-export-and-test-the-ttml-nzae0Py9JJ#h-run-a-local-test",
};

export const getGuideStepNumber = (step: number) => ({
	current: Math.min(Math.max(step, 0), GUIDE_STEP_IDS.length - 1),
	total: GUIDE_STEP_IDS.length - 1,
});

export const getGuideProgress = (step: number) => {
	const { current, total } = getGuideStepNumber(step);
	return (current / total) * 100;
};

export const getGuideUrl = (id: GuideStepId) =>
	`${DOCS_BASE}${GUIDE_ANCHORS[id]}`;

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
