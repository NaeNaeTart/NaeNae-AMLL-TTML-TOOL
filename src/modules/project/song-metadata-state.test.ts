import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { loadedAudioAtom } from "$/modules/audio/states";
import {
	isDirtyAtom,
	lyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	startFreshLyricDocumentAtom,
	undoableLyricLinesAtom,
} from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	applyConfirmedImportMetadataAtom,
	applyLoadedAudioMetadataAtom,
	loadedAudioSongAtom,
} from "./song-metadata-state";

const setup = () => {
	const store = createStore();
	store.sub(undoableLyricLinesAtom, () => {});
	const audio = new Blob(["audio"]);
	store.set(loadedAudioAtom, audio);
	store.set(lyricLinesAtom, {
		lyricLines: [
			{ ...newLyricLine(), words: [{ ...newLyricWord(), word: "Hello" }] },
		],
		metadata: [],
	});
	store.set(startFreshLyricDocumentAtom);
	return {
		store,
		result: {
			audio,
			projectId: store.get(projectIdAtom),
			song: { title: "Track", artist: "Singer" },
		},
	};
};

describe("audio tag prefill", () => {
	it("fills a clean document without making lyrics dirty", () => {
		const { store, result } = setup();
		store.set(applyLoadedAudioMetadataAtom, result);
		expect(store.get(lyricLinesAtom).metadata).toEqual([
			{ key: "musicName", value: ["Track"] },
			{ key: "artists", value: ["Singer"] },
		]);
		expect(store.get(isDirtyAtom)).toBe(false);
	});
	it("preserves unsaved changes and metadata set while the tags were loading", () => {
		const { store, result } = setup();
		store.set(lyricLinesAtom, (current) => ({
			...current,
			metadata: [{ key: "musicName", value: ["User title"] }],
		}));
		store.set(applyLoadedAudioMetadataAtom, result);
		expect(store.get(lyricLinesAtom).metadata[0].value).toEqual(["User title"]);
		expect(store.get(isDirtyAtom)).toBe(true);
	});
	it("ignores tags from a superseded audio load", () => {
		const { store, result } = setup();
		store.set(loadedAudioAtom, new Blob(["new audio"]));
		store.set(applyLoadedAudioMetadataAtom, result);
		expect(store.get(lyricLinesAtom).metadata).toEqual([]);
		expect(store.get(loadedAudioSongAtom)).toBe(null);
	});
	it("does not fill a different project after an asynchronous tag read", () => {
		const { store, result } = setup();
		store.set(projectIdAtom, "different project");
		store.set(applyLoadedAudioMetadataAtom, result);
		expect(store.get(lyricLinesAtom).metadata).toEqual([]);
	});
});

describe("confirmed online import metadata", () => {
	it("names an untitled document and fills title, artist, album and cover", () => {
		const { store } = setup();
		store.set(applyConfirmedImportMetadataAtom, {
			title: "Track",
			artist: "Singer",
			album: "Album",
			cover: "https://example.com/cover.jpg",
		});
		expect(store.get(saveFileNameAtom)).toBe("Singer - Track.ttml");
		expect(store.get(lyricLinesAtom).metadata).toEqual([
			{ key: "musicName", value: ["Track"] },
			{ key: "artists", value: ["Singer"] },
			{ key: "album", value: ["Album"] },
			{ key: "cover_art", value: ["https://example.com/cover.jpg"] },
		]);
		expect(store.get(isDirtyAtom)).toBe(true);
	});
	it("preserves an existing project name and user metadata", () => {
		const { store } = setup();
		store.set(saveFileNameAtom, "My project.ttml");
		store.set(lyricLinesAtom, (current) => ({
			...current,
			metadata: [{ key: "musicName", value: ["My title"] }],
		}));
		store.set(applyConfirmedImportMetadataAtom, {
			title: "Sped Up Version",
			artist: "Singer",
		});
		expect(store.get(saveFileNameAtom)).toBe("My project.ttml");
		expect(store.get(lyricLinesAtom).metadata[0].value).toEqual(["My title"]);
	});
});
