import { atomWithStorage } from "jotai/utils";

export const processImportedLyricsAtom = atomWithStorage(
	"importLyrics.processLyrics",
	false,
	undefined,
	{ getOnInit: true },
);

export const fetchImportedSongwritersAtom = atomWithStorage(
	"importLyrics.fetchSongwriters",
	false,
	undefined,
	{ getOnInit: true },
);

export const categorizeGeniusHeadersOnImportAtom = atomWithStorage(
	"importLyrics.categorizeGeniusHeaders",
	false,
	undefined,
	{ getOnInit: true },
);
