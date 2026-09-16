import type { LyricWord } from "$/types/ttml";

export interface WordGroupProps {
	words: LyricWord[];
	currentTime: number;
	onWordClick?: (word: LyricWord) => void;
}

export const areWordGroupPropsEqual = (
	prev: WordGroupProps,
	next: WordGroupProps,
): boolean => {
	const wasAnyActive = prev.words.some(
		(w) => prev.currentTime >= w.startTime && prev.currentTime <= w.endTime,
	);
	const isAnyActive = next.words.some(
		(w) => next.currentTime >= w.startTime && next.currentTime <= w.endTime,
	);

	if (wasAnyActive || isAnyActive) return false;
	if (prev.words.length !== next.words.length) return false;
	for (let i = 0; i < prev.words.length; i++) {
		if (prev.words[i] !== next.words[i]) return false;
	}
	return prev.onWordClick === next.onWordClick;
};
