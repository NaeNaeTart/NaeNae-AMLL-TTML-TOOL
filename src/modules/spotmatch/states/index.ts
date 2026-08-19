import { atom } from "jotai";
import type {
	SpotifyTrack,
	SpotMatchCandidate,
	SpotMatchPresetKey,
} from "../types";

export const spotMatchInputAtom = atom<string>("");
export const spotMatchPresetAtom = atom<SpotMatchPresetKey>("Balanced");
export const spotMatchMinScoreAtom = atom<number>(60);
export const spotMatchMaxDurationSecAtom = atom<number>(10);
export const spotMatchExactTitleAtom = atom<boolean>(false);
export const spotMatchShowAdvancedAtom = atom<boolean>(false);

export const spotMatchSearchPagesAtom = atom<number>(1);
export const spotMatchSearchRepeatsAtom = atom<number>(2);
export const spotMatchReleasesPerArtistAtom = atom<number>(50);
export const spotMatchGlobalAlbumsAtom = atom<number>(0);
export const spotMatchGlobalPlaylistsAtom = atom<number>(0);
export const spotMatchTracksPerPlaylistAtom = atom<number>(0);
export const spotMatchTitleFloorAtom = atom<number>(58);
export const spotMatchVariantQueriesAtom = atom<boolean>(false);

export const spotMatchIsLoadingAtom = atom<boolean>(false);
export const spotMatchProgressMessageAtom = atom<string>("");
export const spotMatchSourceTrackAtom = atom<SpotifyTrack | null>(null);
export const spotMatchMatchesAtom = atom<SpotMatchCandidate[]>([]);
export const spotMatchSelectedIdsAtom = atom<string[]>([]);
export const spotMatchHasSearchedAtom = atom<boolean>(false);
export const spotMatchDismissedWidgetAtom = atom<boolean>(false);
