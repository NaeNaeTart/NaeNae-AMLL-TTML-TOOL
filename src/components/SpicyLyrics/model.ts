import type { LyricLine, LyricWord } from "$/types/ttml";

export interface SpicyToken {
	id: string;
	text: string;
	startTime: number;
	endTime: number;
	letters?: string[];
	isBackground: boolean;
	spaceAfter?: boolean;
	breakAfter?: boolean;
	allowInternalWrap?: boolean;
}

export interface SpicyTokenLayoutItem {
	token: SpicyToken;
	wordIndex: number;
}

export interface SpicyWordGroup {
	items: SpicyTokenLayoutItem[];
	hasTrailingSpace: boolean;
}

export interface SpicyLine {
	id: string;
	startTime: number;
	endTime: number;
	isLineSynced: boolean;
	isRtl: boolean;
	text?: string;
	isBackground: boolean;
	isDuet: boolean;
	isDuetGroup: boolean;
	isMiddle: boolean;
	isDotLine?: boolean;
	translation?: string;
	words: SpicyToken[];
}

function isLineSynced(line: LyricLine) {
	return !!line.isLineSynced;
}

function lineText(line: LyricLine, romanized: boolean) {
	if (romanized && line.romanLyric?.trim()) return line.romanLyric;
	return line.words
		.map((word) =>
			romanized && word.romanWord.trim().length > 0
				? word.romanWord
				: word.word,
		)
		.join("");
}

export function isRtl(text: string) {
	for (const character of text) {
		if (/[\d\s,.;:?!()[\]{}"'\\/<>@#$%^&*_=+-]/u.test(character)) continue;
		return /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF]/u.test(
			character,
		);
	}
	return false;
}
const isCjk = (text: string) =>
	/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
		text,
	);
const graphemes = (text: string) => Array.from(text);
const valid = (start: number, end: number) =>
	Number.isFinite(start) && Number.isFinite(end) && end > start;

export function groupSpicyTokens(tokens: SpicyToken[]): SpicyWordGroup[] {
	const groups: SpicyWordGroup[] = [];
	let items: SpicyTokenLayoutItem[] = [];

	for (let wordIndex = 0; wordIndex < tokens.length; wordIndex++) {
		const token = tokens[wordIndex];
		items.push({ token, wordIndex });

		if (
			token.spaceAfter ||
			token.breakAfter ||
			wordIndex === tokens.length - 1
		) {
			groups.push({
				items,
				hasTrailingSpace: !!token.spaceAfter && wordIndex < tokens.length - 1,
			});
			items = [];
		}
	}

	return groups;
}

function makeToken(
	word: LyricWord,
	simple: boolean,
	romanized: boolean,
	background: boolean,
): SpicyToken {
	const usesRomanization = romanized && !!word.romanWord.trim();
	const text = usesRomanization ? word.romanWord : word.word;
	const letters = graphemes(text);
	const allowInternalWrap = usesRomanization || isCjk(word.word) || isCjk(text);
	const duration = word.endTime - word.startTime;
	const letterCapable =
		!isRtl(text) &&
		duration >= (simple ? 1050 : 1000) &&
		(!simple || letters.length <= 12);
	const emphasisStart = simple ? word.startTime + 21 : word.startTime;
	const emphasisEnd = simple ? word.endTime + 40 : word.endTime - 250;
	return {
		id: word.id,
		text,
		startTime: letterCapable ? emphasisStart : word.startTime,
		endTime:
			letterCapable && emphasisEnd > emphasisStart ? emphasisEnd : word.endTime,
		letters: letterCapable ? letters : undefined,
		isBackground: background,
		breakAfter: allowInternalWrap,
		allowInternalWrap,
	};
}

function makeTokens(
	words: LyricWord[],
	simple: boolean,
	romanized: boolean,
	background: boolean,
): SpicyToken[] {
	const tokens: SpicyToken[] = [];

	for (const word of words) {
		if (/^\s+$/u.test(word.word)) {
			const previous = tokens.at(-1);
			if (previous) previous.spaceAfter = true;
			continue;
		}

		if (valid(word.startTime, word.endTime))
			tokens.push(makeToken(word, simple, romanized, background));
	}

	return tokens;
}

function dotLine(
	startTime: number,
	endTime: number,
	id: string,
	isDuet: boolean,
	isRtl: boolean,
	isDuetGroup = false,
	isMiddle = false,
): SpicyLine {
	const total = endTime - startTime;
	const base = total / 3;
	const first = Math.max(startTime, startTime + base - 550 / 3);
	const second = Math.max(first, startTime + base * 2 - (550 * 2) / 3);
	const third = Math.max(second, endTime - 550);
	return {
		id,
		startTime,
		endTime,
		isLineSynced: false,
		isRtl,
		isBackground: false,
		isDuet,
		isDuetGroup,
		isMiddle,
		isDotLine: true,
		words: [
			{
				id: `${id}-0`,
				text: "•",
				startTime,
				endTime: first,
				isBackground: false,
			},
			{
				id: `${id}-1`,
				text: "•",
				startTime: first,
				endTime: second,
				isBackground: false,
			},
			{
				id: `${id}-2`,
				text: "•",
				startTime: second,
				endTime: third,
				isBackground: false,
			},
		],
	};
}

export function buildSpicyLines(
	source: LyricLine[],
	simple: boolean,
	romanized: boolean,
	forceLineSynced = false,
): SpicyLine[] {
	const normalized = source
		.filter((line) => valid(line.startTime, line.endTime))
		.map((line) => {
			const text = lineText(line, romanized);
			return {
				id: line.id,
				startTime: line.startTime,
				endTime: line.endTime,
				isLineSynced: forceLineSynced || isLineSynced(line),
				isRtl: isRtl(lineText(line, false)),
				text,
				isBackground: !!line.isBG,
				isDuet: !!line.isDuet,
				isDuetGroup: !!line.isDuetGroup,
				isMiddle: !!line.isMiddle,
				translation: line.translatedLyric || undefined,
				words: makeTokens(line.words, simple, romanized, !!line.isBG),
			};
		});
	const result: SpicyLine[] = [];
	const firstMainLine = normalized.find((line) => !line.isBackground);
	const firstMainStart = firstMainLine?.startTime;
	if (firstMainLine && firstMainStart !== undefined && firstMainStart >= 3000)
		result.push(
			dotLine(
				0,
				firstMainStart,
				"spicy-leading-dot",
				firstMainLine.isDuet,
				firstMainLine.isRtl,
				firstMainLine.isDuetGroup,
				firstMainLine.isMiddle,
			),
		);
	let latestMainEnd = 0;
	let lastMainLine: SpicyLine | undefined;
	for (let i = 0; i < normalized.length; i++) {
		const line = normalized[i];
		result.push(line);
		if (!line.isBackground) {
			latestMainEnd = Math.max(latestMainEnd, line.endTime);
			lastMainLine = line;
		}
		const next = normalized[i + 1];
		if (
			next &&
			!next.isBackground &&
			lastMainLine &&
			next.startTime - latestMainEnd >= 3000
		)
			result.push(
				dotLine(
					latestMainEnd,
					next.startTime,
					`spicy-dot-${lastMainLine.id}`,
					next.isDuet,
					next.isRtl,
					next.isDuetGroup,
					next.isMiddle,
				),
			);
	}
	return result;
}
