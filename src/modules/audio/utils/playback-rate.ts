export const MIN_PLAYBACK_RATE = 0.1;
export const MAX_PLAYBACK_RATE = 2;

export function clampPlaybackRate(value: number): number {
	return Number.isFinite(value)
		? Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, value))
		: 1;
}

export function stepPlaybackRate(value: number, direction: 1 | -1): number {
	return clampPlaybackRate(Math.round((value + direction * 0.25) * 100) / 100);
}
