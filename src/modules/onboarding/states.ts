import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const guideWelcomeOpenAtom = atom(false);
export const guidePanelOpenAtom = atom(false);
export const guideStepAtom = atom(0);
export const guideExportedAtom = atom(false);
export const guideCompletionAtom = atomWithStorage<
	"new" | "dismissed" | "completed"
>("beginnerGuideStatus", "new");
export const advancedRibbonControlsAtom = atomWithStorage(
	"advancedRibbonControls",
	false,
);
