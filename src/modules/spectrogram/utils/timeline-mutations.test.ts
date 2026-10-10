import { produce } from "immer";
import { beforeEach, describe, expect, it } from "vitest";
import { processSingleLine } from "$/modules/segmentation/utils/segment-processing";
import { lyricLinesAtom } from "$/states/main";
import { globalStore } from "$/states/store";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	commitUpdatedLine,
	getUpdatedLineForDivider,
} from "./timeline-mutations";

const line = {
	...newLyricLine(),
	id: "line",
	startTime: 100,
	endTime: 900,
	words: [
		{ ...newLyricWord(), id: "left", word: "a", startTime: 100, endTime: 500 },
		{ ...newLyricWord(), id: "right", word: "b", startTime: 500, endTime: 900 },
	],
};

beforeEach(() => {
	globalStore.set(lyricLinesAtom, { lyricLines: [line], metadata: [] });
});

describe("Alt-drag gaps", () => {
	it.each([
		["right", 650, 500, 650],
		["left", 350, 350, 500],
	] as const)("previews and commits a gap to the %s", (direction, time, start, end) => {
		const original = processSingleLine(line);
		const preview = getUpdatedLineForDivider(
			original,
			0,
			time,
			true,
			100,
			direction,
		);
		expect(preview.segments.map((segment) => segment.type)).toEqual([
			"word",
			"gap",
			"word",
		]);
		expect(preview.segments[1]).toMatchObject({
			startTime: start,
			endTime: end,
		});
		commitUpdatedLine(preview);
		const committed = processSingleLine(
			globalStore.get(lyricLinesAtom).lyricLines[0],
		);
		expect(
			committed.segments.map(({ type, startTime, endTime }) => ({
				type,
				startTime,
				endTime,
			})),
		).toEqual(
			preview.segments.map(({ type, startTime, endTime }) => ({
				type,
				startTime,
				endTime,
			})),
		);
		expect(original.segments[0].endTime).toBe(500);
		expect(original.segments[1].startTime).toBe(500);
	});

	it.each([
		["right", 350],
		["left", 650],
	] as const)("does not flip the locked %s side when crossing the initial boundary", (direction, time) => {
		const original = processSingleLine(line);
		expect(
			getUpdatedLineForDivider(original, 0, time, true, 100, direction),
		).toEqual(original);
	});

	it("clamps gap creation to the minimum word duration", () => {
		const preview = getUpdatedLineForDivider(
			processSingleLine(line),
			0,
			9999,
			true,
			100,
			"right",
		);
		expect(preview.segments[1]).toMatchObject({ type: "gap", endTime: 890 });
		expect(preview.segments[2]).toMatchObject({ startTime: 890, endTime: 900 });
	});

	it("resizes an existing virtual gap instead of creating a duplicate", () => {
		const withGap = produce(line, (draft) => {
			draft.words[1].startTime = 600;
		});
		const preview = getUpdatedLineForDivider(
			processSingleLine(withGap),
			0,
			400,
			true,
		);
		expect(
			preview.segments.filter((segment) => segment.type === "gap"),
		).toHaveLength(1);
		expect(preview.segments[1]).toMatchObject({ startTime: 400, endTime: 600 });
	});

	it("preserves ruby ownership and commits changes to the correct ruby syllable", () => {
		const rubyLine = {
			...line,
			words: [
				{
					...line.words[0],
					id: "ruby",
					word: "漢字",
					endTime: 900,
					ruby: [
						{ word: "かん", startTime: 100, endTime: 500 },
						{ word: "じ", startTime: 500, endTime: 900 },
					],
				},
			],
		};
		globalStore.set(lyricLinesAtom, { lyricLines: [rubyLine], metadata: [] });
		const preview = getUpdatedLineForDivider(
			processSingleLine(rubyLine),
			0,
			650,
			true,
			100,
			"right",
		);
		expect(preview.segments[2]).toMatchObject({
			parentId: "ruby",
			rubyIndex: 1,
			isRuby: true,
		});
		commitUpdatedLine(preview);
		const word = globalStore.get(lyricLinesAtom).lyricLines[0].words[0];
		expect(word.ruby).toEqual([
			{ word: "かん", startTime: 100, endTime: 500 },
			{ word: "じ", startTime: 650, endTime: 900 },
		]);
		expect(word).toMatchObject({ word: "漢字", startTime: 100, endTime: 900 });
	});

	it("keeps normal divider and line boundary drags working", () => {
		const original = processSingleLine(line);
		const divider = getUpdatedLineForDivider(original, 0, 600, false);
		expect(divider.segments[0].endTime).toBe(600);
		expect(divider.segments[1].startTime).toBe(600);
		expect(divider.segments).toHaveLength(2);
		expect(getUpdatedLineForDivider(original, -1, 200, true).startTime).toBe(
			200,
		);
		expect(getUpdatedLineForDivider(original, 1, 800, true).endTime).toBe(800);
	});
});
