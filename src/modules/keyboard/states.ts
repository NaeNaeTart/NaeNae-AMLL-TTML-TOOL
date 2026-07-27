import { atomWithStorage } from "jotai/utils";

export const autoSegmentDoublePressAtom = atomWithStorage(
	"keybindings.autoSegment.doublePress",
	true,
);
