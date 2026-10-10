const MAX_EXTRAPOLATION_SECONDS = 0.25;

export class MediaTimeInterpolator {
	private lastMediaTime = 0;
	private lastPerformanceTime = 0;
	private initialized = false;

	reset(mediaTime: number, performanceTime: number) {
		this.lastMediaTime = mediaTime;
		this.lastPerformanceTime = performanceTime;
		this.initialized = true;
	}

	sample(
		mediaTime: number,
		performanceTime: number,
		playbackRate: number,
		canExtrapolate: boolean,
	) {
		if (
			!this.initialized ||
			!canExtrapolate ||
			mediaTime !== this.lastMediaTime
		) {
			this.reset(mediaTime, performanceTime);
			return mediaTime;
		}

		const elapsed =
			Math.max(0, performanceTime - this.lastPerformanceTime) / 1000;
		const extrapolatedElapsed = Math.min(elapsed, MAX_EXTRAPOLATION_SECONDS);
		return mediaTime + extrapolatedElapsed * playbackRate;
	}
}
