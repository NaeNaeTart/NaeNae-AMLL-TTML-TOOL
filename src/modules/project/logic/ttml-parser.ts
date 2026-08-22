/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/blob/main/LICENSE
 */

import { uid } from "uid";
import type {
	LyricLine,
	LyricWord,
	LyricWordBase,
	Mark,
	TTMLLyric,
	TTMLMetadata,
} from "../../../types/ttml.ts";
import { log } from "../../../utils/logging.ts";
import { parseTimespan } from "../../../utils/timestamp.ts";

interface RomanWord {
	startTime: number;
	endTime: number;
	text: string;
}

interface LineMetadata {
	main: string;
	bg: string;
}

interface WordRomanMetadata {
	main: RomanWord[];
	bg: RomanWord[];
}

interface SpanNode {
	text: string;
	begin: string | null;
	end: string | null;
	role: string | null;
	lang: string | null;
	emptyBeat: string | null;
	ruby: string | null;
	children: SpanNode[];
	tail: string;
}

export function appendParentBeforeNestedLines(
	lines: LyricLine[],
	nestedStartIndex: number,
	parent: LyricLine,
) {
	const nestedLines = lines.splice(nestedStartIndex);
	const hasParentContent =
		parent.words.some(
			(word) =>
				word.word.trim().length > 0 ||
				word.emptyBeat > 0 ||
				word.ruby?.some((rubyWord) => rubyWord.word.trim().length > 0),
		) ||
		parent.translatedLyric.trim().length > 0 ||
		parent.romanLyric.trim().length > 0;
	if (nestedLines.length > 0 && !hasParentContent) {
		lines.push(...nestedLines);
		return;
	}
	lines.push(parent, ...nestedLines);
}

function localName(el: Element): string {
	return el.localName || el.tagName.split(":").pop() || el.tagName;
}

function getAttr(el: Element, target: string): string | null {
	const direct = el.getAttribute(target);
	if (direct !== null) {
		return direct;
	}
	for (const attr of Array.from(el.attributes)) {
		if (
			attr.localName === target ||
			attr.name === target ||
			attr.name.endsWith(`:${target}`)
		) {
			return attr.value;
		}
	}
	return null;
}

function parseSpan(spanEl: Element): SpanNode {
	const span: SpanNode = {
		text: "",
		begin: getAttr(spanEl, "begin"),
		end: getAttr(spanEl, "end"),
		role: getAttr(spanEl, "role"),
		lang: getAttr(spanEl, "lang"),
		emptyBeat: getAttr(spanEl, "empty-beat"),
		ruby: getAttr(spanEl, "ruby"),
		children: [],
		tail: "",
	};
	let lastChild: SpanNode | null = null;
	for (const node of Array.from(spanEl.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent ?? "";
			if (lastChild) {
				lastChild.tail += text;
			} else {
				span.text += text;
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const childEl = node as Element;
			if (localName(childEl) === "span") {
				const child = parseSpan(childEl);
				span.children.push(child);
				lastChild = child;
			}
		}
	}
	return span;
}

function flattenSpanText(span: SpanNode, skipRoles?: Set<string>): string {
	const skipCurrent = span.role ? skipRoles?.has(span.role) : false;
	let text = "";
	if (!skipCurrent) {
		text += span.text || "";
		for (const child of span.children) {
			text += flattenSpanText(child, skipRoles);
		}
	}
	text += span.tail || "";
	return text;
}

function flattenSpanInnerText(span: SpanNode, skipRoles?: Set<string>): string {
	const skipCurrent = span.role ? skipRoles?.has(span.role) : false;
	let text = "";
	if (!skipCurrent) {
		text += span.text || "";
		for (const child of span.children) {
			text += flattenSpanText(child, skipRoles);
		}
	}
	return text;
}

function collectRubyTextSpans(span: SpanNode): SpanNode[] {
	const results: SpanNode[] = [];
	if (span.ruby === "text") {
		results.push(span);
	}
	for (const child of span.children) {
		results.push(...collectRubyTextSpans(child));
	}
	return results;
}

function computeWordTiming(words: LyricWordBase[]): [number, number] {
	const filtered = words.filter((v) => v.word.trim().length > 0);
	const start =
		filtered.reduce(
			(pv, cv) => Math.min(pv, cv.startTime),
			Number.POSITIVE_INFINITY,
		) ?? 0;
	const end = filtered.reduce((pv, cv) => Math.max(pv, cv.endTime), 0);
	return [start === Number.POSITIVE_INFINITY ? 0 : start, end];
}

function createWordFromSpanElement(wordEl: Element): LyricWord | null {
	const begin = getAttr(wordEl, "begin");
	const end = getAttr(wordEl, "end");
	const spanNode = parseSpan(wordEl);
	const skipRoles = new Set(["x-translation", "x-roman"]);
	if (spanNode.ruby === "container") {
		const baseSpan = spanNode.children.find((child) => child.ruby === "base");
		const baseText = baseSpan
			? flattenSpanInnerText(baseSpan, skipRoles)
			: flattenSpanInnerText(spanNode, skipRoles);
		const rubyTextSpans = collectRubyTextSpans(spanNode);
		const containerStart = begin ? parseTimespan(begin) : null;
		const containerEnd = end ? parseTimespan(end) : null;
		const rubyWords: LyricWordBase[] = rubyTextSpans.map((rubySpan) => {
			const rubyBegin = rubySpan.begin
				? parseTimespan(rubySpan.begin)
				: (containerStart ?? 0);
			const rubyEnd = rubySpan.end
				? parseTimespan(rubySpan.end)
				: (containerEnd ?? 0);
			return {
				word: flattenSpanInnerText(rubySpan, skipRoles),
				startTime: rubyBegin,
				endTime: rubyEnd,
			};
		});
		const [rubyStart, rubyEnd] = computeWordTiming(rubyWords);
		const word: LyricWord = {
			id: uid(),
			word: baseText,
			startTime: containerStart ?? rubyStart,
			endTime: containerEnd ?? rubyEnd,
			obscene: false,
			emptyBeat: 0,
			romanWord: "",
			ruby: rubyWords.length > 0 ? rubyWords : undefined,
		};
		const emptyBeat = getAttr(wordEl, "empty-beat");
		if (emptyBeat) {
			word.emptyBeat = Number(emptyBeat);
		}
		const obscene = getAttr(wordEl, "obscene");
		if (obscene === "true") {
			word.obscene = true;
		}
		return word;
	}
	if (!begin || !end) {
		return null;
	}
	const wordText = flattenSpanInnerText(spanNode, skipRoles);
	const word: LyricWord = {
		id: uid(),
		word: wordText,
		startTime: parseTimespan(begin),
		endTime: parseTimespan(end),
		obscene: false,
		emptyBeat: 0,
		romanWord: "",
	};
	const emptyBeat = getAttr(wordEl, "empty-beat");
	if (emptyBeat) {
		word.emptyBeat = Number(emptyBeat);
	}
	const obscene = getAttr(wordEl, "obscene");
	if (obscene === "true") {
		word.obscene = true;
	}
	return word;
}

export function parseLyric(ttmlText: string): TTMLLyric {
	const domParser = new DOMParser();
	const ttmlDoc: XMLDocument = domParser.parseFromString(
		ttmlText,
		"application/xml",
	);

	log("ttml document parsed", ttmlDoc);

	const itunesTranslations = new Map<string, LineMetadata>();
	const translationTextElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > translations > translation > text[for]",
	);

	translationTextElements.forEach((textEl) => {
		const key = textEl.getAttribute("for");
		if (!key) return;

		let main = "";
		let bg = "";

		for (const node of Array.from(textEl.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				main += node.textContent ?? "";
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				if ((node as Element).getAttribute("ttm:role") === "x-bg") {
					bg += node.textContent ?? "";
				}
			}
		}

		main = main.trim();
		bg = bg
			.trim()
			.replace(/^[（(]/, "")
			.replace(/[)）]$/, "")
			.trim();

		if (main.length > 0 || bg.length > 0) {
			itunesTranslations.set(key, { main, bg });
		}
	});

	const itunesLineRomanizations = new Map<string, LineMetadata>();
	const itunesWordRomanizations = new Map<string, WordRomanMetadata>();

	const romanizationTextElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > transliterations > transliteration > text[for]",
	);

	romanizationTextElements.forEach((textEl) => {
		const key = textEl.getAttribute("for");
		if (!key) return;

		const mainWords: RomanWord[] = [];
		const bgWords: RomanWord[] = [];
		let lineRomanMain = "";
		let lineRomanBg = "";
		let isWordByWord = false;

		for (const node of Array.from(textEl.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				lineRomanMain += node.textContent ?? "";
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as Element;
				if (el.getAttribute("ttm:role") === "x-bg") {
					const nestedSpans = el.querySelectorAll("span[begin][end]");
					if (nestedSpans.length > 0) {
						isWordByWord = true;
						nestedSpans.forEach((span) => {
							let bgWordText = span.textContent ?? "";
							bgWordText = bgWordText
								.trim()
								.replace(/^[（(]/, "")
								.replace(/[)）]$/, "")
								.trim();

							bgWords.push({
								startTime: parseTimespan(span.getAttribute("begin") ?? ""),
								endTime: parseTimespan(span.getAttribute("end") ?? ""),
								text: bgWordText,
							});
						});
					} else {
						lineRomanBg += el.textContent ?? "";
					}
				} else if (el.hasAttribute("begin") && el.hasAttribute("end")) {
					isWordByWord = true;
					mainWords.push({
						startTime: parseTimespan(el.getAttribute("begin") ?? ""),
						endTime: parseTimespan(el.getAttribute("end") ?? ""),
						text: el.textContent ?? "",
					});
				}
			}
		}

		if (isWordByWord) {
			itunesWordRomanizations.set(key, { main: mainWords, bg: bgWords });
		}

		lineRomanMain = lineRomanMain.trim();
		lineRomanBg = lineRomanBg
			.trim()
			.replace(/^[（(]/, "")
			.replace(/[)）]$/, "")
			.trim();

		if (lineRomanMain.length > 0 || lineRomanBg.length > 0) {
			itunesLineRomanizations.set(key, {
				main: lineRomanMain,
				bg: lineRomanBg,
			});
		}
	});

	const itunesTimedTranslations = new Map<string, LineMetadata>();
	const timedTranslationTextElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > translations > translation > text[for]",
	);

	timedTranslationTextElements.forEach((textEl) => {
		const key = textEl.getAttribute("for");
		if (!key) return;

		let main = "";
		let bg = "";

		for (const node of Array.from(textEl.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				main += node.textContent ?? "";
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				if ((node as Element).getAttribute("ttm:role") === "x-bg") {
					bg += node.textContent ?? "";
				}
			}
		}

		main = main.trim();
		bg = bg
			.trim()
			.replace(/^[（(]/, "")
			.replace(/[)）]$/, "")
			.trim();

		if ((main.length > 0 || bg.length > 0) && textEl.querySelector("span")) {
			itunesTimedTranslations.set(key, { main, bg });
			itunesTranslations.delete(key);
		}
	});

	let mainAgentId = "v1";

	const metadata: TTMLMetadata[] = [];
	const metaTags = ttmlDoc.getElementsByTagNameNS("*", "meta");
	for (let i = 0; i < metaTags.length; i++) {
		const meta = metaTags[i];
		if (localName(meta) === "meta") {
			const key = getAttr(meta, "key");
			if (key) {
				const value = getAttr(meta, "value");
				if (value) {
					const existing = metadata.find((m) => m.key === key);
					if (existing) {
						existing.value.push(value);
					} else {
						metadata.push({
							key,
							value: [value],
						});
					}
				}
			}
		}
	}

	const songwriterElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > songwriters > songwriter",
	);
	if (songwriterElements.length > 0) {
		const songwriterValues: string[] = [];
		songwriterElements.forEach((el) => {
			const name = el.textContent?.trim();
			if (name) {
				songwriterValues.push(name);
			}
		});
		if (songwriterValues.length > 0) {
			metadata.push({
				key: "songwriter",
				value: songwriterValues,
			});
		}
	}

	const agents = ttmlDoc.getElementsByTagNameNS("*", "agent");
	for (let i = 0; i < agents.length; i++) {
		const agent = agents[i];
		if (getAttr(agent, "type") === "person") {
			const id = getAttr(agent, "id");
			if (id) {
				mainAgentId = id;
				break;
			}
		}
	}

	const lyricLines: LyricLine[] = [];

	function parseLineElement(
		lineEl: Element,
		isBG = false,
		isDuet = false,
		isMiddle = false,
		isDuetGroup = false,
		parentItunesKey: string | null = null,
		parentSectionId?: string,
	) {
		const nestedStartIndex = lyricLines.length;
		const startTimeAttr = lineEl.getAttribute("begin");
		const endTimeAttr = lineEl.getAttribute("end");

		let parsedStartTime = 0;
		let parsedEndTime = 0;

		if (startTimeAttr && endTimeAttr) {
			parsedStartTime = parseTimespan(startTimeAttr);
			parsedEndTime = parseTimespan(endTimeAttr);
		}

		const agentId = getAttr(lineEl, "agent") || getAttr(lineEl, "participant");

		const currentIsMiddle = isBG ? isMiddle : !!agentId && agentId === "v3";
		const currentIsDuetGroup = isBG
			? isDuetGroup
			: !!agentId && agentId === "v4";
		const currentIsDuet = isBG
			? isDuet
			: !!agentId &&
				agentId !== mainAgentId &&
				!currentIsMiddle &&
				!currentIsDuetGroup;

		const line: LyricLine = {
			id: uid(),
			words: [],
			translatedLyric: "",
			romanLyric: "",
			isBG,
			isDuet: currentIsDuet,
			isMiddle: currentIsMiddle,
			isDuetGroup: currentIsDuetGroup,
			agent: agentId || undefined,
			startTime: parsedStartTime,
			endTime: parsedEndTime,
			ignoreSync: false,
			isLineSynced: Array.from(lineEl.childNodes).some(
				(node) =>
					node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim(),
			),
			sectionId: getAttr(lineEl, "section") || parentSectionId,
		};

		const itunesKey = isBG
			? parentItunesKey
			: lineEl.getAttribute("itunes:key");

		const romanWordData = itunesKey
			? itunesWordRomanizations.get(itunesKey)
			: undefined;
		const sourceRomanList = isBG ? romanWordData?.bg : romanWordData?.main;
		const availableRomanWords = sourceRomanList ? [...sourceRomanList] : [];

		if (itunesKey) {
			const timedTrans = itunesTimedTranslations.get(itunesKey);
			const lineTrans = itunesTranslations.get(itunesKey);

			if (isBG) {
				line.translatedLyric = timedTrans?.bg ?? lineTrans?.bg ?? "";
			} else {
				line.translatedLyric = timedTrans?.main ?? lineTrans?.main ?? "";
			}

			const lineRoman = itunesLineRomanizations.get(itunesKey);
			if (isBG) {
				line.romanLyric = lineRoman?.bg ?? "";
			} else {
				line.romanLyric = lineRoman?.main ?? "";
			}
		}

		for (const wordNode of lineEl.childNodes) {
			if (wordNode.nodeType === Node.TEXT_NODE) {
				const word = wordNode.textContent ?? "";
				line.words.push({
					id: uid(),
					word: word,
					startTime: word.trim().length > 0 ? line.startTime : 0,
					endTime: word.trim().length > 0 ? line.endTime : 0,
					obscene: false,
					emptyBeat: 0,
					romanWord: "",
				});
			} else if (wordNode.nodeType === Node.ELEMENT_NODE) {
				const wordEl = wordNode as Element;
				const role = wordEl.getAttribute("ttm:role");

				if (wordEl.nodeName === "span" && role) {
					if (role === "x-bg") {
						parseLineElement(
							wordEl,
							true,
							line.isDuet,
							line.isMiddle,
							line.isDuetGroup,
							itunesKey,
							line.sectionId,
						);
					} else if (role === "x-translation") {
						if (!line.translatedLyric) {
							line.translatedLyric = wordEl.textContent ?? "";
						}
					} else if (role === "x-roman") {
						if (!line.romanLyric) {
							line.romanLyric = wordEl.textContent ?? "";
						}
					}
				} else {
					const word = createWordFromSpanElement(wordEl);
					if (!word) continue;
					if (availableRomanWords.length > 0) {
						const matchIndex = availableRomanWords.findIndex(
							(r) =>
								r.startTime === word.startTime && r.endTime === word.endTime,
						);

						if (matchIndex !== -1) {
							word.romanWord = availableRomanWords[matchIndex].text;
							availableRomanWords.splice(matchIndex, 1);
						}
					}

					line.words.push(word);
				}
			}
		}

		if (line.isBG) {
			const firstWord = line.words[0];
			if (firstWord && /^[（(]/.test(firstWord.word)) {
				firstWord.word = firstWord.word.substring(1);
				if (firstWord.word.length === 0) {
					line.words.shift();
				}
			}

			const lastWord = line.words[line.words.length - 1];
			if (lastWord && /[)）]$/.test(lastWord.word)) {
				lastWord.word = lastWord.word.substring(0, lastWord.word.length - 1);
				if (lastWord.word.length === 0) {
					line.words.pop();
				}
			}
		}

		const timedWords = line.words.filter(
			(w) => w.word.trim().length > 0 && w.endTime > w.startTime,
		);
		if (timedWords.length > 0) {
			const computedStart = timedWords.reduce(
				(pv, cv) => Math.min(pv, cv.startTime),
				Number.POSITIVE_INFINITY,
			);
			const computedEnd = timedWords.reduce(
				(pv, cv) => Math.max(pv, cv.endTime),
				0,
			);
			if (computedStart !== Number.POSITIVE_INFINITY) {
				line.startTime = computedStart;
			}
			if (computedEnd > 0) {
				line.endTime = computedEnd;
			}
		} else if (!startTimeAttr || !endTimeAttr) {
			line.startTime = line.words
				.filter((w) => w.word.trim().length > 0)
				.reduce(
					(pv, cv) => Math.min(pv, cv.startTime),
					Number.POSITIVE_INFINITY,
				);
			line.endTime = line.words
				.filter((w) => w.word.trim().length > 0)
				.reduce((pv, cv) => Math.max(pv, cv.endTime), 0);
		}

		appendParentBeforeNestedLines(lyricLines, nestedStartIndex, line);
	}

	for (const lineEl of ttmlDoc.querySelectorAll("body p[begin][end]")) {
		parseLineElement(lineEl, false, false, false);
	}

	const marks: Mark[] = [];
	const marksMeta = metadata.find((m) => m.key === "amll:marks");
	if (marksMeta) {
		for (const v of marksMeta.value) {
			try {
				const m = JSON.parse(v);
				if (typeof m === "number") {
					marks.push({ timeMs: m });
				} else if (m && typeof m.timeMs === "number") {
					marks.push(m);
				}
			} catch {
				const t = Number.parseFloat(v);
				if (!Number.isNaN(t)) marks.push({ timeMs: t });
			}
		}
	}

	let sections: TTMLLyric["sections"];
	const sectionMeta = metadata.find((m) => m.key === "amll:sections");
	if (sectionMeta?.value[0]) {
		try {
			const parsed = JSON.parse(sectionMeta.value[0]);
			if (parsed?.version === 1 && Array.isArray(parsed.sections)) {
				sections = parsed.sections;
			}
		} catch {
			// Optional section metadata should never make an otherwise valid TTML fail.
		}
	}

	return {
		metadata: metadata.filter(
			(m) => m.key !== "amll:marks" && m.key !== "amll:sections",
		),
		lyricLines: lyricLines,
		marks: marks.length > 0 ? marks : undefined,
		sections,
	};
}
