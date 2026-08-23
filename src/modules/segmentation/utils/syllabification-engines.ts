import type { SegmentationEngineId } from "../types";

type DictionaryEntry = number | number[];

export interface SyllabificationEngine {
	id: SegmentationEngineId;
	name: string;
	description: string;
	split: (word: string) => string[] | Promise<string[]>;
}

const hyphenationLanguages = [
	["en-us", "English (US)", true],
	["de", "German", false],
	["fr", "French", true],
	["es", "Spanish", true],
	["id", "Indonesian", false],
	["it", "Italian", false],
	["pt", "Portuguese", false],
	["ru", "Russian", true],
	["pl", "Polish", false],
] as const;

export const getHyphenationLanguage = (engine: SegmentationEngineId) =>
	engine.startsWith("hyphenation-")
		? engine.slice("hyphenation-".length)
		: undefined;

// --- Lazy-loaded NLP modules (cached after first load) ---

let _dictionary: Map<string, DictionaryEntry> | null = null;
let _nlpWithSpeech: ReturnType<typeof import("compromise/tokenize")> extends Promise<infer M> ? M extends { default: infer D } ? D : never : never;
let _nlpReady: Promise<void> | null = null;

const ensureNlpLoaded = (): Promise<void> => {
	if (_dictionary && _nlpWithSpeech) return Promise.resolve();
	if (_nlpReady) return _nlpReady;
	_nlpReady = (async () => {
		const [nlpModule, speechModule, dictModule] = await Promise.all([
			import("compromise/tokenize"),
			import("compromise-speech"),
			import("../data/prosodic-dict.json"),
		]);
		const nlp = nlpModule.default;
		_nlpWithSpeech = nlp.extend(speechModule.default as never);
		_dictionary = new Map<string, DictionaryEntry>(
			Object.entries(dictModule.default as Record<string, DictionaryEntry>),
		);
	})();
	return _nlpReady;
};

const splitAtLengths = (word: string, lengths: number[]) => {
	const boundaries = lengths.reduce<number[]>((result, length) => {
		result.push((result[result.length - 1] ?? 0) + length);
		return result;
	}, []);
	const parts: string[] = [];
	let start = 0;
	for (const end of boundaries) {
		parts.push(word.slice(start, end));
		start = end;
	}
	parts.push(word.slice(start));
	return parts.filter(Boolean);
};

const compromiseSplit = (word: string) => {
	const syllables = (_nlpWithSpeech!(word).syllables() as string[][]).flat();
	if (syllables.length <= 1) return [word];

	let offset = 0;
	const intervals = syllables.map((syllable) => {
		const remaining = word.slice(offset);
		const match = remaining.toLowerCase().indexOf(syllable.toLowerCase());
		const end = offset + (match < 0 ? 0 : match) + syllable.length;
		const begin = offset;
		offset = end;
		return { begin, end };
	});

	for (let index = 0; index < intervals.length; index++) {
		const interval = intervals[index];
		if (index === intervals.length - 1) {
			interval.end = word.length;
			continue;
		}
		const next = intervals[index + 1];
		interval.end = next.begin;
		if (/['\u2019]/.test(word.charAt(interval.end - 1))) {
			interval.end--;
			next.begin--;
		}
	}
	return intervals
		.map(({ begin, end }) => word.slice(begin, end))
		.filter(Boolean);
};

const mergeContractionSuffix = (parts: string[]) => {
	const result: string[] = [];
	for (const part of parts) {
		if (/^['\u2019](?:s|re|ve|ll|d|m|t)$/i.test(part) && result.length > 0) {
			result[result.length - 1] += part;
		} else {
			result.push(part);
		}
	}
	return result;
};

const prosodicSplit = (word: string) => {
	const key = word.toLowerCase();
	const entry =
		_dictionary!.get(key) ??
		(key.endsWith("in") ? _dictionary!.get(`${key}g`) : undefined);
	if (entry !== undefined) {
		return splitAtLengths(word, typeof entry === "number" ? [entry] : entry);
	}
	return mergeContractionSuffix(compromiseSplit(word));
};

const isJapaneseCharacter = (char: string | undefined) =>
	!!char &&
	/[々\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char);
const isJapanesePunctuation = (char: string | undefined) =>
	!!char && /[\p{P}\p{S}]/u.test(char);
const isJapaneseModifier = (char: string | undefined) =>
	!!char && "ャュョゃゅょンッっ".includes(char);

/** Adapted from amll-dev/amll-editor's Japanese basic engine. */
export const splitJapaneseText = (text: string) => {
	if (!text.trim()) return [text];
	const chars = Array.from(text);
	const tokens: string[] = [];
	while (chars.length > 0) {
		const token: string[] = [];
		if (isJapaneseCharacter(chars[0])) {
			token.push(chars.shift() ?? "");
			if (isJapaneseModifier(chars[0])) token.push(chars.shift() ?? "");
			while (isJapanesePunctuation(chars[0])) token.push(chars.shift() ?? "");
			tokens.push(token.join(""));
			continue;
		}
		while (
			chars.length > 0 &&
			!isJapaneseCharacter(chars[0]) &&
			!isJapanesePunctuation(chars[0]) &&
			!/^\s$/u.test(chars[0] ?? "")
		) {
			token.push(chars.shift() ?? "");
		}
		while (isJapanesePunctuation(chars[0])) token.push(chars.shift() ?? "");
		if (token.length > 0) tokens.push(token.join(""));
		if (chars.length > 0 && /^\s$/u.test(chars[0] ?? "")) {
			tokens.push(chars.shift() ?? "");
		}
	}
	return tokens;
};

// --- Lazy loaders for smaller NLP libs ---

let _silabas: ((word: string) => { syllables: () => string[] }) | null = null;
let _syllabify: ((word: string) => string[]) | null = null;
let _syllabifyFr: ((word: string) => { syllabes: string[] }) | null = null;

export const SYLLABIFICATION_ENGINES: SyllabificationEngine[] = [
	{
		id: "prosodic",
		name: "English (Prosodic)",
		description:
			"Dictionary-backed English syllable boundaries with a speech fallback.",
		split: async (word) => {
			await ensureNlpLoaded();
			return prosodicSplit(word);
		},
	},
	{
		id: "basic",
		name: "Basic",
		description:
			"Keep Latin words whole and split CJK text using the existing rules.",
		split: (word) => [word],
	},
	{
		id: "japanese",
		name: "Japanese (Basic)",
		description:
			"Use the existing CJK character splitting rules for Japanese text.",
		split: (word) => [word],
	},
	{
		id: "silabas",
		name: "Spanish (Silabas)",
		description: "Spanish orthographic syllable splitting.",
		split: async (word) => {
			try {
				if (!_silabas) {
					const mod = await import("silabas");
					_silabas = mod.default;
				}
				return _silabas!(word).syllables();
			} catch {
				return [word];
			}
		},
	},
	{
		id: "syllabify-fr",
		name: "French (Syllabify-fr)",
		description: "French orthographic syllable splitting.",
		split: async (word) => {
			if (!_syllabifyFr) {
				const mod = await import("syllabify-fr");
				_syllabifyFr = mod.default;
			}
			return _syllabifyFr!(word).syllabes;
		},
	},
	{
		id: "syllabify",
		name: "Russian (Syllabify)",
		description: "Russian orthographic syllable splitting.",
		split: async (word) => {
			try {
				if (!_syllabify) {
					const mod = await import("syllabify");
					_syllabify = mod.default;
				}
				return _syllabify!(word);
			} catch {
				return [word];
			}
		},
	},
	...hyphenationLanguages.map(([language, name, hasBetterEngine]) => ({
		id: `hyphenation-${language}` as SegmentationEngineId,
		name: `${name}${hasBetterEngine ? " (legacy)" : ""}`,
		description: `Use the existing ${name} hyphenation patterns.`,
		split: (word: string) => [word],
	})),
	{
		id: "none",
		name: "None",
		description: "Do not split words automatically.",
		split: (word) => [word],
	},
].sort((left, right) => left.name.localeCompare(right.name));

export const getSyllabificationEngine = (id: SegmentationEngineId) =>
	SYLLABIFICATION_ENGINES.find((engine) => engine.id === id) ??
	SYLLABIFICATION_ENGINES[0];
