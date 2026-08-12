interface RomanizableWord {
	word: string;
	romanWord: string;
}

interface RomanizableLine {
	words: RomanizableWord[];
}

export interface ReplaceRomanizationOptions {
	lineIndex: number;
	wordIndex: number;
	targetWord: string;
	replacement: string;
	applyToAll: boolean;
	caseSensitive: boolean;
}

export const replaceRomanization = (
	lines: RomanizableLine[],
	options: ReplaceRomanizationOptions,
) => {
	const {
		lineIndex,
		wordIndex,
		targetWord,
		replacement,
		applyToAll,
		caseSensitive,
	} = options;

	if (!applyToAll) {
		const target = lines[lineIndex]?.words[wordIndex];
		if (target?.word === targetWord) target.romanWord = replacement;
		return;
	}

	const normalizedTarget = targetWord.toLocaleLowerCase();
	for (const line of lines) {
		for (const word of line.words) {
			const matches = caseSensitive
				? word.word === targetWord
				: word.word.toLocaleLowerCase() === normalizedTarget;
			if (matches) word.romanWord = replacement;
		}
	}
};
