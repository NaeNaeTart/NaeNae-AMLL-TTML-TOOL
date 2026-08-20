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

import type {
	LyricLine as AMLLLyricLine,
	LyricWord as AMLLLyricWord,
} from "@applemusic-like-lyrics/lyric";
import { uid } from "uid";

export interface TTMLMetadata {
	key: string;
	value: string[];
	error?: boolean;
}

export interface Mark {
	timeMs: number;
	label?: string;
	description?: string;
}

export interface TTMLLyric {
	metadata: TTMLMetadata[];
	lyricLines: LyricLine[];
	marks?: Mark[];
	sections?: LyricSection[];
	reversedSyncLineIds?: string[];
	vocalistNames?: Record<string, string>;
}

export const LYRIC_SECTION_CATEGORIES = [
	"intro",
	"verse",
	"pre-chorus",
	"chorus",
	"post-chorus",
	"refrain",
	"hook",
	"bridge",
	"break",
	"interlude",
	"instrumental",
	"solo",
	"spoken",
	"skit",
	"sample",
	"outro",
	"other",
] as const;

export type LyricSectionCategory = (typeof LYRIC_SECTION_CATEGORIES)[number];

export interface LyricSection {
	id: string;
	label: string;
	category: LyricSectionCategory;
	ordinal?: number;
	color?: string;
	notes?: string;
	vocalist?: string;
	confidence?: number;
	repeatGroupId?: string;
}

export interface LyricWordBase {
	startTime: number;
	endTime: number;
	word: string;
	emptyBeat?: number;
}

export interface LyricWord extends AMLLLyricWord {
	id: string;
	startTime: number;
	endTime: number;
	word: string;
	obscene: boolean;
	emptyBeat: number;
	romanWarning?: boolean;
	grammarWarning?: boolean;
	ruby?: LyricWordBase[];
	romanWord: string;
}

export const newLyricWord = (): LyricWord => ({
	id: uid(),
	startTime: 0,
	endTime: 0,
	word: "",
	obscene: false,
	emptyBeat: 0,
	romanWord: "",
});

export interface LyricLine extends AMLLLyricLine {
	id: string;
	words: LyricWord[];
	
	isMiddle?: boolean;
	
	isDuetGroup?: boolean;
	startTime: number;
	endTime: number;
	ignoreSync: boolean;
	
	isLineSynced?: boolean;
	language?: string;
	agent?: string;
	
	endTimeLink?: {
		
		originalEndTime: number;
		
		originalNextStartTime: number | null;
	};
	sectionId?: string;
	
	geniusHeader?: string;
}

export const newLyricLine = (): LyricLine => ({
	id: uid(),
	words: [],
	translatedLyric: "",
	romanLyric: "",
	isBG: false,
	isDuet: false,
	isMiddle: false,
	isDuetGroup: false,
	startTime: 0,
	endTime: 0,
	ignoreSync: false,
	isLineSynced: false,
	language: "auto",
});
