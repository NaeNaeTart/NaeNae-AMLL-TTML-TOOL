/** Utilities for user-learned word splits. */

const BOUNDARY_PUNCTUATION_OR_SYMBOL = /^[\p{P}\p{S}]$/u;

export interface LearnedWordParts {
	key: string;
	chars: string[];
	coreStart: number;
	coreEnd: number;
}

/**
 * Finds the semantic word inside a token. Unicode punctuation and symbols on
 * either edge are intentionally excluded so `“Hello?”` learns the same rule
 * as `hello` without changing the text the editor emits.
 */
export function getLearnedWordParts(text: string): LearnedWordParts | null {
	const chars = Array.from(text);
	let coreStart = 0;
	let coreEnd = chars.length;

	while (
		coreStart < coreEnd &&
		BOUNDARY_PUNCTUATION_OR_SYMBOL.test(chars[coreStart])
	) {
		coreStart++;
	}
	while (
		coreEnd > coreStart &&
		BOUNDARY_PUNCTUATION_OR_SYMBOL.test(chars[coreEnd - 1])
	) {
		coreEnd--;
	}

	const core = chars.slice(coreStart, coreEnd).join("");
	if (!core) return null;

	return {
		key: core.normalize("NFC").toLowerCase(),
		chars,
		coreStart,
		coreEnd,
	};
}

export function createLearnedRule(
	text: string,
	splitIndices: Iterable<number>,
): { key: string; boundaries: number[] } | null {
	const parts = getLearnedWordParts(text);
	if (!parts) return null;

	const coreLength = parts.coreEnd - parts.coreStart;
	const boundaries = Array.from(
		new Set(
			Array.from(splitIndices)
				.map((index) => index - parts.coreStart)
				.filter((index) => index > 0 && index < coreLength),
		),
	).sort((a, b) => a - b);

	return { key: parts.key, boundaries };
}

/** Applies a learned boundary list while retaining the source token verbatim. */
export function applyLearnedRule(
	text: string,
	learnedRules: Map<string, number[]>,
): string[] | null {
	const parts = getLearnedWordParts(text);
	if (!parts) return null;
	const boundaries = learnedRules.get(parts.key);
	if (!boundaries) return null;

	const core = parts.chars.slice(parts.coreStart, parts.coreEnd);
	const validBoundaries = boundaries.filter(
		(index) => Number.isInteger(index) && index > 0 && index < core.length,
	);
	const segments: string[] = [];
	let start = 0;
	for (const end of validBoundaries) {
		segments.push(core.slice(start, end).join(""));
		start = end;
	}
	segments.push(core.slice(start).join(""));

	segments[0] = parts.chars.slice(0, parts.coreStart).join("") + segments[0];
	segments[segments.length - 1] += parts.chars.slice(parts.coreEnd).join("");
	return segments;
}
