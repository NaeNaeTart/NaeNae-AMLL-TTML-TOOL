import { SyncJudgeMode } from "$/modules/settings/states";

export function calculateJudgeTime({
	playheadSeconds,
	playing,
	rate,
	processingDelay,
	downTimeOffset,
	syncOffset,
	mode,
}: {
	playheadSeconds: number;
	playing: boolean;
	rate: number;
	processingDelay: number;
	downTimeOffset: number;
	syncOffset: number;
	mode: SyncJudgeMode;
}) {
	const playhead = playheadSeconds * 1000;
	// A stationary playhead has no event-processing or key-hold delay to compensate.
	if (!playing) return Math.round(Math.max(0, playhead + syncOffset));
	const audioTime = playhead - processingDelay * rate;
	let adjustment = 0;
	switch (mode) {
		case SyncJudgeMode.FirstKeyDownTimeLegacy:
			adjustment = -downTimeOffset;
			break;
		case SyncJudgeMode.FirstKeyDownTime:
			adjustment = -downTimeOffset * rate;
			break;
		case SyncJudgeMode.MiddleKeyTime:
			adjustment = (-downTimeOffset * rate) / 2;
			break;
		case SyncJudgeMode.LastKeyUpTime:
			break;
	}
	return Math.round(Math.max(0, audioTime + adjustment + syncOffset));
}
