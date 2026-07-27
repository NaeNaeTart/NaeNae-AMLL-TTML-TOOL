import type { LyricLine, LyricSection } from "$/types/ttml.ts";
import { getSectionHeader } from "./section-system.ts";

/** Returns a normalized, display-ready Genius section label, if this is one. */
export function getGeniusHeader(value: string): string | undefined {
	return getSectionHeader(value);
}

export function getSectionBounds(lines: LyricLine[], lineIndex: number) {
	const target = lines[lineIndex];
	const key = target?.sectionId ?? target?.geniusHeader;
	if (!key) return undefined;

	let start = lineIndex;
	while (
		start > 0 &&
		(lines[start - 1].sectionId ?? lines[start - 1].geniusHeader) === key
	)
		start--;

	let end = lineIndex + 1;
	while (
		end < lines.length &&
		(lines[end].sectionId ?? lines[end].geniusHeader) === key
	)
		end++;

	return {
		header: target.geniusHeader,
		sectionId: target.sectionId,
		start,
		end,
	};
}

export function findPreviousMatchingSection(
	lines: LyricLine[],
	lineIndex: number,
	sections: LyricSection[] = [],
) {
	const current = getSectionBounds(lines, lineIndex);
	if (!current) return undefined;
	const sectionMap = new Map(sections.map((section) => [section.id, section]));
	const currentSection = current.sectionId
		? sectionMap.get(current.sectionId)
		: undefined;

	for (let index = current.start - 1; index >= 0; ) {
		const candidate = getSectionBounds(lines, index);
		if (!candidate) {
			index--;
			continue;
		}
		if (
			((currentSection &&
				candidate.sectionId &&
				((!!currentSection.repeatGroupId &&
					sectionMap.get(candidate.sectionId)?.repeatGroupId ===
						currentSection.repeatGroupId) ||
					sectionMap.get(candidate.sectionId)?.label ===
						currentSection.label)) ||
				(!currentSection && candidate.header === current.header)) &&
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
	const normalizeLine = (line: LyricLine) =>
		line.words
			.map((word) => word.word)
			.join(" ")
			.normalize("NFKC")
			.toLocaleLowerCase()
			.replace(/[^\p{L}\p{N}]+/gu, " ")
			.trim();
	const sourceByText = new Map<string, LyricLine[]>();
	for (let index = source.start; index < source.end; index++) {
		const sourceLine = lines[index];
		const text = normalizeLine(sourceLine);
		if (!text) continue;
		const matches = sourceByText.get(text) ?? [];
		matches.push(sourceLine);
		sourceByText.set(text, matches);
	}
	let copiedLineCount = 0;
	for (let index = target.start; index < target.end; index++) {
		const targetLine = lines[index];
		const matches = sourceByText.get(normalizeLine(targetLine));
		const sourceLine = matches?.shift();
		if (!sourceLine) continue;
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
		copiedLineCount++;
	}

	return {
		copiedLineCount,
		lengthsMatch: target.end - target.start === source.end - source.start,
	};
}
