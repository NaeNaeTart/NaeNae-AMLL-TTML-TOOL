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
import { ViewportList, type ViewportListRef } from "react-viewport-list";
import { useFileOpener } from "$/hooks/useFileOpener";
import { audioPlayingAtom, currentTimeAtom } from "$/modules/audio/states";
import {
	guidePanelOpenAtom,
	guideStepAtom,
	guideWelcomeOpenAtom,
} from "$/modules/onboarding/states";
import {
	geniusCategorizationEnabledAtom,
	geniusHeaderDetectionDialogOpenAtom,
	geniusHeaderDetectionDialogShownAtom,
} from "$/modules/settings/states/index.ts";
import {
	editAutoScrollAtom,
	syncAutoScrollAtom,
	syncFocusMainLineAtom,
} from "$/modules/settings/states/sync.ts";
import { isSpectrogramResizingAtom } from "$/modules/spectrogram/states/index.ts";
import { importLyricsChooserDialogAtom } from "$/states/dialogs";
import { keyLocateActiveLineAtom } from "$/states/keybindings.ts";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import type { LyricLine } from "$/types/ttml.ts";
import { useKeyBindingAtom } from "$/utils/keybindings.ts";
import {
	type SmoothScrollController,
	smoothScrollContainer,
} from "$/utils/smooth-scroll.ts";
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
import {
	findClosestLineToViewportCenter,
	shouldAutoCenterSelection,
} from "./selection-scroll";

const lyricLinesOnlyAtom = splitAtom(
	focusAtom(lyricLinesAtom, (o) => o.prop("lyricLines")),
);

let editorAnchorLineIndex = -1;

const findCurrentLineIndex = (
	lines: LyricLine[],
	currentTime: number,
	focusMainLine: boolean = true,
) => {
	const activeMainIndex = lines.findIndex(
		(line) =>
			!line.isBG &&
			line.endTime > line.startTime &&
			currentTime >= line.startTime &&
			currentTime <= line.endTime,
	);
	const activeBGIndex = lines.findIndex(
		(line) =>
			line.isBG &&
			line.endTime > line.startTime &&
			currentTime >= line.startTime &&
			currentTime <= line.endTime,
	);

	if (focusMainLine) {
		// If a v1 (main) vocal is ongoing, DISREGARD background lyrics and focus on the main line
		if (activeMainIndex !== -1) {
			return activeMainIndex;
		}
		// If no main vocal is ongoing, scroll to background lyric if active
		if (activeBGIndex !== -1) {
			return activeBGIndex;
		}
	} else {
		if (activeMainIndex !== -1) return activeMainIndex;
		if (activeBGIndex !== -1) return activeBGIndex;
	}

	// If currentTime has passed the end of all timed lyric lines, the song's lyrics have finished
	let maxEndTime = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.endTime > line.startTime && line.endTime > maxEndTime) {
			maxEndTime = line.endTime;
		}
	}
	if (maxEndTime > 0 && currentTime > maxEndTime) {
		return -1;
	}

	let previousIndex = -1;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.endTime <= line.startTime) continue;
		if (currentTime < line.startTime) {
			return previousIndex !== -1 ? previousIndex : i;
		}
		previousIndex = i;
	}
	return previousIndex;
};

export const LyricLinesView: FC = forwardRef<HTMLDivElement>((_props, ref) => {
	const editLyric = useAtomValue(lyricLinesOnlyAtom);
	const store = useStore();
	const viewRef = useRef<ViewportListRef>(null);
	const viewElRef = useRef<HTMLDivElement>(null);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const audioPlaying = useAtomValue(audioPlayingAtom);
	const currentTime = useAtomValue(currentTimeAtom);
	const pauseUntilRef = useRef<number>(0);
	const lastActiveLineIndexRef = useRef<number | undefined>(undefined);
	const isProgrammaticScrollingRef = useRef<boolean>(false);
	const activeScrollControllerRef = useRef<SmoothScrollController | null>(null);
	const isSpectrogramResizing = useAtomValue(isSpectrogramResizingAtom);
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
		input.addEventListener(
			"change",
			() => {
				const file = input.files?.[0];
				if (file) openFile(file);
			},
			{ once: true },
		);
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

		const showDragPreview = (dragId: string) => {
			const lines = store.get(lyricLinesAtom).lyricLines;
			const lineIndex = lines.findIndex((candidate) => candidate.id === dragId);
			const line = lines[lineIndex];
			if (!line || lineIndex < 0) return;
			dragPreview = document.createElement("div");
			dragPreview.className = styles.dragPreview;
			dragPreview.setAttribute("aria-hidden", "true");
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
				showDragPreview(drag.id);
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
		const handleWindowBlur = () => finishDragging();

		window.addEventListener("pointerdown", startPointerDrag, true);
		window.addEventListener("pointermove", updatePointer, true);
		window.addEventListener("pointerup", finishDragging, true);
		window.addEventListener("pointercancel", finishDragging, true);
		window.addEventListener("wheel", scrollWithWheel, {
			capture: true,
			passive: false,
		});
		window.addEventListener("blur", handleWindowBlur);

		return () => {
			finishDragging();
			window.removeEventListener("pointerdown", startPointerDrag, true);
			window.removeEventListener("pointermove", updatePointer, true);
			window.removeEventListener("pointerup", finishDragging, true);
			window.removeEventListener("pointercancel", finishDragging, true);
			window.removeEventListener("wheel", scrollWithWheel, true);
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

	const calculateLineTargetScroll = useCallback(
		(index: number) => {
			const viewEl = viewElRef.current;
			if (!viewEl) return null;
			const visibleIndex = visibleItems.findIndex(
				(item) => item.sourceIndex === index,
			);
			if (visibleIndex === -1) return null;

			const targetEl = viewEl.querySelector<HTMLElement>(
				`[data-lyric-line-index="${index}"]`,
			);
			if (targetEl) {
				const viewRect = viewEl.getBoundingClientRect();
				const wordsEl = targetEl.querySelector<HTMLElement>(
					`.${styles.lyricWordsContainer}`,
				);
				const contentEl =
					toolMode === ToolMode.Sync && wordsEl ? wordsEl : targetEl;
				const contentRect = contentEl.getBoundingClientRect();
				const contentTopInScroll =
					contentRect.top - viewRect.top + viewEl.scrollTop;
				const contentHeight = contentRect.height;
				const viewHeight = viewEl.clientHeight;

				return Math.max(
					0,
					Math.round(contentTopInScroll - (viewHeight - contentHeight) / 2),
				);
			}

			// If targetEl is not mounted in DOM yet by ViewportList, use estimated position
			const estimatedLineHeight = toolMode === ToolMode.Sync ? 65 : 44;
			const pad =
				toolMode === ToolMode.Sync && viewEl
					? Number.parseFloat(getComputedStyle(viewEl).paddingTop) || 0
					: 0;
			const estimatedTop = pad + visibleIndex * estimatedLineHeight;
			return Math.max(
				0,
				estimatedTop - (viewEl.clientHeight - estimatedLineHeight) / 2,
			);
		},
		[visibleItems, toolMode],
	);

	const scrollToLineIndex = useCallback(
		(index: number, smooth = false) => {
			const viewEl = viewElRef.current;
			if (!viewEl) return;
			const getTarget = () => {
				const target = calculateLineTargetScroll(index);
				return target !== null ? Math.max(0, target) : viewEl.scrollTop;
			};
			const initialTarget = getTarget();

			if (smooth) {
				activeScrollControllerRef.current?.cancel();
				activeScrollControllerRef.current = smoothScrollContainer(
					viewEl,
					getTarget,
					() => {
						isProgrammaticScrollingRef.current = true;
					},
					() => {
						isProgrammaticScrollingRef.current = false;
						activeScrollControllerRef.current = null;
					},
				);
			} else {
				activeScrollControllerRef.current?.cancel();
				activeScrollControllerRef.current = null;
				isProgrammaticScrollingRef.current = true;
				viewEl.scrollTop = initialTarget;
				requestAnimationFrame(() => {
					isProgrammaticScrollingRef.current = false;
				});
			}
		},
		[calculateLineTargetScroll],
	);
	const restoreEditorAnchorOnListReady = useCallback(
		(instance: ViewportListRef | null) => {
			viewRef.current = instance;
			if (!instance || editorAnchorLineIndex === -1) return;
			const anchorIndex = editorAnchorLineIndex;
			const visibleIndex = visibleItems.findIndex(
				(item) => item.sourceIndex === anchorIndex,
			);
			if (visibleIndex === -1) return;
			requestAnimationFrame(() => {
				const viewEl = viewElRef.current;
				if (!viewEl?.parentElement) return;
				const offset = viewEl.parentElement.clientHeight / -2 + 50;
				instance.scrollToIndex({ index: visibleIndex, offset });
				if (editorAnchorLineIndex === anchorIndex) {
					editorAnchorLineIndex = -1;
				}
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
		const positions = Array.from(
			viewEl.querySelectorAll<HTMLElement>("[data-lyric-line-index]"),
		).flatMap((element) => {
			const index = Number(element.dataset.lyricLineIndex);
			if (!Number.isFinite(index)) return [];
			const rect = element.getBoundingClientRect();
			return [{ index, top: rect.top, height: rect.height }];
		});
		editorAnchorLineIndex = findClosestLineToViewportCenter(
			viewRect.top + viewRect.height / 2,
			positions,
		);
	}, []);

	useEffect(() => {
		const viewEl = viewElRef.current;
		if (!viewEl) return;
		viewEl.addEventListener("scroll", updateEditorAnchor, { passive: true });
		return () => {
			updateEditorAnchor();
			viewEl.removeEventListener("scroll", updateEditorAnchor);
		};
	}, [updateEditorAnchor]);

	const syncAutoScroll = useAtomValue(syncAutoScrollAtom);
	const editAutoScroll = useAtomValue(editAutoScrollAtom);
	const syncFocusMainLine = useAtomValue(syncFocusMainLineAtom);
	const isAutoScrollActive =
		(toolMode === ToolMode.Sync && syncAutoScroll) ||
		(toolMode === ToolMode.Edit && editAutoScroll);

	const handleLocate = useCallback(() => {
		const curTime = store.get(currentTimeAtom);
		const lyricLines = store.get(lyricLinesAtom).lyricLines;
		let index = findCurrentLineIndex(lyricLines, curTime, syncFocusMainLine);
		if (index === -1 && lyricLines.length > 0) {
			for (let i = lyricLines.length - 1; i >= 0; i--) {
				if (lyricLines[i].endTime > lyricLines[i].startTime) {
					index = i;
					break;
				}
			}
		}
		if (index === -1 && lyricLines.length > 0) {
			index = 0;
		}
		if (index === -1) return;

		store.set(selectedLinesAtom, new Set());
		pauseUntilRef.current = 0;
		lastActiveLineIndexRef.current = index;
		scrollToLineIndex(index, true);
	}, [store, syncFocusMainLine, scrollToLineIndex]);

	useKeyBindingAtom(keyLocateActiveLineAtom, handleLocate, [handleLocate]);

	useEffect(() => {
		const el = viewElRef.current;
		if (!el) return;
		let prevHeight = el.clientHeight;

		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const newHeight = entry.contentRect.height;
				if (Math.abs(newHeight - prevHeight) > 3) {
					prevHeight = newHeight;
					// When spectrogram is being actively resized, do not fight or re-scroll on mouse jitter
					if (store.get(isSpectrogramResizingAtom)) return;
					if (store.get(selectedLinesAtom).size === 0) {
						let targetLine = -1;
						if (store.get(audioPlayingAtom)) {
							const curTime = store.get(currentTimeAtom);
							const lines = store.get(lyricLinesAtom).lyricLines;
							targetLine = findCurrentLineIndex(
								lines,
								curTime,
								syncFocusMainLine,
							);
						} else if (lastActiveLineIndexRef.current !== undefined) {
							targetLine = lastActiveLineIndexRef.current;
						}
						if (targetLine !== -1) {
							scrollToLineIndex(targetLine, false);
						}
					}
				}
			}
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, [syncFocusMainLine, scrollToLineIndex, store]);

	useEffect(() => {
		if (isSpectrogramResizing) return;
		const viewEl = viewElRef.current;
		if (!viewEl || store.get(selectedLinesAtom).size > 0) return;
		let targetLine = -1;
		if (store.get(audioPlayingAtom)) {
			const curTime = store.get(currentTimeAtom);
			const lines = store.get(lyricLinesAtom).lyricLines;
			targetLine = findCurrentLineIndex(lines, curTime, syncFocusMainLine);
		} else if (lastActiveLineIndexRef.current !== undefined) {
			targetLine = lastActiveLineIndexRef.current;
		}
		if (targetLine !== -1) {
			scrollToLineIndex(targetLine, false);
		}
	}, [isSpectrogramResizing, scrollToLineIndex, syncFocusMainLine, store]);

	const verticalPadding = useMemo(() => {
		if (toolMode !== ToolMode.Sync) return undefined;
		return "clamp(24px, 12vh, 80px) 0";
	}, [toolMode]);

	useEffect(() => {
		const onUserInteraction = () => {
			activeScrollControllerRef.current?.cancel();
			activeScrollControllerRef.current = null;
			isProgrammaticScrollingRef.current = false;
			pauseUntilRef.current = performance.now() + 3500;
			lastActiveLineIndexRef.current = undefined;
		};
		const onScroll = () => {
			const el = viewElRef.current;
			if (!el) return;

			// Do not treat programmatic animation or smooth transitions as user interruption
			if (isProgrammaticScrollingRef.current) {
				return;
			}

			// User scrolled via native scrollbar dragging, track click, or keyboard arrows
			pauseUntilRef.current = performance.now() + 3500;
			lastActiveLineIndexRef.current = undefined;
		};

		const el = viewElRef.current;
		el?.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("wheel", onUserInteraction, {
			capture: true,
			passive: true,
		});
		window.addEventListener("touchmove", onUserInteraction, {
			capture: true,
			passive: true,
		});
		window.addEventListener("touchstart", onUserInteraction, {
			capture: true,
			passive: true,
		});
		window.addEventListener("pointerdown", onUserInteraction, {
			capture: true,
			passive: true,
		});
		window.addEventListener("mousedown", onUserInteraction, {
			capture: true,
			passive: true,
		});

		return () => {
			activeScrollControllerRef.current?.cancel();
			activeScrollControllerRef.current = null;
			el?.removeEventListener("scroll", onScroll);
			window.removeEventListener("wheel", onUserInteraction, true);
			window.removeEventListener("touchmove", onUserInteraction, true);
			window.removeEventListener("touchstart", onUserInteraction, true);
			window.removeEventListener("pointerdown", onUserInteraction, true);
			window.removeEventListener("mousedown", onUserInteraction, true);
		};
	}, []);

	useEffect(() => {
		if (!isAutoScrollActive || isSpectrogramResizing) {
			lastActiveLineIndexRef.current = undefined;
			return;
		}

		if (!audioPlaying || selectedLines.size > 0) {
			activeScrollControllerRef.current?.cancel();
			activeScrollControllerRef.current = null;
			lastActiveLineIndexRef.current = undefined;
			return;
		}

		const now = performance.now();
		if (now < pauseUntilRef.current) {
			const remaining = pauseUntilRef.current - now;
			const timer = setTimeout(() => {
				if (
					!store.get(audioPlayingAtom) ||
					store.get(selectedLinesAtom).size > 0
				)
					return;
				const curTime = store.get(currentTimeAtom);
				const lines = store.get(lyricLinesAtom).lyricLines;
				const idx = findCurrentLineIndex(lines, curTime, syncFocusMainLine);
				if (idx !== -1 && idx !== lastActiveLineIndexRef.current) {
					lastActiveLineIndexRef.current = idx;
					scrollToLineIndex(idx, true);
				}
			}, remaining);
			return () => clearTimeout(timer);
		}

		const lyricLines = store.get(lyricLinesAtom).lyricLines;
		const index = findCurrentLineIndex(
			lyricLines,
			currentTime,
			syncFocusMainLine,
		);
		if (index === -1) {
			activeScrollControllerRef.current?.cancel();
			activeScrollControllerRef.current = null;
			return;
		}

		if (index === lastActiveLineIndexRef.current) return;
		lastActiveLineIndexRef.current = index;
		scrollToLineIndex(index, true);
	}, [
		isAutoScrollActive,
		isSpectrogramResizing,
		audioPlaying,
		selectedLines.size,
		currentTime,
		syncFocusMainLine,
		store,
		scrollToLineIndex,
	]);

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
				<Text color="gray">{t("app.empty.title", "没有歌词行")}</Text>
				<Text color="gray" align="center">
					{t(
						"app.empty.description",
						"在顶部面板中添加新歌词行或从菜单栏打开 / 导入已有歌词",
					)}
				</Text>
				<Flex gap="2" wrap="wrap" justify="center" mt="2">
					<Button
						onClick={() => {
							setGuideStep(0);
							setGuidePanel(false);
							setGuideWelcome(true);
						}}
					>
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
		<Flex
			data-guide-target="editor"
			direction="column"
			flexGrow="1"
			className={styles.lyricLinesWrapper}
		>
			<SectionMetadataDialog />
			<SectionManagerDialog />
			<CategorizeSelectionDialog />
			<Box
				flexGrow="1"
				style={{
					padding: verticalPadding,
					height: "100%",
					maxHeight: "100%",
					overflowY: "auto",
					backgroundColor: "var(--editor-bg, transparent)",
				}}
				ref={viewElRef}
			>
				<ViewportList
					overscan={25}
					itemSize={toolMode === ToolMode.Sync ? 65 : 44}
					items={visibleItems}
					ref={restoreEditorAnchorOnListReady}
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
			{(toolMode === ToolMode.Sync || toolMode === ToolMode.Edit) && (
				<Button
					className={styles.locateButton}
					variant="soft"
					onClick={handleLocate}
					title={t("lyricEditor.locate", "定位")}
				>
					<MyLocation24Regular />
				</Button>
			)}
		</Flex>
	);
});

export default LyricLinesView;
