import type { TTMLLyric } from "$/types/ttml";
import { msToTimestamp, parseTimespan } from "$/utils/timestamp";

export const parseDurationInput = (value: string): number | null => {
	const trimmed = value.trim();
	if (!trimmed) return null;

	try {
		const duration = parseTimespan(trimmed);
		return Number.isFinite(duration) && duration >= 0 ? duration : null;
	} catch {
		return null;
	}
};

export const formatDurationInput = (durationMs: number): string =>
	msToTimestamp(durationMs);

const scaleTimestamp = (timestamp: number, factor: number): number =>
	Math.max(0, Math.round(timestamp * factor));

export const scaleTTMLTimings = (lyrics: TTMLLyric, factor: number): void => {
	if (!Number.isFinite(factor) || factor <= 0) {
		throw new RangeError(
			"Time stretch factor must be a positive finite number",
		);
	}

	for (const line of lyrics.lyricLines) {
		line.startTime = scaleTimestamp(line.startTime, factor);
		line.endTime = scaleTimestamp(line.endTime, factor);

		if (line.endTimeLink) {
			line.endTimeLink.originalEndTime = scaleTimestamp(
				line.endTimeLink.originalEndTime,
				factor,
			);
			if (line.endTimeLink.originalNextStartTime !== null) {
				line.endTimeLink.originalNextStartTime = scaleTimestamp(
					line.endTimeLink.originalNextStartTime,
					factor,
				);
			}
		}

		for (const word of line.words) {
			word.startTime = scaleTimestamp(word.startTime, factor);
			word.endTime = scaleTimestamp(word.endTime, factor);

			for (const rubyWord of word.ruby ?? []) {
				rubyWord.startTime = scaleTimestamp(rubyWord.startTime, factor);
				rubyWord.endTime = scaleTimestamp(rubyWord.endTime, factor);
			}
		}
	}

	for (const mark of lyrics.marks ?? []) {
		mark.timeMs = scaleTimestamp(mark.timeMs, factor);
	}
};

export const readAudioDurationMs = (file: Blob): Promise<number> =>
	new Promise((resolve, reject) => {
		const audio = document.createElement("audio");
		const objectUrl = URL.createObjectURL(file);

		const cleanup = () => {
			audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
			audio.removeEventListener("error", handleError);
			audio.removeAttribute("src");
			audio.load();
			URL.revokeObjectURL(objectUrl);
		};

		const handleLoadedMetadata = () => {
			const durationMs = Math.round(audio.duration * 1000);
			cleanup();
			if (!Number.isFinite(durationMs) || durationMs <= 0) {
				reject(new Error("Audio file has no readable duration"));
				return;
			}
			resolve(durationMs);
		};

		const handleError = () => {
			cleanup();
			reject(new Error("Unable to read audio metadata"));
		};

		audio.preload = "metadata";
		audio.addEventListener("loadedmetadata", handleLoadedMetadata, {
			once: true,
		});
		audio.addEventListener("error", handleError, { once: true });
		audio.src = objectUrl;
	});
