// Syncing settings

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { atomWithMigratedStorage } from "./migrated-storage";

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
export const syncCommitOffsetAtom = atomWithStorage("syncCommitOffset", 0);
export const syncWordWrapAtom = atomWithStorage("syncWordWrap", true);
export const syncFocusMainLineAtom = atomWithStorage("syncFocusMainLine", true);
export const syncAutoScrollAtom = atomWithStorage(
	"syncAutoScroll",
	true,
	undefined,
	{ getOnInit: true },
);
export const editAutoScrollAtom = atomWithMigratedStorage<boolean>(
	"editAutoScroll",
	true,
	{ legacyKey: "syncAutoScroll" },
);
export const editActiveLineHighlightAtom = atomWithStorage(
	"editActiveLineHighlight",
	false,
	undefined,
	{ getOnInit: true },
);
export const syncActiveLineHighlightAtom = atomWithMigratedStorage<boolean>(
	"syncActiveLineHighlight",
	false,
	{ legacyKey: "editActiveLineHighlight" },
);
export const timingOverviewAutoScrollAtom = atomWithStorage(
	"timingOverviewAutoScroll",
	false,
);
export type TimingOverviewOrderMode = "chronological" | "textual";
export const timingOverviewOrderModeAtom =
	atomWithStorage<TimingOverviewOrderMode>(
		"timingOverviewOrderMode",
		"chronological",
	);
export const spectrogramHoverSyncEnabledAtom = atomWithStorage(
	"spectrogramHoverSyncEnabled",
	false,
);
export const syncTabPositionAtom = atomWithStorage(
	"syncTabPosition",
	true,
	undefined,
	{ getOnInit: true },
);
export const editTabPositionAtom = atomWithMigratedStorage<boolean>(
	"editTabPosition",
	true,
	{ legacyKey: "syncTabPosition" },
);

export type SyncLevelMode = "word" | "line";
export const syncLevelModeAtom = atomWithStorage<SyncLevelMode>(
	"syncLevelMode",
	"word",
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
