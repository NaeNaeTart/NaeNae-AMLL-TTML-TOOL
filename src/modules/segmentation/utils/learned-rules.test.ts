import { describe, expect, it } from "vitest";
import { newLyricWord } from "$/types/ttml";
import type { SegmentationConfig } from "../types";
import { segmentWord } from "./segmentation";
import {
	applyLearnedRule,
	createLearnedRule,
	getLearnedWordParts,
} from "./learned-rules";

const config = (learnedRules: Map<string, number[]>): SegmentationConfig => ({
	engine: "basic",
	splitCJK: true,
	splitEnglish: true,
	punctuationWeight: 0.2,
	punctuationMode: "merge",
	removeEmptySegments: true,
	ignoreList: new Set(),
	customRules: new Map(),
	learnedRules,
});

describe("learned split rules", () => {
	it("normalizes case and keeps surrounding Unicode punctuation", () => {
		const rule = createLearnedRule("Beautiful", [4, 7]);
		expect(rule).toEqual({ key: "beautiful", boundaries: [4, 7] });
		if (!rule) throw new Error("Expected a learned rule");
		const rules = new Map([[rule.key, rule.boundaries]]);
		expect(applyLearnedRule("“BEAUTIFUL?”", rules)).toEqual([
			"“BEAU",
			"TIF",
			"UL?”",
		]);
	});

	it("works across scripts and Unicode punctuation", () => {
		for (const [word, boundaries, wrapped] of [
			["Привет", [3], "【ПРИВЕТ】"],
			["مرحبا", [2], "«مرحبا؟»"],
			["你好世界", [2], "（你好世界）"],
			["a\u0301b", [2], "…a\u0301b…"],
		] as const) {
			const rule = createLearnedRule(word, boundaries);
			if (!rule) throw new Error("Expected a learned rule");
			expect(applyLearnedRule(wrapped, new Map([[rule.key, rule.boundaries]])))
				.not.toBeNull();
		}
	});

	it("takes precedence over automatic segmentation and preserves the input", async () => {
		const rule = createLearnedRule("hello", [2]);
		if (!rule) throw new Error("Expected a learned rule");
		const word = { ...newLyricWord(), word: "(HELLO!)", startTime: 0, endTime: 1000 };
		const segmented = await segmentWord(word, config(new Map([[rule.key, rule.boundaries]])));
		expect(segmented.map((item) => item.word)).toEqual([
			"(HE",
			"LLO!)",
		]);
	});

	it("does not learn punctuation-only input", () => {
		expect(getLearnedWordParts("「！？！」")).toBeNull();
	});
});
