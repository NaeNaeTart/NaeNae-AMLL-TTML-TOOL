import { useAtomValue, useStore } from "jotai";
import { useEffect } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { loadedAudioAtom } from "$/modules/audio/states";
import { projectIdAtom } from "$/states/main";
import { songMetadataFromTags } from "./logic/song-metadata";
import {
	applyLoadedAudioMetadataAtom,
	loadedAudioSongAtom,
} from "./song-metadata-state";

/** Observe successful audio loads from every entry point, including folder projects. */
export const AudioMetadataPrefill = () => {
	const audio = useAtomValue(loadedAudioAtom);
	const store = useStore();
	useEffect(() => {
		store.set(loadedAudioSongAtom, null);
		if (!audio.size) return;
		let cancelled = false;
		const projectId = store.get(projectIdAtom);
		void audioEngine.workerClient
			.readMetadata(audio)
			.then((result) => {
				// This metadata-only request owns its artwork URL, even when superseded.
				if (result.coverUrl) URL.revokeObjectURL(result.coverUrl);
				if (cancelled || store.get(loadedAudioAtom) !== audio) return;
				const song = songMetadataFromTags(result.metadata);
				store.set(applyLoadedAudioMetadataAtom, { audio, projectId, song });
			})
			.catch(() => {
				// Untagged or unsupported audio still gets a filename search fallback.
			});
		return () => {
			cancelled = true;
		};
	}, [audio, store]);
	return null;
};
