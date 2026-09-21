import { describe, expect, it } from "vitest";
import type { LyricWord } from "$/types/ttml";
import { areWordGroupPropsEqual, type WordGroupProps } from "./word-group-memo";

describe("areWordGroupPropsEqual (WordGroup memoization)", () => {
	const sampleWords: LyricWord[] = [
		{
			id: "w-1",
			word: "Hello",
			startTime: 1000,
			endTime: 1500,
			emptyBeat: 0,
		},
		{
			id: "w-2",
			word: "world",
			startTime: 1500,
			endTime: 2000,
			emptyBeat: 0,
		},
	];

	const onClickA = () => {};
	const onClickB = () => {};

	it("returns false (re-renders) when playback enters a word group", () => {
		const prev: WordGroupProps = {
			words: sampleWords,
			currentTime: 800, // before group starts (inactive)
			onWordClick: onClickA,
		};
		const next: WordGroupProps = {
			words: sampleWords,
			currentTime: 1200, // inside first word (active)
			onWordClick: onClickA,
		};

		// Must return false so React re-renders and displays the active group glowing frame
		expect(areWordGroupPropsEqual(prev, next)).toBe(false);
	});

	it("returns false (re-renders) when playback leaves a word group", () => {
		const prev: WordGroupProps = {
			words: sampleWords,
			currentTime: 1900, // inside second word (active)
			onWordClick: onClickA,
		};
		const next: WordGroupProps = {
			words: sampleWords,
			currentTime: 2200, // past the group (inactive)
			onWordClick: onClickA,
		};

		// Must return false so React re-renders and removes the active group glowing frame
		expect(areWordGroupPropsEqual(prev, next)).toBe(false);
	});

	it("returns false (re-renders) while transitioning between words inside an active group", () => {
		const prev: WordGroupProps = {
			words: sampleWords,
			currentTime: 1200, // word 1
			onWordClick: onClickA,
		};
		const next: WordGroupProps = {
			words: sampleWords,
			currentTime: 1700, // word 2
			onWordClick: onClickA,
		};

		expect(areWordGroupPropsEqual(prev, next)).toBe(false);
	});

	it("returns true (skips render) when remaining inactive outside the word group", () => {
		const prev: WordGroupProps = {
			words: sampleWords,
			currentTime: 300,
			onWordClick: onClickA,
		};
		const next: WordGroupProps = {
			words: sampleWords,
			currentTime: 500,
			onWordClick: onClickA,
		};

		// Both are inactive and props are unchanged, so memoization should hold
		expect(areWordGroupPropsEqual(prev, next)).toBe(true);
	});

	it("returns false when word content or length changes", () => {
		const prev: WordGroupProps = {
			words: sampleWords,
			currentTime: 300,
			onWordClick: onClickA,
		};
		const modifiedWords: LyricWord[] = [
			sampleWords[0],
			{ ...sampleWords[1], word: "everyone" },
		];
		const next: WordGroupProps = {
			words: modifiedWords,
			currentTime: 300,
			onWordClick: onClickA,
		};

		expect(areWordGroupPropsEqual(prev, next)).toBe(false);
	});

	it("returns false when the click handler reference changes", () => {
		const prev: WordGroupProps = {
			words: sampleWords,
			currentTime: 300,
			onWordClick: onClickA,
		};
		const next: WordGroupProps = {
			words: sampleWords,
			currentTime: 300,
			onWordClick: onClickB,
		};

		expect(areWordGroupPropsEqual(prev, next)).toBe(false);
	});
});
