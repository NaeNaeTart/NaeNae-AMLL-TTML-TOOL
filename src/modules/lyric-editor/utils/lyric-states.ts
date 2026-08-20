import { type createStore, useAtomValue } from "jotai";
import { useMemo } from "react";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main.ts";
import type { LyricLine, LyricWord, LyricWordBase } from "$/types/ttml";

export interface LineLocationResult {
	lines: LyricLine[];
	line: LyricLine;
	lineIndex: number;
}

export interface LineAndWordLocationResult extends LineLocationResult {
	word: LyricWord;
	wordIndex: number;
	rubyIndex?: number;
	rubyWord?: LyricWordBase;
	syncIndex: number;
	syncId: string;
	isFirstWord: boolean;
	isLastWord: boolean;
}

export interface SyncWordUnit {
	id: string;
	word: LyricWord;
	wordIndex: number;
	rubyIndex?: number;
	rubyWord?: LyricWordBase;
}

export const buildRubySelectionId = (wordId: string, rubyIndex: number) =>
	`${wordId}-ruby-${rubyIndex}`;

export const parseRubySelectionId = (id: string) => {
	const match = id.match(/^(.*)-ruby-(\d+)$/);
	if (!match) return;
	return {
		wordId: match[1],
		rubyIndex: Number.parseInt(match[2], 10),
	};
};

export const getSyncUnitsForLine = (line: LyricLine): SyncWordUnit[] =>
	line.words.flatMap((word, wordIndex) => {
		if (word.ruby && word.ruby.length > 0) {
			return word.ruby.map((rubyWord, rubyIndex) => ({
				id: buildRubySelectionId(word.id, rubyIndex),
				word,
				wordIndex,
				rubyIndex,
				rubyWord,
			}));
		}
		return [
			{
				id: word.id,
				word,
				wordIndex,
			},
		];
	});

export const getSynchronizableUnits = (line: LyricLine) =>
	getSyncUnitsForLine(line).filter((unit) => {
		const text = unit.rubyWord?.word ?? unit.word.word;
		return text.trim().length > 0;
	});

export const getFirstSynchronizableUnit = (line: LyricLine) =>
	getSynchronizableUnits(line)[0];

export const getLastSynchronizableUnit = (line: LyricLine) => {
	const units = getSynchronizableUnits(line);
	return units[units.length - 1];
};

export function getCurrentLineLocation(
	store: ReturnType<typeof createStore>,
): LineLocationResult | undefined {
	const lyricLines = store.get(lyricLinesAtom).lyricLines;
	const selectedLineId = [...store.get(selectedLinesAtom)][0];
	if (!selectedLineId) return;
	const lyricLine = lyricLines.findIndex((line) => line.id === selectedLineId);
	if (lyricLine === -1) return;
	return {
		lines: lyricLines,
		line: lyricLines[lyricLine],
		lineIndex: lyricLine,
	};
}

export function getCurrentLocation(
	store: ReturnType<typeof createStore>,
): LineAndWordLocationResult | undefined {
	const lyricLines = store.get(lyricLinesAtom).lyricLines;
	const selectedLineId = [...store.get(selectedLinesAtom)][0];
	if (!selectedLineId) return;
	const lyricLine = lyricLines.findIndex((line) => line.id === selectedLineId);
	if (lyricLine === -1) return;
	const selectedWordId = [...store.get(selectedWordsAtom)][0];
	if (!selectedWordId) return;
	const line = lyricLines[lyricLine];
	const syncUnits = getSynchronizableUnits(line);
	let syncIndex = syncUnits.findIndex((unit) => unit.id === selectedWordId);
	if (syncIndex === -1) {
		const parsed = parseRubySelectionId(selectedWordId);
		if (parsed) {
			syncIndex = syncUnits.findIndex(
				(unit) =>
					unit.word.id === parsed.wordId && unit.rubyIndex === parsed.rubyIndex,
			);
		} else {
			syncIndex = syncUnits.findIndex(
				(unit) => unit.word.id === selectedWordId,
			);
		}
	}
	if (syncIndex === -1) return;
	const targetUnit = syncUnits[syncIndex];
	if (!targetUnit) return;
	const isFirstWord = syncIndex === 0;
	const isLastWord = syncIndex === syncUnits.length - 1;
	return {
		lines: lyricLines,
		line,
		lineIndex: lyricLine,
		word: targetUnit.word,
		wordIndex: targetUnit.wordIndex,
		rubyIndex: targetUnit.rubyIndex,
		rubyWord: targetUnit.rubyWord,
		syncIndex,
		syncId: targetUnit.id,
		isFirstWord,
		isLastWord,
	};
}

export function useCurrentLocation(): LineAndWordLocationResult | undefined {
	const lyrics = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const selectedWords = useAtomValue(selectedWordsAtom);
	const result = useMemo(() => {
		const lyricLine = lyrics.lyricLines.findIndex((line) =>
			selectedLines.has(line.id),
		);
		if (lyricLine === -1) return;
		const line = lyrics.lyricLines[lyricLine];
		const syncUnits = getSynchronizableUnits(line);
		let syncIndex = syncUnits.findIndex((unit) => selectedWords.has(unit.id));
		if (syncIndex === -1) {
			const selectedWordId = [...selectedWords][0];
			if (!selectedWordId) return;
			const parsed = parseRubySelectionId(selectedWordId);
			if (parsed) {
				syncIndex = syncUnits.findIndex(
					(unit) =>
						unit.word.id === parsed.wordId &&
						unit.rubyIndex === parsed.rubyIndex,
				);
			} else {
				syncIndex = syncUnits.findIndex(
					(unit) => unit.word.id === selectedWordId,
				);
			}
		}
		if (syncIndex === -1) return;
		const targetUnit = syncUnits[syncIndex];
		if (!targetUnit) return;
		const isFirstWord = syncIndex === 0;
		const isLastWord = syncIndex === syncUnits.length - 1;
		return {
			lines: lyrics.lyricLines,
			line,
			lineIndex: lyricLine,
			word: targetUnit.word,
			wordIndex: targetUnit.wordIndex,
			rubyIndex: targetUnit.rubyIndex,
			rubyWord: targetUnit.rubyWord,
			syncIndex,
			syncId: targetUnit.id,
			isFirstWord,
			isLastWord,
		};
	}, [lyrics, selectedLines, selectedWords]);
	return result;
}

export const isSynchronizableLine = (line: LyricLine) => !line.ignoreSync;

export function findNextWord(
	lyricLines: LyricLine[],
	lineIndex: number,
	syncIndex: number,
):
	| {
			unit: SyncWordUnit;
			line: LyricLine;
			lineIndex: number;
			syncIndex: number;
	  }
	| undefined {
	const line = lyricLines[lineIndex];
	if (!line) return;
	const units = getSynchronizableUnits(line);
	const nextUnit = units[syncIndex + 1];
	if (nextUnit) {
		return {
			line,
			lineIndex,
			unit: nextUnit,
			syncIndex: syncIndex + 1,
		};
	}
	let absoluteIndex = -1;
	for (let i = lineIndex + 1; i < lyricLines.length; i++) {
		const nextLine = lyricLines[i];
		if (
			isSynchronizableLine(nextLine) &&
			getSynchronizableUnits(nextLine).length > 0
		) {
			absoluteIndex = i;
			break;
		}
	}

	if (absoluteIndex === -1) return;
	const nextLine = lyricLines[absoluteIndex];
	const nextLineUnits = getSynchronizableUnits(nextLine);
	const firstUnit = nextLineUnits[0];
	if (!firstUnit) return;
	return {
		line: nextLine,
		lineIndex: absoluteIndex,
		unit: firstUnit,
		syncIndex: 0,
	};
}

interface SyncTargetResult {
	unit: SyncWordUnit;
	line: LyricLine;
	lineIndex: number;
	syncIndex: number;
}

/**
 * Returns the entry unit a line should be selected on when the sync
 * workflow (auto-)navigates into it: the last synchronizable unit for
 * lines flagged for reverse sync order, the first one otherwise.
 */
export function getLineSyncEntryUnit(
	line: LyricLine,
	isReverseSync: boolean,
): SyncWordUnit | undefined {
	const units = getSynchronizableUnits(line);
	if (units.length === 0) return undefined;
	return isReverseSync ? units[units.length - 1] : units[0];
}

function findNextSynchronizableLine(
	lyricLines: LyricLine[],
	fromLineIndex: number,
): { line: LyricLine; lineIndex: number } | undefined {
	for (let i = fromLineIndex; i < lyricLines.length; i++) {
		const candidate = lyricLines[i];
		if (
			isSynchronizableLine(candidate) &&
			getSynchronizableUnits(candidate).length > 0
		) {
			return { line: candidate, lineIndex: i };
		}
	}
	return undefined;
}

function findPrevSynchronizableLine(
	lyricLines: LyricLine[],
	fromLineIndex: number,
): { line: LyricLine; lineIndex: number } | undefined {
	for (let i = fromLineIndex; i >= 0; i--) {
		const candidate = lyricLines[i];
		if (
			isSynchronizableLine(candidate) &&
			getSynchronizableUnits(candidate).length > 0
		) {
			return { line: candidate, lineIndex: i };
		}
	}
	return undefined;
}

/**
 * Returns the unit that comes "next" in the global sync sequence, honoring
 * per-line reverse sync order. Within a reverse-flagged line, the sequence
 * walks from the last word to the first; once that line is exhausted, it
 * continues forward into the next synchronizable line, entering that line
 * at its own reverse-aware starting unit (so reverse-flagged lines are
 * entered at their last word, not their first).
 */
export function findNextSyncTarget(
	lyricLines: LyricLine[],
	lineIndex: number,
	syncIndex: number,
	isReverseSync: boolean,
	reverseSyncLineIds: ReadonlySet<string>,
): SyncTargetResult | undefined {
	const line = lyricLines[lineIndex];
	if (!line) return;
	const units = getSynchronizableUnits(line);
	const withinLineIndex = isReverseSync ? syncIndex - 1 : syncIndex + 1;
	const withinLineUnit = units[withinLineIndex];
	if (withinLineUnit) {
		return {
			line,
			lineIndex,
			unit: withinLineUnit,
			syncIndex: withinLineIndex,
		};
	}

	const nextLine = findNextSynchronizableLine(lyricLines, lineIndex + 1);
	if (!nextLine) return;
	const nextLineUnits = getSynchronizableUnits(nextLine.line);
	const nextLineIsReverse = reverseSyncLineIds.has(nextLine.line.id);
	const entryIndex = nextLineIsReverse ? nextLineUnits.length - 1 : 0;
	const entryUnit = nextLineUnits[entryIndex];
	if (!entryUnit) return;
	return {
		line: nextLine.line,
		lineIndex: nextLine.lineIndex,
		unit: entryUnit,
		syncIndex: entryIndex,
	};
}

/**
 * Mirror of {@link findNextSyncTarget} for moving backward through the
 * global sync sequence.
 */
export function findPrevSyncTarget(
	lyricLines: LyricLine[],
	lineIndex: number,
	syncIndex: number,
	isReverseSync: boolean,
	reverseSyncLineIds: ReadonlySet<string>,
): SyncTargetResult | undefined {
	const line = lyricLines[lineIndex];
	if (!line) return;
	const units = getSynchronizableUnits(line);
	const withinLineIndex = isReverseSync ? syncIndex + 1 : syncIndex - 1;
	const withinLineUnit = units[withinLineIndex];
	if (withinLineUnit) {
		return {
			line,
			lineIndex,
			unit: withinLineUnit,
			syncIndex: withinLineIndex,
		};
	}

	const prevLine = findPrevSynchronizableLine(lyricLines, lineIndex - 1);
	if (!prevLine) return;
	const prevLineUnits = getSynchronizableUnits(prevLine.line);
	const prevLineIsReverse = reverseSyncLineIds.has(prevLine.line.id);
	const entryIndex = prevLineIsReverse ? 0 : prevLineUnits.length - 1;
	const entryUnit = prevLineUnits[entryIndex];
	if (!entryUnit) return;
	return {
		line: prevLine.line,
		lineIndex: prevLine.lineIndex,
		unit: entryUnit,
		syncIndex: entryIndex,
	};
}
