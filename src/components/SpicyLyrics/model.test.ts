import { describe, expect, it } from "vitest";
import {
	buildSpicyLines,
	groupSpicyTokens,
	isRtl,
	type SpicyToken,
	type SpicyWordGroup,
} from "./model";
import { newLyricLine, newLyricWord } from "$/types/ttml";

const token = (
	id: string,
	spaceAfter = false,
	letters?: string[],
	breakAfter = false,
): SpicyToken => ({
	id,
	text: id,
	startTime: 0,
	endTime: 100,
	letters,
	isBackground: false,
	spaceAfter: spaceAfter || undefined,
	breakAfter: breakAfter || undefined,
});

const flatten = (groups: SpicyWordGroup[]) =>
	groups.flatMap((group) => group.items);

describe("groupSpicyTokens", () => {
	it("keeps complete words as separate layout items", () => {
		const tokens = [token("one", true), token("two", true), token("three")];
		const groups = groupSpicyTokens(tokens);

		expect(
			groups.map((group) => group.items.map(({ token }) => token.id)),
		).toEqual([["one"], ["two"], ["three"]]);
		expect(groups.map((group) => group.hasTrailingSpace)).toEqual([
			true,
			true,
			false,
		]);
	});

	it("groups connected syllables and includes the final syllable", () => {
		const tokens = [
			token("be"),
			token("au"),
			token("ti"),
			token("ful", true),
			token("day"),
		];
		const groups = groupSpicyTokens(tokens);

		expect(groups).toHaveLength(2);
		expect(groups[0].items.map(({ token }) => token.id)).toEqual([
			"be",
			"au",
			"ti",
			"ful",
		]);
		expect(groups[0].hasTrailingSpace).toBe(true);
		expect(groups[1].items.map(({ token }) => token.id)).toEqual(["day"]);
	});

	it("builds multiple syllable groups around literal spaces", () => {
		const tokens = [token("hel"), token("lo", true), token("wor"), token("ld")];

		expect(
			groupSpicyTokens(tokens).map((group) =>
				group.items.map(({ token }) => token.id),
			),
		).toEqual([
			["hel", "lo"],
			["wor", "ld"],
		]);
	});

	it("preserves held tokens and every original token index", () => {
		const tokens = [
			token("held", true, ["h", "e", "l", "d"]),
			token("sy"),
			token("lla"),
			token("ble"),
		];
		const flattened = flatten(groupSpicyTokens(tokens));

		expect(flattened.map(({ token }) => token)).toEqual(tokens);
		expect(flattened.map(({ wordIndex }) => wordIndex)).toEqual([0, 1, 2, 3]);
		expect(flattened[0].token.letters).toEqual(["h", "e", "l", "d"]);
	});

	it("creates wrap boundaries for adjacent CJK or romanized tokens without spaces", () => {
		const tokens = [
			token("世", false, undefined, true),
			token("界", false, undefined, true),
			token("romanization", false, undefined, true),
		];
		const groups = groupSpicyTokens(tokens);

		expect(
			groups.map((group) => group.items.map(({ token }) => token.id)),
		).toEqual([["世"], ["界"], ["romanization"]]);
		expect(groups.every((group) => !group.hasTrailingSpace)).toBe(true);
	});

	it("returns no groups for an empty line", () => {
		expect(groupSpicyTokens([])).toEqual([]);
	});
});

describe("buildSpicyLines", () => {
	it("uses the first strong character to detect RTL lines", () => {
		expect(isRtl("  123 - שלום")).toBe(true);
		expect(isRtl("Hello مرحبا")).toBe(false);

		const line = newLyricLine();
		line.startTime = 0;
		line.endTime = 1_000;
		line.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 1_000, word: "مرحبا" },
		];
		expect(buildSpicyLines([line], false, false)[0].isRtl).toBe(true);
	});

	it("marks a full-line timed word as line-synced and retains its text", () => {
		const line = newLyricLine();
		line.id = "line-synced";
		line.startTime = 1_000;
		line.endTime = 2_000;
		line.romanLyric = "Zheng hang";
		line.words = [
			{
				...newLyricWord(),
				startTime: 1_000,
				endTime: 2_000,
				word: "Whole line",
				romanWord: "Ignored per-line romanization",
			},
		];

		const [normal] = buildSpicyLines([line], false, false);
		const [romanized] = buildSpicyLines([line], false, true);

		expect(normal).toMatchObject({ isLineSynced: true, text: "Whole line" });
		expect(romanized).toMatchObject({ text: "Zheng hang" });
	});

	it("keeps multi-word karaoke lines on the word-synced path", () => {
		const line = newLyricLine();
		line.startTime = 0;
		line.endTime = 1_000;
		line.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 500, word: "Ka" },
			{ ...newLyricWord(), startTime: 500, endTime: 1_000, word: "raoke" },
		];

		expect(buildSpicyLines([line], false, false)[0].isLineSynced).toBe(false);
	});

	it("places interlude dots on the next vocal line's side", () => {
		const first = newLyricLine();
		first.id = "first";
		first.startTime = 0;
		first.endTime = 1_000;
		first.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 1_000, word: "First" },
		];
		const next = newLyricLine();
		next.id = "next";
		next.startTime = 4_000;
		next.endTime = 5_000;
		next.isDuet = true;
		next.words = [
			{ ...newLyricWord(), startTime: 4_000, endTime: 5_000, word: "التالي" },
		];

		const dot = buildSpicyLines([first, next], false, false).find(
			(line) => line.isDotLine,
		);

		expect(dot?.isDuet).toBe(true);
		expect(dot?.isRtl).toBe(true);
	});
});
