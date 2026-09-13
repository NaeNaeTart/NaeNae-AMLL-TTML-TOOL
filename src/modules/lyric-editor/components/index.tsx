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
import { guidePanelOpenAtom, guideStepAtom, guideWelcomeOpenAtom } from "$/modules/onboarding/states";
import { importLyricsChooserDialogAtom } from "$/states/dialogs";
import { useFileOpener } from "$/hooks/useFileOpener";
import { ViewportList, type ViewportListRef } from "react-viewport-list";
import { audioPlayingAtom, currentTimeAtom } from "$/modules/audio/states";
import {
	syncAutoScrollAtom,
	syncFocusMainLineAtom,
} from "$/modules/settings/states/sync.ts";
import { keyLocateActiveLineAtom } from "$/states/keybindings.ts";
import { useKeyBindingAtom } from "$/utils/keybindings.ts";
import {
	geniusCategorizationEnabledAtom,
	geniusHeaderDetectionDialogOpenAtom,
	geniusHeaderDetectionDialogShownAtom,
} from "$/modules/settings/states/index.ts";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
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
import {
	AUTO_SCROLL_PAUSE_MS,
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
				if (!shouldAutoCenterSelection(toolMode)) return undefined;
				const selectedLines = get(selectedLinesAtom);
				if (selectedLines.size === 0) return undefined;
				const lyrics = get(lyricLinesAtom).lyricLines;
				const index = lyrics.findIndex((l) => selectedLines.has(l.id));
				return index === -1 ? undefined : index;
			}),
		[toolMode],
	);
	const scrollToIndex = useAtomValue(scrollToIndexAtom);
	const lastSelectionScrolledIndexRef = useRef<number | undefined>(undefined);
	const lastPlaybackScrolledIndexRef = useRef<number | undefined>(undefined);
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

	const scrollRafRef = useRef<number | null>(null);
	const lastProgrammaticScrollTimeRef = useRef<number>(0);

	const cancelScrollAnimation = useCallback(() => {
		if (scrollRafRef.current !== null) {
			cancelAnimationFrame(scrollRafRef.current);
			scrollRafRef.current = null;
		}
	}, []);

	const smoothScrollTo = useCallback(
		(viewEl: HTMLElement, targetTop: number, duration = 350) => {
			cancelScrollAnimation();
			const startTop = viewEl.scrollTop;
			const distance = targetTop - startTop;
			if (Math.abs(distance) < 2) return;

			const startTime = performance.now();
			const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

			const step = (now: number) => {
				const elapsed = now - startTime;
				const progress = Math.min(elapsed / duration, 1);
				lastProgrammaticScrollTimeRef.current = performance.now();
				viewEl.scrollTop = startTop + distance * easeOutCubic(progress);

				if (progress < 1) {
					scrollRafRef.current = requestAnimationFrame(step);
				} else {
					scrollRafRef.current = null;
				}
			};

			scrollRafRef.current = requestAnimationFrame(step);
		},
		[cancelScrollAnimation],
	);

	useEffect(() => {
		return () => {
			cancelScrollAnimation();
		};
	}, [cancelScrollAnimation]);

	const scrollToLineIndex = useCallback(
		(index: number, smooth = false) => {
			const viewEl = viewElRef.current;
			if (!viewEl) return;
			const targetEl = viewEl.querySelector<HTMLElement>(
				`[data-lyric-line-index="${index}"]`,
			);
			if (targetEl) {
				const targetRect = targetEl.getBoundingClientRect();
				const viewRect = viewEl.getBoundingClientRect();
				const targetTop = Math.max(
					0,
					viewEl.scrollTop +
						(targetRect.top - viewRect.top) -
						viewEl.clientHeight / 2 +
						targetRect.height / 2,
				);
				if (smooth) {
					smoothScrollTo(viewEl, targetTop, 350);
				} else {
					cancelScrollAnimation();
					lastProgrammaticScrollTimeRef.current = performance.now();
					viewEl.scrollTop = targetTop;
				}
				return;
			}
			const viewContainerEl = viewEl.parentElement;
			if (!viewContainerEl) return;
			const visibleIndex = visibleItems.findIndex(
				(item) => item.sourceIndex === index,
			);
			if (visibleIndex === -1) return;
			lastProgrammaticScrollTimeRef.current = performance.now();
			viewRef.current?.scrollToIndex({
				index: visibleIndex,
				offset: viewContainerEl.clientHeight / -2 + 50,
			});
			if (smooth) {
				requestAnimationFrame(() => {
					const el = viewEl.querySelector<HTMLElement>(
						`[data-lyric-line-index="${index}"]`,
					);
					if (el) {
						const elRect = el.getBoundingClientRect();
						const vRect = viewEl.getBoundingClientRect();
						const targetTop = Math.max(
							0,
							viewEl.scrollTop +
								(elRect.top - vRect.top) -
								viewEl.clientHeight / 2 +
								elRect.height / 2,
						);
						smoothScrollTo(viewEl, targetTop, 350);
					}
				});
			}
		},
		[visibleItems, smoothScrollTo, cancelScrollAnimation],
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

	const syncAutoScroll = useAtomValue(syncAutoScrollAtom);
	const syncFocusMainLine = useAtomValue(syncFocusMainLineAtom);
	const userScrolledAtRef = useRef<number>(0);
	const lastKnownTimeRef = useRef(0);
	const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const isPointerDownRef = useRef(false);

	const isAutoScrollActive =
		(toolMode === ToolMode.Sync || toolMode === ToolMode.Edit) &&
		syncAutoScroll;

	const cancelResumeTimer = useCallback(() => {
		if (resumeTimerRef.current !== null) {
			clearTimeout(resumeTimerRef.current);
			resumeTimerRef.current = null;
		}
	}, []);

	const scheduleResume = useCallback(
		(durationMs = AUTO_SCROLL_PAUSE_MS) => {
			cancelResumeTimer();
			if (!isAutoScrollActive) return;
			if (store.get(selectedLinesAtom).size > 0) return;
			if (isPointerDownRef.current) return;

			resumeTimerRef.current = setTimeout(() => {
				resumeTimerRef.current = null;
				if (!store.get(audioPlayingAtom)) return;
				if (store.get(selectedLinesAtom).size > 0) return;
				if (isPointerDownRef.current) return;

				const currentTime = store.get(currentTimeAtom);
				const lines = store.get(lyricLinesAtom).lyricLines;
				const index = findCurrentLineIndex(lines, currentTime, syncFocusMainLine);
				if (index !== -1) {
					lastPlaybackScrolledIndexRef.current = index;
					scrollToLineIndex(index, true);
				}
			}, durationMs);
		},
		[
			cancelResumeTimer,
			isAutoScrollActive,
			store,
			syncFocusMainLine,
			scrollToLineIndex,
		],
	);

	useEffect(() => {
		if (
			scrollToIndex === undefined ||
			Number.isNaN(scrollToIndex) ||
			scrollToIndex === lastSelectionScrolledIndexRef.current
		)
			return;
		lastSelectionScrolledIndexRef.current = scrollToIndex;
		cancelScrollAnimation();
		cancelResumeTimer();
		userScrolledAtRef.current = Date.now();
		scrollToLineIndex(scrollToIndex, true);
	}, [scrollToIndex, scrollToLineIndex, cancelResumeTimer, cancelScrollAnimation]);

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

	const handleScroll = useCallback(() => {
		updateEditorAnchor();
		if (!isAutoScrollActive) return;
		if (performance.now() - lastProgrammaticScrollTimeRef.current < 50) {
			return;
		}
		cancelScrollAnimation();
		userScrolledAtRef.current = Date.now();
		if (!isPointerDownRef.current && store.get(selectedLinesAtom).size === 0) {
			scheduleResume(AUTO_SCROLL_PAUSE_MS);
		}
	}, [updateEditorAnchor, isAutoScrollActive, cancelScrollAnimation, scheduleResume, store]);

	useEffect(() => {
		const viewEl = viewElRef.current;
		if (!viewEl) return;
		viewEl.addEventListener("scroll", handleScroll, { passive: true });
		return () => {
			updateEditorAnchor();
			viewEl.removeEventListener("scroll", handleScroll);
		};
	}, [handleScroll, updateEditorAnchor]);

	const handleLocate = useCallback(() => {
		cancelResumeTimer();
		if (store.get(selectedLinesAtom).size > 0) {
			store.set(selectedLinesAtom, new Set());
		}
		userScrolledAtRef.current = 0;
		const currentTime = store.get(currentTimeAtom);
		const lyricLines = store.get(lyricLinesAtom).lyricLines;
		const index = findCurrentLineIndex(lyricLines, currentTime, syncFocusMainLine);
		if (index !== -1) {
			lastPlaybackScrolledIndexRef.current = index;
			scrollToLineIndex(index, true);
		}
	}, [store, syncFocusMainLine, scrollToLineIndex, cancelResumeTimer]);

	useKeyBindingAtom(keyLocateActiveLineAtom, handleLocate, [handleLocate]);

	// Track pointer hold state, wheel, touch, and keyboard interactions
	useEffect(() => {
		if (!isAutoScrollActive) return;
		const viewEl = viewElRef.current;
		if (!viewEl) return;

		const onPointerDown = (evt: Event) => {
			if ((evt.target as HTMLElement | null)?.closest(`.${styles.locateButton}`))
				return;
			isPointerDownRef.current = true;
			cancelScrollAnimation();
			cancelResumeTimer();
			userScrolledAtRef.current = Date.now();
		};

		const onPointerUp = () => {
			if (!isPointerDownRef.current) return;
			isPointerDownRef.current = false;
			userScrolledAtRef.current = Date.now();
			if (store.get(selectedLinesAtom).size === 0) {
				scheduleResume(AUTO_SCROLL_PAUSE_MS);
			}
		};

		const onWheel = () => {
			cancelScrollAnimation();
			userScrolledAtRef.current = Date.now();
			if (store.get(selectedLinesAtom).size === 0) {
				scheduleResume(AUTO_SCROLL_PAUSE_MS);
			}
		};

		const onKeyDown = () => {
			userScrolledAtRef.current = Date.now();
			if (store.get(selectedLinesAtom).size === 0) {
				scheduleResume(AUTO_SCROLL_PAUSE_MS);
			}
		};

		viewEl.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
		window.addEventListener("pointerup", onPointerUp, { capture: true, passive: true });
		window.addEventListener("pointercancel", onPointerUp, { capture: true, passive: true });
		viewEl.addEventListener("touchmove", onPointerDown, { capture: true, passive: true });
		viewEl.addEventListener("wheel", onWheel, { capture: true, passive: true });
		viewEl.addEventListener("keydown", onKeyDown, { capture: true, passive: true });

		return () => {
			viewEl.removeEventListener("pointerdown", onPointerDown, { capture: true });
			window.removeEventListener("pointerup", onPointerUp, { capture: true });
			window.removeEventListener("pointercancel", onPointerUp, { capture: true });
			viewEl.removeEventListener("touchmove", onPointerDown, { capture: true });
			viewEl.removeEventListener("wheel", onWheel, { capture: true });
			viewEl.removeEventListener("keydown", onKeyDown, { capture: true });
			cancelResumeTimer();
		};
	}, [isAutoScrollActive, scheduleResume, cancelResumeTimer, cancelScrollAnimation, store]);

	// When a line is selected, cancel auto-scroll resume so it stays locked forever
	useEffect(() => {
		if (!isAutoScrollActive) return;
		return store.sub(selectedLinesAtom, () => {
			const selected = store.get(selectedLinesAtom);
			if (selected.size > 0) {
				cancelResumeTimer();
				cancelScrollAnimation();
				userScrolledAtRef.current = Date.now();
			}
		});
	}, [isAutoScrollActive, store, cancelResumeTimer, cancelScrollAnimation]);

	useEffect(() => {
		if (!isAutoScrollActive) return;
		return store.sub(currentTimeAtom, () => {
			const currentTime = store.get(currentTimeAtom);
			if (Math.abs(currentTime - lastKnownTimeRef.current) > AUTO_SCROLL_PAUSE_MS) {
				if (
					Date.now() - userScrolledAtRef.current > 500 &&
					!isPointerDownRef.current &&
					store.get(selectedLinesAtom).size === 0
				) {
					userScrolledAtRef.current = 0;
					cancelResumeTimer();
				}
			}
			lastKnownTimeRef.current = currentTime;

			// Skip if playback is paused
			if (!store.get(audioPlayingAtom)) return;
			// Skip if pointer is currently held down (user dragging or holding scrollbar)
			if (isPointerDownRef.current) return;
			// Skip if any line is selected (stays locked forever until deselected or locate triggered)
			if (store.get(selectedLinesAtom).size > 0) return;
			// Skip if user interacted/scrolled within last 3.5s
			if (Date.now() - userScrolledAtRef.current < AUTO_SCROLL_PAUSE_MS) return;
			// Skip if an input or textarea is focused
			const activeTag = document.activeElement?.tagName;
			if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

			const lines = store.get(lyricLinesAtom).lyricLines;
			const index = findCurrentLineIndex(lines, currentTime, syncFocusMainLine);
			if (index !== -1 && index !== lastPlaybackScrolledIndexRef.current) {
				lastPlaybackScrolledIndexRef.current = index;
				scrollToLineIndex(index, true);
			}
		});
	}, [store, isAutoScrollActive, syncFocusMainLine, scrollToLineIndex, cancelResumeTimer]);

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
					padding:
						toolMode === ToolMode.Sync
							? "clamp(24px, 12vh, 80px) 0"
							: undefined,
					height: "100%",
					maxHeight: "100%",
					overflowY: "auto",
					backgroundColor: "var(--editor-bg, transparent)",
				}}
				ref={viewElRef}
			>
				<ViewportList
					overscan={25}
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
					title={t("lyricEditor.locate", "Centrar línea activa (Ctrl+Shift+L)")}
				>
					<MyLocation24Regular />
				</Button>
			)}
		</Flex>
	);
});

export default LyricLinesView;
