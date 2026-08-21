import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { LineTimingSnapshot } from "$/modules/lyric-editor/utils/line-timing";

export interface Callback<Args extends unknown[], Result = void> {
	onEmit?: (...args: Args) => Result;
}

const c = <Args extends unknown[], Result = void>(
	_onEmit: (...args: Args) => Result,
): Callback<Args, Result> => ({});

export const showTouchSyncPanelAtom = atomWithStorage("touchSyncPanel", false);
export const visualizeTimestampUpdateAtom = atomWithStorage(
	"visualizeTimestampUpdate",
	false,
);
export const enableTimeModeDoubleClickEditAtom = atomWithStorage(
	"enableTimeModeDoubleClickEdit",
	true,
);
export const syncTimeOffsetAtom = atomWithStorage("syncTimeOffset", 0);
export const syncFghToHoverAtom = atomWithStorage("syncFghToHover", true);
export const syncCommitOffsetAtom = atomWithStorage("syncCommitOffset", 0);

export type SyncLevelMode = "word" | "line";
export const syncLevelModeAtom = atomWithStorage<SyncLevelMode>(
	"syncLevelMode",
	"word",
);

export const reverseSyncLineIdsAtom = atom<Set<string>>(new Set<string>());

/**
 * VGZ — Global toggle for the Reverse Playback Zone feature.
 * When disabled the keyboard commands still fire but buildPlayback ignores them.
 */
export const reversePlaybackEnabledAtom = atomWithStorage(
	"reversePlaybackEnabled",
	true,
);

/**
 * Per-line timing snapshot captured right before "Reverse sync order" is
 * turned on for that line. If the user turns it back off, whatever timing
 * progress was made while it was on is discarded and this snapshot is
 * restored instead, so switching modes never leaves a line stranded with
 * timings committed under the other direction.
 */
export type ReverseSyncTimingBackupMap = Map<string, LineTimingSnapshot>;
export const reverseSyncTimingBackupAtom = atom<ReverseSyncTimingBackupMap>(
	new Map<string, LineTimingSnapshot>(),
);

export const enableUpcomingWordHighlightAtom = atomWithStorage(
	"enableUpcomingWordHighlight",
	false,
);
export const upcomingWordHighlightThresholdAtom = atomWithStorage(
	"upcomingWordHighlightThreshold",
	500,
);
export const upcomingWordHighlightColorAtom = atomWithStorage(
	"upcomingWordHighlightColor",
	"var(--green-9)",
);

export const currentEmptyBeatAtom = atom(0);
export const smartFirstWordActiveIdAtom = atom<string | null>(null);

export const callbackSyncStartAtom = atom(c(() => {}));
export const callbackSyncNextAtom = atom(c(() => {}));
export const callbackSyncEndAtom = atom(c(() => {}));
