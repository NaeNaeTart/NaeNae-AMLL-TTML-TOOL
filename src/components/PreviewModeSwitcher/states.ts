import { atom } from "jotai";
import { hasNoTiming } from "$/modules/lyric-editor/utils/timing-status";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	showPreviewPanelAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";

export const untimedPreviewLinesAtom = atom((get) =>
	get(lyricLinesAtom).lyricLines.filter(hasNoTiming),
);

export const timedPreviewLyricsAtom = atom((get) => {
	const lyrics = get(lyricLinesAtom);
	return {
		...lyrics,
		lyricLines: lyrics.lyricLines.filter((line) => !hasNoTiming(line)),
	};
});

export const jumpToFirstUntimedLineAtom = atom(null, (get, set) => {
	const line = get(untimedPreviewLinesAtom)[0];
	if (!line) return;
	if (line.sectionId) {
		const expanded = new Set(get(collapsedSectionIdsAtom));
		expanded.delete(line.sectionId);
		set(collapsedSectionIdsAtom, expanded);
	}
	set(selectedLinesAtom, new Set([line.id]));
	const word = line.words.find((item) => item.word.trim());
	set(selectedWordsAtom, new Set(word ? [word.id] : []));
	set(toolModeAtom, ToolMode.Sync);
	set(showPreviewPanelAtom, false);
});
