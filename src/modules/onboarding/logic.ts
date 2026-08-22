import type { TTMLLyric } from "$/types/ttml";

export type GuideStepId =
	| "intro"
	| "audio"
	| "lyrics"
	| "review"
	| "sync"
	| "songwriters"
	| "export"
	| "test"
	| "vgz";

export const GUIDE_STEP_IDS: GuideStepId[] = [
	"intro",
	"audio",
	"lyrics",
	"review",
	"sync",
	"songwriters",
	"export",
	"test",
	"vgz",
];

const DOCS_BASE = "https://docs.tx24.dev/guides/ttml.html";

const GUIDE_ANCHORS: Record<GuideStepId, string> = {
	intro: "",
	audio: "#_1-import-the-song",
	lyrics: "#_2-import-the-lyrics",
	review: "#_3-check-the-lyrics",
	sync: "#_4-sync-the-lyrics",
	songwriters: "#_5-add-songwriters",
	export: "#_6-export-and-test-the-ttml",
	test: "#test-locally",
	vgz: "",
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
