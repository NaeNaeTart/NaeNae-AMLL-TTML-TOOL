/** Compare seconds; callers convert the editor's millisecond duration atom. */
export const matchesAudioDuration = (
	duration: number | undefined,
	audioDuration: number,
) =>
	Number.isFinite(duration) &&
	Number.isFinite(audioDuration) &&
	(duration ?? 0) > 0 &&
	audioDuration > 0 &&
	Math.abs((duration ?? 0) - audioDuration) <= 2;

export const prioritizeMatchingTracks = <T extends { duration?: number }>(
	tracks: T[],
	audioDuration: number,
) =>
	[...tracks].sort(
		(a, b) =>
			Number(matchesAudioDuration(b.duration, audioDuration)) -
			Number(matchesAudioDuration(a.duration, audioDuration)),
	);

export const formatTrackDuration = (duration: number) => {
	const seconds = Math.round(duration);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
