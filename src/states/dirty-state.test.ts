import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import type { TTMLLyric } from "$/types/ttml";
import {
	isDirtyAtom,
	lyricLinesAtom,
	markLyricsSavedAtom,
	startFreshLyricDocumentAtom,
	undoableLyricLinesAtom,
	undoLyricLinesAtom,
} from "./main";

const lyric = (id: string): TTMLLyric => ({
	lyricLines: [],
	metadata: [{ key: "id", value: [id] }],
});

// Mirrors the app: the editor writes lyricLinesAtom directly while the history
// atom stays mounted (useTopMenuActions subscribes to it).
const mountedStore = () => {
	const store = createStore();
	store.sub(undoableLyricLinesAtom, () => {});
	store.sub(isDirtyAtom, () => {});
	return store;
};

describe("dirty state", () => {
	it("tracks edits via undo history before any save", () => {
		const store = mountedStore();
		expect(store.get(isDirtyAtom)).toBe(false);
		store.set(lyricLinesAtom, lyric("a"));
		expect(store.get(isDirtyAtom)).toBe(true);
	});

	it("marks the saved snapshot clean without clearing undo history", () => {
		const store = mountedStore();
		const edited = lyric("a");
		store.set(lyricLinesAtom, edited);
		store.set(markLyricsSavedAtom, edited);
		expect(store.get(isDirtyAtom)).toBe(false);
		expect(store.get(undoableLyricLinesAtom).canUndo).toBe(true);
	});

	it("stays dirty when edits land while a save is in flight", () => {
		const store = mountedStore();
		const snapshot = lyric("a");
		store.set(lyricLinesAtom, snapshot);
		store.set(lyricLinesAtom, lyric("b"));
		store.set(markLyricsSavedAtom, snapshot);
		expect(store.get(isDirtyAtom)).toBe(true);
	});

	it("reads clean again after undoing back to the saved version", () => {
		const store = mountedStore();
		const saved = lyric("a");
		store.set(lyricLinesAtom, saved);
		store.set(markLyricsSavedAtom, saved);
		store.set(lyricLinesAtom, lyric("b"));
		expect(store.get(isDirtyAtom)).toBe(true);
		store.set(undoLyricLinesAtom);
		expect(store.get(lyricLinesAtom)).toBe(saved);
		expect(store.get(isDirtyAtom)).toBe(false);
	});

	it("starts a fresh document clean with no undo history", () => {
		const store = mountedStore();
		store.set(lyricLinesAtom, lyric("a"));
		store.set(lyricLinesAtom, lyric("opened"));
		store.set(startFreshLyricDocumentAtom);
		expect(store.get(isDirtyAtom)).toBe(false);
		expect(store.get(undoableLyricLinesAtom).canUndo).toBe(false);
	});
});
