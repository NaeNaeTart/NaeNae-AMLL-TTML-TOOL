import { atomWithStorage } from "jotai/utils";

export const combineWordsApplyToAllAtom = atomWithStorage(
	"lyricEditor.combineWords.applyToAll",
	false,
);

export const combineWordsIgnoreCaseAtom = atomWithStorage(
	"lyricEditor.combineWords.ignoreCase",
	true,
);
