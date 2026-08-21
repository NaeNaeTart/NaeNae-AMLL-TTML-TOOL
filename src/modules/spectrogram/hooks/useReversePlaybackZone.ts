import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	cmdReversePlaybackEnd,
	cmdReversePlaybackStart,
} from "$/modules/keyboard/commands";
import { useCommand } from "$/modules/keyboard/hooks";
import {
	reversePlaybackEnabledAtom,
	reverseSyncLineIdsAtom,
} from "$/modules/settings/states/sync";
import {
	spectrogramContainerWidthAtom,
	spectrogramHoverTimeMsAtom,
	spectrogramIsHoveringAtom,
	spectrogramScrollLeftAtom,
	spectrogramZoomAtom,
} from "$/modules/spectrogram/states";
import {
	reversePlaybackStartAtom,
	reversePlaybackZoneAtom,
} from "$/modules/spectrogram/states/reverse-playback";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";
import type { LyricLine } from "$/types/ttml";

const mirrorTime = (time: number, start: number, end: number) =>
	start + end - time;

const mirrorLineTiming = (line: LyricLine, start: number, end: number) => {
	const mirrorRange = (rangeStart: number, rangeEnd: number) => {
		if (rangeStart < start || rangeEnd > end || rangeEnd < rangeStart) {
			return { start: rangeStart, end: rangeEnd };
		}
		return {
			start: mirrorTime(rangeEnd, start, end),
			end: mirrorTime(rangeStart, start, end),
		};
	};
	const lineRange = mirrorRange(line.startTime, line.endTime);
	return {
		...line,
		startTime: lineRange.start,
		endTime: lineRange.end,
		words: line.words.map((word) => {
			const wordRange = mirrorRange(word.startTime, word.endTime);
			return {
				...word,
				startTime: wordRange.start,
				endTime: wordRange.end,
				ruby: word.ruby?.map((ruby) => {
					const rubyRange = mirrorRange(ruby.startTime, ruby.endTime);
					return {
						...ruby,
						startTime: rubyRange.start,
						endTime: rubyRange.end,
					};
				}),
			};
		}),
	};
};

export function useReversePlaybackZone() {
	const store = useStore();
	const reverseZone = useAtomValue(reversePlaybackZoneAtom);
	const setReverseStart = useSetAtom(reversePlaybackStartAtom);
	const setReverseZone = useSetAtom(reversePlaybackZoneAtom);

	const completeZone = useCallback(
		(start: number, end: number, lineIds: string[]) => {
			store.set(lyricLinesAtom, (state) => ({
				...state,
				lyricLines: state.lyricLines.map((line) =>
					lineIds.includes(line.id) ? mirrorLineTiming(line, start, end) : line,
				),
			}));
			setReverseZone((zone) =>
				zone ? { ...zone, status: "completed" } : null,
			);
			audioEngine.seekMusic(start / 1000);

			const zoom = store.get(spectrogramZoomAtom);
			const currentScroll = store.get(spectrogramScrollLeftAtom);
			const containerWidth = store.get(spectrogramContainerWidthAtom);
			const zoneStartPx = (start / 1000) * zoom;
			const zoneEndPx = (end / 1000) * zoom;
			const isVisible =
				zoneStartPx < currentScroll + containerWidth &&
				zoneEndPx > currentScroll;
			if (!isVisible) {
				const centerPx = (zoneStartPx + zoneEndPx) / 2;
				const newScroll = Math.max(0, centerPx - containerWidth / 2);
				store.set(spectrogramScrollLeftAtom, newScroll);
			}
		},
		[setReverseZone, store],
	);

	const cancelZone = useCallback(() => {
		audioEngine.stopReversePlayback();
		const zone = store.get(reversePlaybackZoneAtom);
		if (zone && zone.status === "playing") {
			store.set(lyricLinesAtom, (state) => ({
				...state,
				lyricLines: state.lyricLines.map((line) =>
					zone.lineIds.includes(line.id)
						? mirrorLineTiming(line, zone.start, zone.end)
						: line,
				),
			}));
		}
		setReverseStart(null);
		setReverseZone(null);
	}, [setReverseStart, setReverseZone, store]);

	const markStart = useCallback(() => {
		if (!store.get(reversePlaybackEnabledAtom)) return;
		if (!store.get(spectrogramIsHoveringAtom)) return;
		setReverseStart(
			Math.max(0, Math.round(store.get(spectrogramHoverTimeMsAtom))),
		);
	}, [setReverseStart, store]);

	const startPlayback = useCallback(() => {
		if (!store.get(reversePlaybackEnabledAtom)) return;
		if (!store.get(spectrogramIsHoveringAtom)) return;
		const start = store.get(reversePlaybackStartAtom);
		const end = Math.max(0, Math.round(store.get(spectrogramHoverTimeMsAtom)));
		if (start === null || end - start < 10) return;

		const selectedLineIds = [...store.get(selectedLinesAtom)];
		const reverseLineIds = store.get(reverseSyncLineIdsAtom);
		const lineIds = selectedLineIds.filter((lineId) =>
			reverseLineIds.has(lineId),
		);

		setReverseStart(null);
		setReverseZone({ start, end, lineIds, status: "playing" });
		void audioEngine.playReversedRange(start / 1000, end / 1000, () =>
			completeZone(start, end, lineIds),
		);
	}, [completeZone, setReverseStart, setReverseZone, store]);

	useCommand(cmdReversePlaybackStart, markStart, [markStart]);
	useCommand(cmdReversePlaybackEnd, startPlayback, [startPlayback]);

	return { reverseZone, cancelZone };
}
