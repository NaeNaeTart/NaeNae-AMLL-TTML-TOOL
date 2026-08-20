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
import { atom, useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { splitAtom } from "jotai/utils";
import { useSetImmerAtom } from "jotai-immer";
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
import { uid } from "uid";
import { guidePanelOpenAtom, guideStepAtom, guideWelcomeOpenAtom } from "$/modules/onboarding/states";
import { importLyricsChooserDialogAtom } from "$/states/dialogs";
import { useFileOpener } from "$/hooks/useFileOpener";
import { ViewportList, type ViewportListRef } from "react-viewport-list";
import { currentTimeAtom } from "$/modules/audio/states";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	geniusCategorizationEnabledAtom,
	geniusHeaderDetectionDialogOpenAtom,
	geniusHeaderDetectionDialogShownAtom,
	previewFollowsPlaybackAtom,
} from "$/modules/settings/states/index.ts";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import type { LyricLine } from "$/types/ttml.ts";
import { repairSectionIntegrity } from "../utils/section-system.ts";
import {
	clampScrollTop,
	DRAG_SCROLL_SPEED,
	getDragScrollDirection,
	normalizeWheelDelta,
} from "./drag-scroll";
import styles from "./index.module.css";
import { LyricLineView } from "./lyric-line-view";
import {
	draggingIdAtom,
	lastLineDragEndAtom,
	lineDragAtom,
	timingCopyPlacementAtom,
} from "./lyric-line-view-states";
import {
	CategorizeSelectionDialog,
	SectionManagerDialog,
	SectionMetadataDialog,
} from "./SectionActions";
import { shouldAutoCenterSelection } from "./selection-scroll";

const lyricLinesOnlyAtom = splitAtom(
	focusAtom(lyricLinesAtom, (o) => o.prop("lyricLines")),
);

let editorAnchorLineIndex = -1;

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
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const { t } = useTranslation();
	const setGuideWelcome = useSetAtom(guideWelcomeOpenAtom);
	const setGuidePanel = useSetAtom(guidePanelOpenAtom);
	const setGuideStep = useSetAtom(guideStepAtom);
	const setImportChooser = useSetAtom(importLyricsChooserDialogAtom);
	const { openFile } = useFileOpener();
	const openExistingTtml = useCallback(() => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".ttml,*/*";
		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (file) openFile(file);
		}, { once: true });
		input.click();
	}, [openFile]);

	useEffect(() => {
		if (toolMode === ToolMode.Preview) {
			store.set(timingCopyPlacementAtom, null);
		}
	}, [store, toolMode]);

	useEffect(() => {
		const viewEl = viewElRef.current;
		if (editLyric.length === 0 || !viewEl || toolMode !== ToolMode.Edit) return;

		let pointer: { x: number; y: number } | null = null;
		let animationFrame: number | null = null;
		let lastFrameTime: number | null = null;
		let dropTarget: { element: HTMLElement; insertAfter: boolean } | null =
			null;
		let dragPreview: HTMLElement | null = null;

		const updateDragPreview = () => {
			if (!dragPreview || !pointer) return;
			dragPreview.style.transform = `translate(${pointer.x + 16}px, ${pointer.y + 16}px)`;
		};

		const clearDragPreview = () => {
			dragPreview?.remove();
			dragPreview = null;
		};

		const showDragPreview = (dragId: string, isCopy = false) => {
			const lines = store.get(lyricLinesAtom).lyricLines;
			const lineIndex = lines.findIndex((candidate) => candidate.id === dragId);
			const line = lines[lineIndex];
			if (!line || lineIndex < 0) return;
			dragPreview = document.createElement("div");
			dragPreview.className = styles.dragPreview;
			dragPreview.setAttribute("aria-hidden", "true");
			if (isCopy) dragPreview.dataset.copy = "true";
			const lineNumber = document.createElement("span");
			lineNumber.className = styles.dragPreviewNumber;
			lineNumber.textContent = String(
				lines
					.slice(0, lineIndex + 1)
					.filter((candidate, index) => (index === 0 ? true : !candidate.isBG))
					.length,
			);
			const lyricText = document.createElement("span");
			lyricText.className = styles.dragPreviewText;
			lyricText.textContent =
				line.words.map((word) => word.word).join("") || "…";
			dragPreview.append(lineNumber, lyricText);
			const selectedCount = store.get(selectedLinesAtom).size;
			if (selectedCount > 1) {
				dragPreview.dataset.lineCount = String(selectedCount);
			}
			document.body.append(dragPreview);
			updateDragPreview();
		};

		const clearDropTarget = () => {
			if (!dropTarget) return;
			dropTarget.element.classList.remove(styles.dropTop, styles.dropBottom);
			dropTarget = null;
		};

		const stopScrolling = () => {
			pointer = null;
			lastFrameTime = null;
			if (animationFrame !== null) {
				cancelAnimationFrame(animationFrame);
				animationFrame = null;
			}
		};

		const updateDropTarget = () => {
			const drag = store.get(lineDragAtom);
			if (!drag?.isDragging || !pointer) {
				clearDropTarget();
				return;
			}
			const element = document
				.elementFromPoint(pointer.x, pointer.y)
				?.closest<HTMLElement>("[data-lyric-line-id]");
			const selectedLines = store.get(selectedLinesAtom);
			if (
				!element ||
				element.dataset.lyricLineId === drag.id ||
				selectedLines.has(element.dataset.lyricLineId ?? "")
			) {
				clearDropTarget();
				return;
			}
			const insertAfter =
				pointer.y >=
				element.getBoundingClientRect().top + element.clientHeight / 2;
			if (
				dropTarget?.element === element &&
				dropTarget.insertAfter === insertAfter
			)
				return;
			clearDropTarget();
			element.classList.toggle(styles.dropTop, !insertAfter);
			element.classList.toggle(styles.dropBottom, insertAfter);
			dropTarget = { element, insertAfter };
		};

		const scrollWhileDragging = (timestamp: number) => {
			animationFrame = null;
			const drag = store.get(lineDragAtom);
			if (!drag?.isDragging || !pointer) return;

			const direction = getDragScrollDirection(
				pointer.y,
				viewEl.getBoundingClientRect(),
			);
			if (direction !== 0 && lastFrameTime !== null) {
				const elapsedSeconds = (timestamp - lastFrameTime) / 1000;
				const maxScrollTop = viewEl.scrollHeight - viewEl.clientHeight;
				viewEl.scrollTop = clampScrollTop(
					viewEl.scrollTop,
					direction * DRAG_SCROLL_SPEED * elapsedSeconds,
					maxScrollTop,
				);
			}

			lastFrameTime = timestamp;
			updateDropTarget();
			if (direction !== 0) {
				animationFrame = requestAnimationFrame(scrollWhileDragging);
			}
		};

		const ensureScrolling = () => {
			if (animationFrame !== null) return;
			animationFrame = requestAnimationFrame(scrollWhileDragging);
		};

		const startPointerDrag = (event: PointerEvent) => {
			if (!event.isPrimary || event.button !== 0) return;
			const target = event.target;
			if (!(target instanceof Element)) return;
			const lineElement = target.closest<HTMLElement>("[data-lyric-line-id]");
			if (
				target.closest(
					"input, [data-lyric-word-interactive], [data-lyric-line-interactive]",
				)
			)
				return;
			const lineId = lineElement?.dataset.lyricLineId;
			if (!lineElement || !lineId || !viewEl.contains(lineElement)) return;
			lineElement.setPointerCapture(event.pointerId);
			store.set(lineDragAtom, {
				id: lineId,
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				isDragging: false,
				isCopy: event.ctrlKey || event.metaKey,
			});
		};
		const updatePointer = (event: PointerEvent) => {
			const drag = store.get(lineDragAtom);
			if (!drag || drag.pointerId !== event.pointerId) return;
			if (!drag.isDragging) {
				if (
					Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <
					5
				)
					return;
				store.set(lineDragAtom, { ...drag, isDragging: true });
				store.set(draggingIdAtom, drag.id);
				showDragPreview(drag.id, drag.isCopy);
			}
			event.preventDefault();
			pointer = { x: event.clientX, y: event.clientY };
			updateDragPreview();
			updateDropTarget();
			ensureScrolling();
		};

		const finishDragging = (event?: PointerEvent) => {
			const drag = store.get(lineDragAtom);
			if (!drag || (event && drag.pointerId !== event.pointerId)) return;
			if (drag.isDragging && dropTarget) {
				const targetId = dropTarget.element.dataset.lyricLineId;
				const insertAfter = dropTarget.insertAfter;
				const selectedLines = store.get(selectedLinesAtom);
				const selectedLineIds = selectedLines.has(drag.id)
					? selectedLines
					: new Set([drag.id]);
				if (drag.isCopy) {
					const clonedLines = store
						.get(lyricLinesAtom)
						.lyricLines.filter((line) => selectedLineIds.has(line.id))
						.map((line) => ({
							...line,
							id: uid(),
							words: line.words.map((word) => ({
								...word,
								id: uid(),
								ruby: word.ruby
									? word.ruby.map((ruby) => ({ ...ruby }))
									: undefined,
							})),
						}));
					editLyricLines((state) => {
						const targetIndex = state.lyricLines.findIndex(
							(line) => line.id === targetId,
						);
						if (targetIndex < 0) return;
						const insertionIndex = targetIndex + Number(insertAfter) + 1;
						state.lyricLines.splice(insertionIndex, 0, ...clonedLines);
						repairSectionIntegrity(state);
					});
					store.set(
						selectedLinesAtom,
						new Set(clonedLines.map((line) => line.id)),
					);
					store.set(selectedWordsAtom, new Set());
				} else {
					editLyricLines((state) => {
						const filteredLines = state.lyricLines.filter(
							(line) => !selectedLineIds.has(line.id),
						);
						const targetLines = state.lyricLines.filter((line) =>
							selectedLineIds.has(line.id),
						);
						const targetIndex = filteredLines.findIndex(
							(line) => line.id === targetId,
						);
						if (targetIndex < 0) return;
						const insertionIndex = targetIndex + Number(insertAfter);
						state.lyricLines = [
							...filteredLines.slice(0, insertionIndex),
							...targetLines,
							...filteredLines.slice(insertionIndex),
						];
						repairSectionIntegrity(state);
					});
				}
			}
			clearDropTarget();
			clearDragPreview();
			if (drag.isDragging) store.set(lastLineDragEndAtom, Date.now());
			store.set(lineDragAtom, null);
			store.set(draggingIdAtom, "");
			stopScrolling();
		};

		const scrollWithWheel = (event: WheelEvent) => {
			if (!store.get(lineDragAtom)?.isDragging || event.deltaY === 0) return;
			const computedLineHeight = Number.parseFloat(
				getComputedStyle(viewEl).lineHeight,
			);
			const lineHeight = Number.isFinite(computedLineHeight)
				? computedLineHeight
				: 16;
			const delta = normalizeWheelDelta(
				event.deltaY,
				event.deltaMode,
				lineHeight,
				viewEl.clientHeight,
			);
			const maxScrollTop = viewEl.scrollHeight - viewEl.clientHeight;
			viewEl.scrollTop = clampScrollTop(viewEl.scrollTop, delta, maxScrollTop);
			event.preventDefault();
		};
		const updateCopyMode = (isCopy: boolean) => {
			const drag = store.get(lineDragAtom);
			if (!drag?.isDragging || drag.isCopy === isCopy) return;
			store.set(lineDragAtom, { ...drag, isCopy });
			if (dragPreview) {
				if (isCopy) dragPreview.dataset.copy = "true";
				else delete dragPreview.dataset.copy;
			}
		};
		const handleDragKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey) updateCopyMode(true);
		};
		const handleDragKeyUp = (event: KeyboardEvent) => {
			if (!event.ctrlKey && !event.metaKey) updateCopyMode(false);
		};
		const handleWindowBlur = () => finishDragging();

		window.addEventListener("pointerdown", startPointerDrag, true);
		window.addEventListener("pointermove", updatePointer, true);
		window.addEventListener("pointerup", finishDragging, true);
		window.addEventListener("pointercancel", finishDragging, true);
		window.addEventListener("wheel", scrollWithWheel, {
			capture: true,
			passive: false,
		});
		window.addEventListener("keydown", handleDragKeyDown);
		window.addEventListener("keyup", handleDragKeyUp);
		window.addEventListener("blur", handleWindowBlur);

		return () => {
			finishDragging();
			window.removeEventListener("pointerdown", startPointerDrag, true);
			window.removeEventListener("pointermove", updatePointer, true);
			window.removeEventListener("pointerup", finishDragging, true);
			window.removeEventListener("pointercancel", finishDragging, true);
			window.removeEventListener("wheel", scrollWithWheel, true);
			window.removeEventListener("keydown", handleDragKeyDown);
			window.removeEventListener("keyup", handleDragKeyUp);
			window.removeEventListener("blur", handleWindowBlur);
		};
	}, [editLyric.length, editLyricLines, store, toolMode]);

	const scrollToIndexAtom = useMemo(
		() =>
			atom((get) => {
				if (!shouldAutoCenterSelection(toolMode)) return;
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
						lyricLines.findIndex(
							(candidate) => candidate.sectionId === line.sectionId,
						) === sourceIndex,
				),
		[editLyric, lyricLines, collapsedSections],
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

	const updateEditorAnchor = useCallback(() => {
		const viewEl = viewElRef.current;
		if (!viewEl) return;
		const viewRect = viewEl.getBoundingClientRect();
		const centerY = viewRect.top + viewRect.height / 2;
		let closest = -1;
		let closestDistance = Number.POSITIVE_INFINITY;
		for (const element of viewEl.querySelectorAll<HTMLElement>(
			"[data-lyric-line-index]",
		)) {
			const index = Number(element.dataset.lyricLineIndex);
			if (!Number.isFinite(index)) continue;
			const rect = element.getBoundingClientRect();
			const distance = Math.abs(rect.top + rect.height / 2 - centerY);
			if (distance < closestDistance) {
				closestDistance = distance;
				closest = index;
			}
		}
		if (closest >= 0) editorAnchorLineIndex = closest;
	}, []);

	useEffect(() => {
		const viewEl = viewElRef.current;
		if (!viewEl) return;
		updateEditorAnchor();
		viewEl.addEventListener("scroll", updateEditorAnchor, { passive: true });
		return () => viewEl.removeEventListener("scroll", updateEditorAnchor);
	}, [updateEditorAnchor]);

	const restoredAnchorRef = useRef(false);
	useEffect(() => {
		if (restoredAnchorRef.current) return;
		restoredAnchorRef.current = true;
		const index = editorAnchorLineIndex;
		if (index === -1) return;
		const raf = requestAnimationFrame(() => scrollToLineIndex(index));
		return () => cancelAnimationFrame(raf);
	}, [scrollToLineIndex]);

	const previewFollowsPlayback = useAtomValue(previewFollowsPlaybackAtom);
	const prevToolModeRef = useRef(toolMode);
	const lastActiveLineIndexRef = useRef<number>(-1);

	useEffect(() => {
		if (prevToolModeRef.current === toolMode) return;
		const fromMode = prevToolModeRef.current;
		prevToolModeRef.current = toolMode;

		// Don't restore anchor when switching TO Preview - Preview manages
		// its own scroll position via activeLineIds.
		if (toolMode === ToolMode.Preview) return;
		if (toolMode === ToolMode.Sync && store.get(selectedLinesAtom).size > 0)
			return;

		// If coming from Preview to Edit or Time and previewFollowsPlayback is on,
		// sync directly to current audio playback position.
		if (fromMode === ToolMode.Preview && previewFollowsPlayback) {
			const effectiveTime = audioEngine.musicPlaying
				? audioEngine.musicCurrentTime * 1000
				: store.get(currentTimeAtom);
			const lines = store.get(lyricLinesAtom).lyricLines;
			const index = findCurrentLineIndex(lines, effectiveTime);
			if (index !== -1) {
				const raf = requestAnimationFrame(() => scrollToLineIndex(index));
				return () => cancelAnimationFrame(raf);
			}
		}

		const index = editorAnchorLineIndex;
		if (index === -1) return;
		const raf = requestAnimationFrame(() => scrollToLineIndex(index));
		return () => cancelAnimationFrame(raf);
	}, [toolMode, previewFollowsPlayback, scrollToLineIndex, store]);

	const handleLocate = useCallback(() => {
		const currentTime = audioEngine.musicPlaying
			? audioEngine.musicCurrentTime * 1000
			: store.get(currentTimeAtom);
		const lyricLines = store.get(lyricLinesAtom).lyricLines;
		const index = findCurrentLineIndex(lyricLines, currentTime);
		if (index === -1) return;
		scrollToLineIndex(index);
	}, [store, scrollToLineIndex]);

	// Auto-scroll to active line in Edit/Time modes during playback or time changes
	useEffect(() => {
		if (toolMode !== ToolMode.Edit && toolMode !== ToolMode.Time) return;

		const syncPosition = () => {
			if (!previewFollowsPlayback && audioEngine.musicPlaying) return;
			const effectiveTime = audioEngine.musicPlaying
				? audioEngine.musicCurrentTime * 1000
				: store.get(currentTimeAtom);
			const lyricLines = store.get(lyricLinesAtom).lyricLines;
			const index = findCurrentLineIndex(lyricLines, effectiveTime);
			if (index !== -1 && index !== lastActiveLineIndexRef.current) {
				lastActiveLineIndexRef.current = index;
				scrollToLineIndex(index);
			}
		};

		// Initial sync
		syncPosition();

		const onTimeUpdate = () => {
			if (audioEngine.musicPlaying && previewFollowsPlayback) {
				syncPosition();
			}
		};

		audioEngine.addEventListener("music-timeupdate", onTimeUpdate);
		audioEngine.addEventListener("music-seeked", syncPosition);
		audioEngine.addEventListener("music-resume", syncPosition);

		return () => {
			audioEngine.removeEventListener("music-timeupdate", onTimeUpdate);
			audioEngine.removeEventListener("music-seeked", syncPosition);
			audioEngine.removeEventListener("music-resume", syncPosition);
		};
	}, [toolMode, previewFollowsPlayback, scrollToLineIndex, store]);

	useImperativeHandle(ref, () => viewElRef.current as HTMLDivElement, []);

	if (editLyric.length === 0)
		return (
			<Flex
				data-guide-target="editor"
				flexGrow="1"
				gap="2"
				align="center"
				justify="center"
				direction="column"
				height="100%"
				ref={ref}
			>
				<Text color="gray">{t("app.empty.title", "No lyric lines")}</Text>
				<Text color="gray" align="center">
					{t(
						"app.empty.description",
						"Add new lyric lines in the top panel or open/import existing lyrics from the menu",
					)}
				</Text>
				<Flex gap="2" wrap="wrap" justify="center" mt="2">
					<Button onClick={() => { setGuideStep(0); setGuidePanel(false); setGuideWelcome(true); }}>
						{t("beginnerGuide.empty.start", "Start Guide")}
					</Button>
					<Button variant="soft" onClick={() => setImportChooser(true)}>
						{t("beginnerGuide.empty.import", "Import Lyrics")}
					</Button>
					<Button variant="outline" onClick={openExistingTtml}>
						{t("beginnerGuide.empty.open", "Open TTML")}
					</Button>
				</Flex>
			</Flex>
		);
	return (
		<Flex data-guide-target="editor" direction="column" flexGrow="1" className={styles.lyricLinesWrapper}>
			<SectionMetadataDialog />
			<SectionManagerDialog />
			<CategorizeSelectionDialog />
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
				title={t("lyricEditor.locate", "Locate")}
			>
				<MyLocation24Regular />
			</Button>
		</Flex>
	);
});

export default LyricLinesView;
