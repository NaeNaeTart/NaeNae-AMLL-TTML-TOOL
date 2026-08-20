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
	true,
);
export const spicySimpleLyricsModeAtom = atomWithStorage(
	"spicySimpleLyricsMode",
	false,
);
export const spicyForceLineSyncedAtom = atomWithStorage(
	"spicyForceLineSynced",
	false,
);
export type SpicyBackgroundMode = "animated" | "color" | "static";
export const spicyBackgroundModeAtom = atomWithStorage<SpicyBackgroundMode>(
	"spicyBackgroundMode",
	"animated",
);

export const previewFollowsPlaybackAtom = atomWithStorage(
	"previewFollowsPlayback",
	true,
);

/** All fork-specific feature flags. Each defaults to true (fully enabled). */
export interface ForkFeatureFlags {
	folderProjects: boolean;
	dualFormatSupport: boolean;
	lyricsfileEngine: boolean;
	hoverSync: boolean;
	reversePlayback: boolean;
}

export const FORK_FEATURE_FLAG_DEFAULTS: ForkFeatureFlags = {
	folderProjects: true,
	dualFormatSupport: true,
	lyricsfileEngine: true,
	hoverSync: true,
	reversePlayback: true,
};

export const featureFlagsAtom = atomWithStorage<ForkFeatureFlags>(
	"featureFlags",
	FORK_FEATURE_FLAG_DEFAULTS,
);

/**
 * Persistent list of feature flag display labels that require an app restart.
 * Each entry is a human-readable label like "Folder Projects".
 * Cleared automatically on app startup once changes have taken effect.
 */
export const pendingRestartFlagsAtom = atomWithStorage<string[]>(
	"pendingRestartFlags",
	[],
);
