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

import { MyLocation24Regular } from "@fluentui/react-icons";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { atom, useAtom, useAtomValue, useStore } from "jotai";
import { splitAtom } from "jotai/utils";
import { focusAtom } from "jotai-optics";
import {
	type FC,
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { ViewportList, type ViewportListRef } from "react-viewport-list";
import { currentTimeAtom } from "$/modules/audio/states";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import {
	geniusCategorizationEnabledAtom,
	geniusHeaderDetectionDialogShownAtom,
	geniusHeaderDetectionDialogOpenAtom,
} from "$/modules/settings/states/index.ts";
import type { LyricLine } from "$/types/ttml.ts";
import styles from "./index.module.css";
import { LyricLineView } from "./lyric-line-view";
import { SectionMetadataDialog } from "./SectionActions";

const lyricLinesOnlyAtom = splitAtom(
	focusAtom(lyricLinesAtom, (o) => o.prop("lyricLines")),
);

const findCurrentLineIndex = (lines: LyricLine[], currentTime: number) => {
	const scan = (predicate?: (line: LyricLine) => boolean) => {
		let previousIndex = -1;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (predicate && !predicate(line)) continue;
			if (line.endTime <= line.startTime) continue;
			if (currentTime < line.startTime) {
				return previousIndex !== -1 ? previousIndex : i;
			}
			if (currentTime >= line.startTime && currentTime <= line.endTime) {
				return i;
			}
			previousIndex = i;
		}
		return previousIndex;
	};

	const mainIndex = scan((line) => !line.isBG);
	if (mainIndex !== -1) return mainIndex;
	return scan();
};

export const LyricLinesView: FC = forwardRef<HTMLDivElement>((_props, ref) => {
	const editLyric = useAtomValue(lyricLinesOnlyAtom);
	const store = useStore();
	const viewRef = useRef<ViewportListRef>(null);
	const viewElRef = useRef<HTMLDivElement>(null);
	const toolMode = useAtomValue(toolModeAtom);
	const { t } = useTranslation();

	const scrollToIndexAtom = useMemo(
		() =>
			atom((get) => {
				if (toolMode !== ToolMode.Sync && toolMode !== ToolMode.Edit) return;
				const selectedLines = get(selectedLinesAtom);
				if (selectedLines.size === 0) return Number.NaN;
				const lyrics = get(lyricLinesAtom).lyricLines;
				const index = lyrics.findIndex((l) => selectedLines.has(l.id));
				return index === -1 ? Number.NaN : index;
			}),
		[toolMode],
	);
	const scrollToIndex = useAtomValue(scrollToIndexAtom);
	const lastScrolledIndexRef = useRef<number | undefined>(undefined);
	const lyricLines = useAtomValue(lyricLinesAtom).lyricLines;
	const collapsedSections = useAtomValue(collapsedSectionIdsAtom);
	const selectedLineIds = useAtomValue(selectedLinesAtom);
	const temporarilyRevealedSectionIds = useMemo(() => {
		const firstLineBySection = new Map<string, string>();
		for (const line of lyricLines) {
			if (line.sectionId && !firstLineBySection.has(line.sectionId)) {
				firstLineBySection.set(line.sectionId, line.id);
			}
		}
		return new Set(
			lyricLines
				.filter(
					(line) =>
						selectedLineIds.has(line.id) &&
						line.sectionId &&
						firstLineBySection.get(line.sectionId) !== line.id,
				)
				.map((line) => line.sectionId as string),
		);
	}, [lyricLines, selectedLineIds]);
	const visibleItems = useMemo(
		() =>
			editLyric
				.map((lineAtom, sourceIndex) => ({
					lineAtom,
					sourceIndex,
					line: lyricLines[sourceIndex],
				}))
				.filter(
					({ line, sourceIndex }) =>
						!line?.sectionId ||
						!collapsedSections.has(line.sectionId) ||
						temporarilyRevealedSectionIds.has(line.sectionId) ||
						lyricLines.findIndex(
							(candidate) => candidate.sectionId === line.sectionId,
						) === sourceIndex,
				),
		[editLyric, lyricLines, collapsedSections, temporarilyRevealedSectionIds],
	);

	const scrollToLineIndex = useCallback(
		(index: number) => {
			const viewEl = viewElRef.current;
			if (!viewEl) return;
			const viewContainerEl = viewEl.parentElement;
			if (!viewContainerEl) return;
			const visibleIndex = visibleItems.findIndex(
				(item) => item.sourceIndex === index,
			);
			if (visibleIndex === -1) return;
			viewRef.current?.scrollToIndex({
				index: visibleIndex,
				offset: viewContainerEl.clientHeight / -2 + 50,
			});
		},
		[visibleItems],
	);

	const geniusCategorizationEnabled = useAtomValue(
		geniusCategorizationEnabledAtom,
	);
	const dialogShown = useAtomValue(geniusHeaderDetectionDialogShownAtom);
	const [, setDetectionDialogOpen] = useAtom(
		geniusHeaderDetectionDialogOpenAtom,
	);

	useEffect(() => {
		if (dialogShown || geniusCategorizationEnabled) return;
		const hasHeader = lyricLines.some((line) =>
			/^\[(Chorus|Verse|Bridge|Intro|Outro|Pre-Chorus|Hook|Strofa|Refren|Skit|Interlude|Instrumental|Pre-Refren|Partea|Slofa|Section|Part|S\d+|V\d+|C\d+|Strophe|Refrain|Pont|Couplet|Refrain|Break).*?\]$/i.test(
				line.words.map((w) => w.word).join(""),
			),
		);
		if (hasHeader) {
			setDetectionDialogOpen(true);
		}
	}, [
		lyricLines,
		dialogShown,
		geniusCategorizationEnabled,
		setDetectionDialogOpen,
	]);

	useEffect(() => {
		if (
			scrollToIndex === undefined ||
			scrollToIndex === lastScrolledIndexRef.current
		)
			return;
		lastScrolledIndexRef.current = scrollToIndex;
		scrollToLineIndex(scrollToIndex);
	}, [scrollToIndex, scrollToLineIndex]);

	const handleLocate = useCallback(() => {
		const currentTime = store.get(currentTimeAtom);
		const lyricLines = store.get(lyricLinesAtom).lyricLines;
		const index = findCurrentLineIndex(lyricLines, currentTime);
		if (index === -1) return;
		scrollToLineIndex(index);
	}, [store, scrollToLineIndex]);

	useImperativeHandle(ref, () => viewElRef.current as HTMLDivElement, []);

	if (editLyric.length === 0)
		return (
			<Flex
				flexGrow="1"
				gap="2"
				align="center"
				justify="center"
				direction="column"
				height="100%"
				ref={ref}
			>
				<Text color="gray">{t("app.empty.title", "没有歌词行")}</Text>
				<Text color="gray">
					{t(
						"app.empty.description",
						"在顶部面板中添加新歌词行或从菜单栏打开 / 导入已有歌词",
					)}
				</Text>
			</Flex>
		);
	return (
		<Flex direction="column" flexGrow="1" className={styles.lyricLinesWrapper}>
			<SectionMetadataDialog />
			<Box
				flexGrow="1"
				style={{
					padding: toolMode === ToolMode.Sync ? "20vh 0" : undefined,
					height: "100%",
					maxHeight: "100%",
					overflowY: "auto",
					backgroundColor: "var(--editor-bg, transparent)",
				}}
				ref={viewElRef}
			>
				<ViewportList
					overscan={10}
					items={visibleItems}
					ref={viewRef}
					viewportRef={viewElRef}
				>
					{(item) => (
						<LyricLineView
							key={`${item.lineAtom}`}
							lineAtom={item.lineAtom}
							lineIndex={item.sourceIndex}
						/>
					)}
				</ViewportList>
			</Box>
			<Button
				className={styles.locateButton}
				variant="soft"
				onClick={handleLocate}
				title={t("lyricEditor.locate", "定位")}
			>
				<MyLocation24Regular />
			</Button>
		</Flex>
	);
});

export default LyricLinesView;
