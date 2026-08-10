import { atom } from "jotai";
import type { LineTimingSnapshot } from "../utils/line-timing";

export const draggingIdAtom = atom("");
export const lineDragAtom = atom<{
	id: string;
	pointerId: number;
	startX: number;
	startY: number;
	isDragging: boolean;
} | null>(null);
export const lastLineDragEndAtom = atom(0);
export const globalEnableInsertAtom = atom(false);
export const timingCopyPlacementAtom = atom<{
	sourceLineIds: string[];
	snapshots: LineTimingSnapshot[];
} | null>(null);
