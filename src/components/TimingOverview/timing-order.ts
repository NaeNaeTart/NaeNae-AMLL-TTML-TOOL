import type { TimingOverviewOrderMode } from "$/modules/settings/states/sync";
import type { LyricLine } from "$/types/ttml";

export function getDisplayedTimingLines(
	lines: LyricLine[],
	mode: TimingOverviewOrderMode,
): LyricLine[] {
	if (mode === "textual") {
		return lines;
	}
	return [...lines].sort((a, b) => a.startTime - b.startTime);
}

export function calculateTimingOverviewStats(lines: LyricLine[]) {
	const lineCount = lines.length;
	const wordCount = lines.reduce((acc, line) => acc + line.words.length, 0);
	let maxEnd = 0;
	let minStart = Infinity;
	for (const line of lines) {
		if (line.endTime > maxEnd) maxEnd = line.endTime;
		if (line.startTime < minStart && (line.startTime > 0 || line.endTime > 0)) {
			minStart = line.startTime;
		}
	}
	const totalMs =
		maxEnd > 0 && minStart !== Infinity
			? Math.max(0, maxEnd - minStart)
			: maxEnd;
	return { lineCount, wordCount, totalMs };
}

export function findActiveTimingLine(
	lines: LyricLine[],
	currentTime: number,
): LyricLine | undefined {
	if (currentTime < 0 || !Number.isFinite(currentTime)) return undefined;

	let activeLine: LyricLine | undefined;
	let upcomingLine: LyricLine | undefined;
	let lastTimedLine: LyricLine | undefined;

	for (const line of lines) {
		const isTimed = line.startTime > 0 || line.endTime > 0;
		if (!isTimed) continue;

		// 1. Line actively playing at currentTime
		if (currentTime >= line.startTime && currentTime <= line.endTime) {
			if (!activeLine || line.startTime < activeLine.startTime) {
				activeLine = line;
			}
		}

		if (currentTime > 0) {
			// 2. Upcoming line during a playback gap (earliest start time >= currentTime)
			if (line.startTime >= currentTime) {
				if (!upcomingLine || line.startTime < upcomingLine.startTime) {
					upcomingLine = line;
				}
			}

			// 3. Track latest line by timestamp for fallback
			if (
				!lastTimedLine ||
				line.startTime > lastTimedLine.startTime ||
				(line.startTime === lastTimedLine.startTime &&
					line.endTime > lastTimedLine.endTime)
			) {
				lastTimedLine = line;
			}
		}
	}

	if (activeLine) return activeLine;
	if (upcomingLine) return upcomingLine;
	if (lastTimedLine && currentTime <= lastTimedLine.endTime) {
		return lastTimedLine;
	}

	return undefined;
}

export function findActiveTimingLineIndex(
	displayedLines: LyricLine[],
	currentTime: number,
): number {
	const activeLine = findActiveTimingLine(displayedLines, currentTime);
	if (!activeLine) return -1;
	return displayedLines.indexOf(activeLine);
}
