/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 * This source code is part of AMLL TTML Tool and is licensed under GPLv3.
 * https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/blob/main/LICENSE
 */

import { atom } from "jotai";
import { selectAtom, splitAtom } from "jotai/utils";
import { focusAtom } from "jotai-optics";
import { lyricLinesAtom } from "$/states/main.ts";

export const lyricLinesOnlyAtom = splitAtom(
	focusAtom(lyricLinesAtom, (o) => o.prop("lyricLines")),
	(line) => line.id,
);

// Adapted from apoint123's upstream structural subscription fix (eb67dea0).
// Section membership and background status also affect this fork's list layout.
export const lyricLineStructureAtom = selectAtom(
	lyricLinesAtom,
	(state) =>
		state.lyricLines.map(({ id, sectionId, isBG }) => ({
			id,
			sectionId,
			isBG,
		})),
	(prev, next) =>
		prev.length === next.length &&
		prev.every(
			(line, index) =>
				line.id === next[index].id &&
				line.sectionId === next[index].sectionId &&
				line.isBG === next[index].isBG,
		),
);

export const lineDisplayNumbersAtom = atom((get) => {
	let currentNumber = 0;
	return get(lyricLineStructureAtom).map((line, index) => {
		if (index === 0 || !line.isBG) currentNumber++;
		return currentNumber;
	});
});

// Header detection must still respond to text edits without subscribing the list
// to every word and timestamp in the document.
export const hasGeniusHeaderAtom = selectAtom(lyricLinesAtom, (state) =>
	state.lyricLines.some((line) =>
		/^\[(Chorus|Verse|Bridge|Intro|Outro|Pre-Chorus|Hook|Strofa|Refren|Skit|Interlude|Instrumental|Pre-Refren|Partea|Slofa|Section|Part|S\d+|V\d+|C\d+|Strophe|Refrain|Pont|Couplet|Refrain|Break).*?\]$/i.test(
			line.words.map((word) => word.word).join(""),
		),
	),
);
