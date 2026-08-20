import { Romanize } from "hangul-romanize";
import { pinyin as getPinyin } from "pinyin-pro";
import * as wanakana from "wanakana";

export type PhoneticLanguage = "ja" | "zh" | "ko" | "yue" | "auto";

const GOOGLE_TIMEOUT_MS = 3000;
const MAX_CONCURRENT_GOOGLE_REQUESTS = 4;
const MAX_PHONETIC_CACHE_SIZE = 2048;
interface PhoneticConversion {
	value: string;
	cacheable: boolean;
}

const phoneticCache = new Map<string, Promise<PhoneticConversion>>();
const googleRequestQueue: Array<() => void> = [];
let activeGoogleRequests = 0;

const withGoogleRequestSlot = async <T>(request: () => Promise<T>) => {
	if (activeGoogleRequests >= MAX_CONCURRENT_GOOGLE_REQUESTS) {
		await new Promise<void>((resolve) => googleRequestQueue.push(resolve));
	}
	activeGoogleRequests++;
	try {
		return await request();
	} finally {
		activeGoogleRequests--;
		googleRequestQueue.shift()?.();
	}
};

const normalizePhoneticForMatching = (text: string) =>
	text
		.toLowerCase()
		.replace(/ā/g, "aa")
		.replace(/ī/g, "ii")
		.replace(/ū/g, "uu")
		.replace(/ē/g, "ee")
		.replace(/ō/g, "ou")
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/\s+/g, "")
		.replace(/[^a-z]/g, "");

export const formatPhoneticForDisplay = (text: string) =>
	text.toLocaleLowerCase().replace(/\s+/g, "");

export const buildLineRomanization = (
	capsules: string[],
	romanizations: string[],
) =>
	capsules
		.map((capsule, index) => romanizations[index] || capsule)
		.join("")
		.toLocaleLowerCase();

const hasSourceScript = (text: string, language: PhoneticLanguage) => {
	switch (language) {
		case "ja":
			return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(
				text,
			);
		case "zh":
		case "yue":
			return /\p{Script=Han}/u.test(text);
		case "ko":
			return /\p{Script=Hangul}/u.test(text);
		default:
			return false;
	}
};

const normalizeCapsulePhonetic = (text: string, language: PhoneticLanguage) => {
	const normalized = text.trim().replace(/\s+/g, " ");
	return language === "zh" || language === "yue"
		? formatPhoneticForDisplay(normalized)
		: normalizePhoneticForMatching(normalized);
};

const mapContextualChinesePhonetic = (
	capsules: string[],
	linePhonetic: string,
) => {
	const syllables = linePhonetic.trim().split(/\s+/).filter(Boolean);
	const hanCounts = capsules.map(
		(capsule) => capsule.match(/\p{Script=Han}/gu)?.length ?? 0,
	);
	if (
		syllables.length === 0 ||
		hanCounts.reduce((sum, count) => sum + count, 0) !== syllables.length
	) {
		return undefined;
	}

	let syllableIndex = 0;
	return hanCounts.map((count) => {
		if (count === 0) return "";
		const result = syllables
			.slice(syllableIndex, syllableIndex + count)
			.join(" ");
		syllableIndex += count;
		return formatPhoneticForDisplay(result);
	});
};

const mapMandarinCapsules = (capsules: string[]) => {
	const hanText = capsules
		.flatMap((capsule) => capsule.match(/\p{Script=Han}/gu) ?? [])
		.join("");
	if (!hanText) return capsules.map(() => "");

	const readings = getPinyin(hanText, {
		toneType: "symbol",
		type: "array",
		traditional: true,
	});
	let readingIndex = 0;
	return capsules.map((capsule) => {
		if (!/\p{Script=Han}/u.test(capsule)) return "";
		return Array.from(capsule)
			.map((character) =>
				/\p{Script=Han}/u.test(character)
					? (readings[readingIndex++] ?? "")
					: character,
			)
			.join("")
			.toLocaleLowerCase();
	});
};

export async function getPhonetic(
	text: string,
	lang: PhoneticLanguage = "auto",
	preserveFormatting = false,
): Promise<string> {
	if (!text.trim()) return "";

	let detectedLang = lang;
	if (lang === "auto") {
		detectedLang = detectLanguage(text);
	}

	if (detectedLang === "auto") return "";
	if (!hasSourceScript(text, detectedLang)) return "";

	const cacheKey = `${detectedLang}\u0000${text}`;
	const cached = phoneticCache.get(cacheKey);
	if (cached) {
		phoneticCache.delete(cacheKey);
		phoneticCache.set(cacheKey, cached);
		const value = (await cached).value;
		return preserveFormatting ? value : formatPhoneticForDisplay(value);
	}

	const request = convertPhonetic(text, detectedLang);
	phoneticCache.set(cacheKey, request);
	while (phoneticCache.size > MAX_PHONETIC_CACHE_SIZE) {
		const oldestKey = phoneticCache.keys().next().value;
		if (oldestKey === undefined) break;
		phoneticCache.delete(oldestKey);
	}

	try {
		const result = await request;
		if (!result.cacheable) phoneticCache.delete(cacheKey);
		return preserveFormatting
			? result.value
			: formatPhoneticForDisplay(result.value);
	} catch (e) {
		phoneticCache.delete(cacheKey);
		console.error("Phonetic conversion failed", e);
		return "";
	}
}

async function convertPhonetic(
	text: string,
	detectedLang: Exclude<PhoneticLanguage, "auto">,
): Promise<PhoneticConversion> {
	try {
		const romanized = await withGoogleRequestSlot(async () => {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
			try {
				const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${detectedLang}&tl=en&dt=rm&q=${encodeURIComponent(text)}`;
				const response = await fetch(url, { signal: controller.signal });
				if (!response.ok) {
					throw new Error(
						`Google transliteration request failed: ${response.status}`,
					);
				}

				const data: unknown = await response.json();
				const segments =
					Array.isArray(data) && Array.isArray(data[0]) ? data[0] : null;
				if (!segments) {
					throw new Error("Invalid Google transliteration response");
				}

				const result = segments
					.map((segment: unknown) => {
						if (!Array.isArray(segment)) return "";
						const value = segment[3];
						return typeof value === "string" ? value : "";
					})
					.join("");
				if (!result.trim()) {
					throw new Error("Google transliteration response was empty");
				}
				return result;
			} finally {
				clearTimeout(timeoutId);
			}
		});
		return { value: romanized, cacheable: true };
	} catch (e) {
		console.warn(`${detectedLang} API failed, falling back to local libs`, e);
	}

	let fallback = "";
	if (detectedLang === "ja") fallback = wanakana.toRomaji(text);
	if (detectedLang === "zh") fallback = getPinyin(text, { toneType: "none" });
	if (detectedLang === "ko") fallback = Romanize.from(text);
	return { value: fallback, cacheable: false };
}

export async function getPhoneticSyllables(
	textOrArray: string | string[],
	lang: PhoneticLanguage = "auto",
): Promise<string[]> {
	const originalCapsules =
		typeof textOrArray === "string"
			? Array.from(textOrArray).filter((c) => !/^\s*$/.test(c))
			: textOrArray;
	if (originalCapsules.length === 0) return [];

	const fullLineText = originalCapsules.join("").replace(/\s+/g, "");
	let detectedLang = lang;
	if (lang === "auto") {
		detectedLang = detectLanguage(fullLineText);
	}
	if (detectedLang === "zh") return mapMandarinCapsules(originalCapsules);

	const rawLinePhoneticPromise = getPhonetic(fullLineText, detectedLang, true);
	if (detectedLang === "yue") {
		const contextual = mapContextualChinesePhonetic(
			originalCapsules,
			await rawLinePhoneticPromise,
		);
		if (contextual) return contextual;
	}

	const capResultsPromise = Promise.all(
		originalCapsules.map(async (cap) => {
			const capText = cap.trim().replace(/\s+/g, "");
			if (capText.length === 0) return { phonetic: "", weight: 0 };

			const rawCapPhonetic = await getPhonetic(capText, detectedLang);
			if (!rawCapPhonetic) return { phonetic: "", weight: 0 };
			const capPhonetic = normalizeCapsulePhonetic(
				rawCapPhonetic,
				detectedLang,
			);

			const capSyllables = normalizePhoneticForMatching(capPhonetic)
				.replace(/([aeiouy])([aeiouy])/gi, "$1 $2")
				.match(/([^aeiouy ]*[aeiouy]{1}([nm](?![aeiouy]))?|[^aeiouy ]+)/gi) || [
				"a",
			];
			return { phonetic: capPhonetic, weight: capSyllables.length };
		}),
	);

	const rawLinePhonetic = await rawLinePhoneticPromise;
	const normalizedLinePhonetic = normalizePhoneticForMatching(rawLinePhonetic);

	const masterSyllables = normalizedLinePhonetic
		.replace(/([aeiouy])([aeiouy])/gi, "$1 $2")
		.match(/([^aeiouy ]*[aeiouy]{1}([nm](?![aeiouy]))?|[^aeiouy ]+)/gi) || [
		normalizedLinePhonetic,
	];

	const capResults = await capResultsPromise;
	const charWeights = capResults.map((result) => result.weight);
	const capPhonetics = capResults.map((result) => result.phonetic);

	const totalWeight = charWeights.reduce((a, b) => a + b, 0);
	const results: string[] = [];
	let syllableIndex = 0;

	for (let i = 0; i < originalCapsules.length; i++) {
		if (charWeights[i] === 0) {
			results.push("");
			continue;
		}

		if (capPhonetics[i]) {
			let charSyllableCount = Math.round(
				(charWeights[i] / totalWeight) * masterSyllables.length,
			);
			if (i === originalCapsules.length - 1 || totalWeight === 0) {
				charSyllableCount = masterSyllables.length - syllableIndex;
			}
			charSyllableCount = Math.max(1, charSyllableCount);
			if (i < originalCapsules.length - 1) {
				const remainingWeight = charWeights
					.slice(i + 1)
					.reduce((a, b) => a + b, 0);
				if (remainingWeight > 0) {
					charSyllableCount = Math.min(
						charSyllableCount,
						masterSyllables.length - syllableIndex - 1,
					);
				}
			}
			syllableIndex += charSyllableCount;
			results.push(capPhonetics[i]);
			continue;
		}

		let charSyllableCount = Math.round(
			(charWeights[i] / totalWeight) * masterSyllables.length,
		);
		if (i === originalCapsules.length - 1 || totalWeight === 0) {
			charSyllableCount = masterSyllables.length - syllableIndex;
		}

		charSyllableCount = Math.max(1, charSyllableCount);
		if (i < originalCapsules.length - 1) {
			const remainingWeight = charWeights
				.slice(i + 1)
				.reduce((a, b) => a + b, 0);
			if (remainingWeight > 0) {
				charSyllableCount = Math.min(
					charSyllableCount,
					masterSyllables.length - syllableIndex - 1,
				);
			}
		}

		const charSyllables = masterSyllables.slice(
			syllableIndex,
			syllableIndex + charSyllableCount,
		);
		syllableIndex += charSyllableCount;
		results.push(charSyllables.join("").trim());
	}

	return results;
}

function detectLanguage(text: string): PhoneticLanguage {
	if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja";

	if (/[\uAC00-\uD7AF]/.test(text)) return "ko";

	if (/[\u4E00-\u9FA5]/.test(text)) return "zh";

	return "auto";
}
