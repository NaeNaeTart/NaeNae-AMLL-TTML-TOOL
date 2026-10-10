import { produce } from "immer";
import { createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { lyricLinesAtom } from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	hasGeniusHeaderAtom,
	lineDisplayNumbersAtom,
	lyricLineStructureAtom,
	lyricLinesOnlyAtom,
} from "./document-structure";

function songStore() {
	const store = createStore();
	store.set(lyricLinesAtom, {
		metadata: [],
		lyricLines: Array.from({ length: 60 }, (_, i) => ({
			...newLyricLine(),
			id: `line-${i}`,
			sectionId: i < 30 ? "verse" : "chorus",
			words: [
				{
					...newLyricWord(),
					word: "hello",
					startTime: i * 1000,
					endTime: i * 1000 + 500,
				},
			],
		})),
	});
	return store;
}

describe("lyric document structure subscriptions", () => {
	it("notifies only the edited row for a word timestamp edit in a 60-line song", () => {
		const store = songStore();
		const fullDocument = vi.fn();
		const structure = vi.fn();
		const numbers = vi.fn();
		const list = vi.fn();
		const headers = vi.fn();
		const rows = store.get(lyricLinesOnlyAtom).map(() => vi.fn());
		const unsubscribes = [
			store.sub(lyricLinesAtom, fullDocument),
			store.sub(lyricLineStructureAtom, structure),
			store.sub(lineDisplayNumbersAtom, numbers),
			store.sub(lyricLinesOnlyAtom, list),
			store.sub(hasGeniusHeaderAtom, headers),
			...store.get(lyricLinesOnlyAtom).map((row, i) => store.sub(row, rows[i])),
		];
		store.set(
			lyricLinesAtom,
			produce(store.get(lyricLinesAtom), (draft) => {
				draft.lyricLines[25].words[0].startTime += 10;
			}),
		);
		expect(fullDocument).toHaveBeenCalledTimes(1);
		expect(structure).not.toHaveBeenCalled();
		expect(numbers).not.toHaveBeenCalled();
		expect(list).not.toHaveBeenCalled();
		expect(headers).not.toHaveBeenCalled();
		expect(rows[25]).toHaveBeenCalledTimes(1);
		expect(rows.reduce((count, row) => count + row.mock.calls.length, 0)).toBe(
			1,
		);
		for (const unsubscribe of unsubscribes) unsubscribe();
	});

	it("updates for membership, reorder, insertion, removal and background status", () => {
		const store = songStore();
		const changed = vi.fn();
		const unsubscribe = store.sub(lyricLineStructureAtom, changed);
		const firstRow = store.get(lyricLinesOnlyAtom)[0];
		store.set(
			lyricLinesAtom,
			produce(store.get(lyricLinesAtom), (draft) => {
				draft.lyricLines[0].sectionId = "chorus";
			}),
		);
		expect(store.get(lyricLineStructureAtom)[0].sectionId).toBe("chorus");
		store.set(
			lyricLinesAtom,
			produce(store.get(lyricLinesAtom), (draft) => {
				const first = draft.lyricLines.shift();
				if (first) draft.lyricLines.push(first);
			}),
		);
		expect(store.get(lyricLinesOnlyAtom)[59]).toBe(firstRow);
		store.set(
			lyricLinesAtom,
			produce(store.get(lyricLinesAtom), (draft) => {
				draft.lyricLines.push({ ...newLyricLine(), id: "new" });
			}),
		);
		store.set(
			lyricLinesAtom,
			produce(store.get(lyricLinesAtom), (draft) => {
				draft.lyricLines.pop();
			}),
		);
		store.set(
			lyricLinesAtom,
			produce(store.get(lyricLinesAtom), (draft) => {
				draft.lyricLines[1].isBG = true;
			}),
		);
		expect(store.get(lineDisplayNumbersAtom).slice(0, 3)).toEqual([1, 1, 2]);
		expect(changed).toHaveBeenCalledTimes(5);
		unsubscribe();
	});

	it("detects a Genius header typed into an existing line", () => {
		const store = songStore();
		expect(store.get(hasGeniusHeaderAtom)).toBe(false);
		store.set(
			lyricLinesAtom,
			produce(store.get(lyricLinesAtom), (draft) => {
				draft.lyricLines[0].words[0].word = "[Chorus]";
			}),
		);
		expect(store.get(hasGeniusHeaderAtom)).toBe(true);
	});
});
