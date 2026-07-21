import type { LyricLine } from "$/types/ttml.ts";

/** Returns a normalized, display-ready Genius section label, if this is one. */
export function getGeniusHeader(value: string): string | undefined {
	const trimmed = value.trim();
	return /^\[[^[\]\r\n]+\]$/.test(trimmed) ? trimmed : undefined;
}

export function getSectionBounds(lines: LyricLine[], lineIndex: number) {
	const header = lines[lineIndex]?.geniusHeader;
	if (!header) return undefined;

	let start = lineIndex;
	while (start > 0 && lines[start - 1].geniusHeader === header) start--;

	let end = lineIndex + 1;
	while (end < lines.length && lines[end].geniusHeader === header) end++;

	return { header, start, end };
}

export function findPreviousMatchingSection(
	lines: LyricLine[],
	lineIndex: number,
) {
	const current = getSectionBounds(lines, lineIndex);
	if (!current) return undefined;

	for (let index = current.start - 1; index >= 0; ) {
		const candidate = getSectionBounds(lines, index);
		if (!candidate) {
			index--;
			continue;
		}
		if (
			candidate.header === current.header &&
			lines[candidate.start].endTime > lines[candidate.start].startTime
		) {
			return candidate;
		}
		index = candidate.start - 1;
	}
}

export function shiftSectionToTime(
	lines: LyricLine[],
	lineIndex: number,
	targetStartTime: number,
) {
	const section = getSectionBounds(lines, lineIndex);
	if (!section) return false;
	const offset = targetStartTime - lines[section.start].startTime;

	for (let index = section.start; index < section.end; index++) {
		const line = lines[index];
		line.startTime += offset;
		line.endTime += offset;
		for (const word of line.words) {
			word.startTime += offset;
			word.endTime += offset;
		}
	}
	return true;
}

export function copySectionTimings(
	lines: LyricLine[],
	targetLineIndex: number,
	source: { start: number; end: number },
) {
	const target = getSectionBounds(lines, targetLineIndex);
	if (!target) return undefined;
	const copiedLineCount = Math.min(
		target.end - target.start,
		source.end - source.start,
	);

	for (let offset = 0; offset < copiedLineCount; offset++) {
		const targetLine = lines[target.start + offset];
		const sourceLine = lines[source.start + offset];
		targetLine.startTime = sourceLine.startTime;
		targetLine.endTime = sourceLine.endTime;
		for (
			let wordIndex = 0;
			wordIndex < Math.min(targetLine.words.length, sourceLine.words.length);
			wordIndex++
		) {
			targetLine.words[wordIndex].startTime =
				sourceLine.words[wordIndex].startTime;
			targetLine.words[wordIndex].endTime = sourceLine.words[wordIndex].endTime;
		}
	}

	return {
		copiedLineCount,
		lengthsMatch: target.end - target.start === source.end - source.start,
	};
}
