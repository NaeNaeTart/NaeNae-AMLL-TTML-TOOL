import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	showPreviewPanelAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	jumpToFirstUntimedLineAtom,
	timedPreviewLyricsAtom,
	untimedPreviewLinesAtom,
} from "./states";

describe("untimed preview lines", () => {
	it("excludes untimed lines but preserves a valid start at zero and source order", () => {
		const store = createStore();
		const zeroStart = { ...newLyricLine(), startTime: 0, endTime: 1000 };
		const untimed = newLyricLine();
		const later = { ...newLyricLine(), startTime: 5000, endTime: 6000 };
		const lyrics = { lyricLines: [zeroStart, untimed, later], metadata: [] };
		store.set(lyricLinesAtom, lyrics);
		expect(store.get(timedPreviewLyricsAtom).lyricLines).toEqual([
			zeroStart,
			later,
		]);
		expect(store.get(untimedPreviewLinesAtom)).toEqual([untimed]);
		expect(store.get(lyricLinesAtom)).toBe(lyrics);
	});
	it("jumps to the first untimed line and word in Time mode, closing side preview", () => {
		const store = createStore();
		const line = {
			...newLyricLine(),
			sectionId: "verse",
			words: [
				{ ...newLyricWord(), word: " " },
				{ ...newLyricWord(), word: "Hello" },
			],
		};
		store.set(lyricLinesAtom, {
			lyricLines: [line, newLyricLine()],
			metadata: [],
		});
		store.set(toolModeAtom, ToolMode.Preview);
		store.set(showPreviewPanelAtom, true);
		store.set(collapsedSectionIdsAtom, new Set(["verse", "chorus"]));
		store.set(jumpToFirstUntimedLineAtom);
		expect(store.get(toolModeAtom)).toBe(ToolMode.Sync);
		expect(store.get(selectedLinesAtom)).toEqual(new Set([line.id]));
		expect(store.get(selectedWordsAtom)).toEqual(new Set([line.words[1].id]));
		expect(store.get(showPreviewPanelAtom)).toBe(false);
		expect(store.get(collapsedSectionIdsAtom)).toEqual(new Set(["chorus"]));
	});
	it("leaves mode and selection alone when nothing is untimed", () => {
		const store = createStore();
		store.set(toolModeAtom, ToolMode.Preview);
		store.set(jumpToFirstUntimedLineAtom);
		expect(store.get(toolModeAtom)).toBe(ToolMode.Preview);
	});
});
