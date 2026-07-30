import { atom } from "jotai";

export const draggingIdAtom = atom("");
export const lineDragAtom = atom<{
	id: string;
	pointerId: number;
	startX: number;
	startY: number;
	isDragging: boolean;
} | null>(null);
export const globalEnableInsertAtom = atom(false);
