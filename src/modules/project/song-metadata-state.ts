import { atom } from "jotai";
import { loadedAudioAtom } from "$/modules/audio/states";
import {
	isDirtyAtom,
	lyricLinesAtom,
	markLyricsSavedAtom,
	projectIdAtom,
	saveFileNameAtom,
} from "$/states/main";
import {
	fillEmptySongMetadata,
	getImportFileName,
	type SongMetadata,
} from "./logic/song-metadata";

export const loadedAudioSongAtom = atom<{
	audio: Blob;
	song: SongMetadata;
} | null>(null);

/** Called only after lyrics have been imported, never while browsing results. */
export const applyConfirmedImportMetadataAtom = atom(
	null,
	(get, set, song: SongMetadata) => {
		const current = get(lyricLinesAtom);
		const metadata = current.metadata.map((entry) => ({
			...entry,
			value: [...entry.value],
		}));
		if (fillEmptySongMetadata(metadata, song))
			set(lyricLinesAtom, { ...current, metadata });
		set(saveFileNameAtom, getImportFileName(get(saveFileNameAtom), song));
	},
);

export const applyLoadedAudioMetadataAtom = atom(
	null,
	(
		get,
		set,
		result: {
			audio: Blob;
			projectId: string;
			song: SongMetadata;
		},
	) => {
		if (get(loadedAudioAtom) !== result.audio) return;
		set(loadedAudioSongAtom, { audio: result.audio, song: result.song });
		if (get(projectIdAtom) !== result.projectId) return;
		const current = get(lyricLinesAtom);
		const metadata = current.metadata.map((entry) => ({
			...entry,
			value: [...entry.value],
		}));
		if (!fillEmptySongMetadata(metadata, result.song)) return;
		const wasDirty = get(isDirtyAtom);
		const next = { ...current, metadata };
		set(lyricLinesAtom, next);
		// Tag filling isn't a user edit. Keep genuine pending edits dirty.
		if (!wasDirty) set(markLyricsSavedAtom, next);
	},
);
