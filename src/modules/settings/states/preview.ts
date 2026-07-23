import { atomWithStorage } from "jotai/utils";

export enum PreviewModeType {
	Standard = "standard",
	AMLL = "amll",
	Toxi = "toxi",
	Spicy = "spicy",
	Timing = "timing",
}

export const previewModeTypeAtom = atomWithStorage<PreviewModeType>(
	"previewModeType",
	PreviewModeType.Standard,
);

export const showTranslationLinesAtom = atomWithStorage(
	"showTranslationLines",
	false,
);
export const showRomanLinesAtom = atomWithStorage("showRomanLines", false);
export const hideObsceneWordsAtom = atomWithStorage("hideObsceneWords", false);
export const lyricWordFadeWidthAtom = atomWithStorage(
	"lyricWordFadeWidth",
	0.5,
);
export const vsyncAtom = atomWithStorage("vsync", false);
export const showFpsCounterAtom = atomWithStorage("showFpsCounter", false);
export const instantHighlightFadeAtom = atomWithStorage(
	"instantHighlightFade",
	false,
);
export const spicySimpleLyricsModeAtom = atomWithStorage(
	"spicySimpleLyricsMode",
	false,
);
export type SpicyBackgroundMode = "animated" | "color" | "static";
export const spicyBackgroundModeAtom = atomWithStorage<SpicyBackgroundMode>(
	"spicyBackgroundMode",
	"animated",
);
