export function getWordConnections(words: string[], index: number) {
	const isVisibleWord = (word: string | undefined): word is string =>
		word !== undefined && word.trim().length > 0;
	const hasWhitespaceBoundary = (left: string, right: string) =>
		/\s$/.test(left) || /^\s/.test(right);

	const current = words[index];
	if (!isVisibleWord(current)) return { previous: false, next: false };

	const previous = words[index - 1];
	const next = words[index + 1];

	return {
		previous:
			isVisibleWord(previous) && !hasWhitespaceBoundary(previous, current),
		next: isVisibleWord(next) && !hasWhitespaceBoundary(current, next),
	};
}
