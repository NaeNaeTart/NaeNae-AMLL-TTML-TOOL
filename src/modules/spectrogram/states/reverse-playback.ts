import { atom } from "jotai";

export type ReversePlaybackZone = {
	start: number;
	end: number;
	lineIds: string[];
	status: "ready" | "completed";
	mirrored: boolean;
};

export const reversePlaybackStartAtom = atom<number | null>(null);
export const reversePlaybackZoneAtom = atom<ReversePlaybackZone | null>(null);
