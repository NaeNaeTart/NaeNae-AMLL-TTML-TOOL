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
