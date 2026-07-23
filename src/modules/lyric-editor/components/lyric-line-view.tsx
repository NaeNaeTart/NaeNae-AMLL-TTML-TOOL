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

import {
	AddFilled,
	LinkMultiple20Regular,
	TextAlignRightFilled,
	VideoBackgroundEffectFilled,
} from "@fluentui/react-icons";
import {
	Button,
	ContextMenu,
	Flex,
	IconButton,
	Text,
	TextField,
} from "@radix-ui/themes";
import { suggestedSplitsDialogAtom } from "$/states/dialogs.ts";
import classNames from "classnames";
import { toast } from "react-toastify";
import { useAtom, type Atom, atom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { selectAtom, splitAtom } from "jotai/utils";
import {
	type FC,
	Fragment,
	memo,
	type SyntheticEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
	showLineTranslationAtom,
	showLineRomanizationAtom,
	showTimestampsAtom,
	showWordRomanizationInputAtom,
	compactBGInSyncAtom,
	geniusCategorizationEnabledAtom,
	advGeniusHeaderColorAtom,
} from "$/modules/settings/states/index.ts";
import {
	syncLevelModeAtom,
	visualizeTimestampUpdateAtom,
} from "$/modules/settings/states/sync.ts";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	showEndTimeAsDurationAtom,
	toolModeAtom,
	ToolMode,
} from "$/states/main.ts";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml.ts";
import { msToTimestamp } from "$/utils/timestamp.ts";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import { getSynchronizableUnits } from "../utils/lyric-states.ts";
import {
	copySectionTimings,
	findPreviousMatchingSection,
	shiftSectionToTime,
} from "../utils/genius-sections.ts";
import styles from "./index.module.css";
import { draggingIdAtom, globalEnableInsertAtom } from "./lyric-line-view-states.ts";
import { LyricLineMenu } from "./lyric-line-menu.tsx";
import LyricWordView from "./lyric-word-view.tsx";
import { RomanWordView } from "./roman-word-view.tsx";


const isDraggingAtom = atom(false);
const parseRubyShortcut = (value: string) => {
	if (value.endsWith("|")) {
		return {
			word: value.slice(0, -1),
			enableRuby: true,
		};
	}
	return {
		word: value,
		enableRuby: false,
	};
};

// 定义一个派生 Atom，用于计算每一行的显示行号
// 性能优化：只有当行数或 isBG 状态发生变化时，才重新计算行号
// 这样在打轴（仅修改时间戳）时，不会触发全量行号重新计算
const isBGSequenceAtom = selectAtom(
	lyricLinesAtom,
	(state) => state.lyricLines.map((line) => line.isBG),
	(prev, next) => {
		if (prev.length !== next.length) return false;
		for (let i = 0; i < prev.length; i++) {
			if (prev[i] !== next[i]) return false;
		}
		return true;
	},
);

const lineDisplayNumbersAtom = atom((get) => {
	const { lyricLines } = get(lyricLinesAtom);
	get(isBGSequenceAtom); // 订阅稳定序列的变化
	const displayNumbers: number[] = [];
	let currentNumber = 0;

	for (const [index, line] of lyricLines.entries()) {
		if (!index || !line.isBG) {
			currentNumber++;
		}
		displayNumbers.push(currentNumber);
	}

	return displayNumbers;
});

const LyricLineScroller = ({
	lineAtom,
	wordsContainer,
	editingRomanWordIndex,
}: {
	lineAtom: Atom<LyricLine>;
	wordsContainer: HTMLDivElement | null;
	editingRomanWordIndex: number | null;
}) => {
	const scrollToIndexAtom = useMemo(
		() =>
			atom((get) => {
				const line = get(lineAtom);
				const selectedWords = get(selectedWordsAtom);
				if (selectedWords.size === 0) return Number.NaN;
				let scrollToIndex = Number.NaN;
				let i = 0;
				for (const word of line.words) {
					if (selectedWords.has(word.id)) {
						scrollToIndex = i;
						break;
					}
					i++;
				}
				return scrollToIndex;
			}),
		[lineAtom],
	);
	const scrollToIndex = useAtomValue(scrollToIndexAtom);

	useEffect(() => {
		const targetIndex = !Number.isNaN(scrollToIndex)
			? scrollToIndex
			: editingRomanWordIndex;
		if (targetIndex === null || Number.isNaN(targetIndex)) return;
		// console.log({ scrollToIndex, wordsContainer });
		if (!wordsContainer) return;
		const wordEl = wordsContainer.children[targetIndex] as HTMLElement;
		// console.log({ wordEl, wordsContainer });
		if (!wordEl) return;
		wordsContainer.scrollTo({
			left: wordEl.offsetLeft - wordsContainer.clientWidth / 2,
			behavior: "auto",
		});
	}, [scrollToIndex, editingRomanWordIndex, wordsContainer]);

	useEffect(() => {
		if (!wordsContainer) return;
		const handleFocusIn = (evt: FocusEvent) => {
			const target = evt.target as HTMLElement | null;
			if (!target) return;
			const wordGroup = target.closest<HTMLElement>("[data-word-index]");
			if (!wordGroup || !wordsContainer.contains(wordGroup)) return;
			wordsContainer.scrollTo({
				left: wordGroup.offsetLeft - wordsContainer.clientWidth / 2,
				behavior: "auto",
			});
		};
		wordsContainer.addEventListener("focusin", handleFocusIn);
		return () => {
			wordsContainer.removeEventListener("focusin", handleFocusIn);
		};
	}, [wordsContainer]);

	return null;
};

const SubLineEdit = memo(
	({
		lineAtom,
		lineIndex,
		type,
	}: {
		lineAtom: Atom<LyricLine>;
		lineIndex: number;
		type: "translatedLyric" | "romanLyric";
	}) => {
		const editLyricLines = useSetImmerAtom(lyricLinesAtom);
		const line = useAtomValue(lineAtom);
		const [editing, setEditing] = useState(false);
		const [inputValue, setInputValue] = useState("");
		const { t } = useTranslation();

		const onEnter = useCallback(
			(evt: SyntheticEvent<HTMLInputElement>) => {
				setEditing(false);
				const newValue = evt.currentTarget.value;
				if (newValue !== line[type]) {
					editLyricLines((state) => {
						state.lyricLines[lineIndex][type] = newValue;
					});
				}
			},
			[editLyricLines, line, lineIndex, type],
		);

		useEffect(() => {
			if (editing) {
				setInputValue(line[type] || "");
			}
		}, [editing, line, type]);

		const inputWidth = useMemo(() => {
			if (inputValue.length > 0) {
				return `${Math.min(Math.max(inputValue.length, 2), 60)}ch`;
			}
			return "12ch";
		}, [inputValue]);

		const label = useMemo(
			() =>
				type === "translatedLyric"
					? t("lyricLineView.translatedLabel", "翻译：")
					: t("lyricLineView.romanLabel", "音译："),
			[type, t],
		);

		return (
			<Flex align="baseline" style={{ 
				color: type === "translatedLyric" ? "var(--translation-color, inherit)" : "var(--romanization-color, inherit)" 
			}}>
				<Text size="2" style={{ color: "inherit" }}>{label}</Text>
				{editing ? (
					<TextField.Root
						autoFocus
						size="1"
						value={inputValue}
						style={{ width: inputWidth }}
						onChange={(evt) => setInputValue(evt.currentTarget.value)}
						onBlur={onEnter}
						onKeyDown={(evt) => {
							if (evt.key === "Enter") onEnter(evt);
						}}
					/>
				) : (
					<Button
						size="2"
						variant="ghost"
						style={{ color: "inherit" }}
						onClick={(evt) => {
							evt.stopPropagation();
							setEditing(true);
						}}
					>
						{line[type] || (
							<Text color="gray">{t("lyricLineView.empty", "无")}</Text>
						)}
					</Button>
				)}
			</Flex>
		);
	},
);

const InsertLineButton = ({
	lineIndex,
	selectedLinesCountAtom,
	disableInsert,
}: {
	lineIndex: number;
	selectedLinesCountAtom: Atom<number>;
	disableInsert: () => void;
}) => {
	const { t } = useTranslation();
	const store = useStore();
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const selectedLinesCount = useAtomValue(selectedLinesCountAtom);

	return (
		<Button
			mx="2"
			my="1"
			variant="soft"
			size="1"
			style={{
				width: "calc(100% - var(--space-4))",
			}}
			onClick={(evt) => {
				editLyricLines((state) => {
					const selectedLines = store.get(selectedLinesAtom);
					if (selectedLines.size > 0) {
						const linesToCopy = state.lyricLines.filter((l) =>
							selectedLines.has(l.id),
						);
						const newLines = linesToCopy.map((l) => ({
							...l,
							id: newLyricLine().id,
							words: l.words.map((w) => ({
								...w,
								id: newLyricWord().id,
							})),
						}));
						state.lyricLines.splice(lineIndex, 0, ...newLines);
					} else {
						state.lyricLines.splice(lineIndex, 0, newLyricLine());
					}
				});
				if (!evt.shiftKey) {
					disableInsert();
				}
			}}
		>
			{selectedLinesCount > 0
				? t("lyricLineView.duplicateLinesHere", {
						count: selectedLinesCount,
						defaultValue: "Duplicate {count} selected line(s) here",
				  })
				: t("lyricLineView.insertLine", "在此插入新行")}
		</Button>
	);
};

export const LyricLineView: FC<{
	lineAtom: Atom<LyricLine>;
	lineIndex: number;
}> = memo(({ lineAtom, lineIndex }) => {
	const { t } = useTranslation();
	const line = useAtomValue(lineAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const lineSelectedAtom = useMemo(() => {
		const a = atom((get) => get(selectedLinesAtom).has(line.id));
		if (import.meta.env.DEV) {
			a.debugLabel = `lineSelectedAtom-${line.id}`;
		}
		return a;
	}, [line.id]);
	const wordsAtom = useMemo(
		() => splitAtom(atom((get) => get(lineAtom).words)),
		[lineAtom],
	);
	const words = useAtomValue(wordsAtom);
	const lineSelected = useAtomValue(lineSelectedAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const visualizeTimestampUpdate = useAtomValue(visualizeTimestampUpdateAtom);
	const showTimestamps = useAtomValue(showTimestampsAtom);
	const showEndTimeAsDuration = useAtomValue(showEndTimeAsDurationAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const syncLevelMode = useAtomValue(syncLevelModeAtom);
	const store = useStore();
	const geniusCategorizationEnabled = useAtomValue(geniusCategorizationEnabledAtom);

	const activeGeniusHeader = geniusCategorizationEnabled ? line.geniusHeader : undefined;

	const customHeaderColor = useAtomValue(advGeniusHeaderColorAtom);

	const headerType = useMemo(() => {
		if (!activeGeniusHeader) return "accent";
		const match = activeGeniusHeader.match(
			/^\[(Chorus|Verse|Bridge|Intro|Outro|Pre-Chorus|Hook|Strofa|Refren|Skit|Interlude|Instrumental|Pre-Refren|Partea|Slofa|Section|Part|S\d+|V\d+|C\d+|Strophe|Refrain|Pont|Couplet|Refrain|Break).*?\]$/i,
		);
		return match ? match[1].toLowerCase() : "accent";
	}, [activeGeniusHeader]);

	const isSectionStart = useMemo(() => {
		if (!activeGeniusHeader) return false;
		if (lineIndex === 0) return true;
		const prevLine = store.get(lyricLinesAtom).lyricLines[lineIndex - 1];
		return prevLine?.geniusHeader !== activeGeniusHeader;
	}, [activeGeniusHeader, lineIndex, store]);

	const categoryColor = useMemo(() => {
		if (!headerType) return "accent";
		if (headerType.includes("chorus") || headerType.includes("refren") || headerType.includes("refrain")) return "pink";
		if (headerType.includes("verse") || headerType.includes("strofa") || headerType.includes("couplet")) return "blue";
		if (headerType.includes("bridge")) return "orange";
		if (headerType.includes("intro") || headerType.includes("outro") || headerType.includes("skit") || headerType.includes("interlude")) return "gray";
		return "accent";
	}, [headerType]);

	const wordsContainerRef = useRef<HTMLDivElement>(null);
	const blockDragRef = useRef(false);
	const lastClickTimeRef = useRef(0);

	const isLastLineAtom = useMemo(
		() => atom((get) => get(lyricLinesAtom).lyricLines.length - 1 === lineIndex),
		[lineIndex],
	);
	const isLastLine = useAtomValue(isLastLineAtom);

	const selectedLinesCountAtom = useMemo(
		() => atom((get) => get(selectedLinesAtom).size),
		[],
	);

	// 创建一个仅订阅当前行显示行号的 atom，优化性能
	const displayNumberAtom = useMemo(
		() => atom((get) => get(lineDisplayNumbersAtom)[lineIndex]),
		[lineIndex],
	);
	const displayNumber = useAtomValue(displayNumberAtom);
	const selectedLinesCount = useAtomValue(selectedLinesCountAtom);

	const hasError = useMemo(() => {
		if (line.startTime > line.endTime) {
			return true;
		}
		for (const word of line.words) {
			if (word.startTime > word.endTime) {
				return true;
			}
		}
		return false;
	}, [line.startTime, line.endTime, line.words]);

	const showWordRomanizationInput = useAtomValue(showWordRomanizationInputAtom);
	const showTranslation = useAtomValue(showLineTranslationAtom);
	const showRomanization = useAtomValue(showLineRomanizationAtom);
	const editingRomanWordIndexAtom = useMemo(
		() => atom<number | null>(null),
		[],
	);
	const editingRomanWordIndex = useAtomValue(editingRomanWordIndexAtom);
	const compactBGInSync = useAtomValue(compactBGInSyncAtom);

	const startTimeRef = useRef<HTMLDivElement>(null);
	const endTimeRef = useRef<HTMLButtonElement>(null);
	const [enableInsertLocal, setEnableInsertLocal] = useState(false);
	const [globalEnableInsert, setGlobalEnableInsert] = useAtom(globalEnableInsertAtom);
	const enableInsert = enableInsertLocal || globalEnableInsert;

	const disableInsert = useCallback(() => {
		setEnableInsertLocal(false);
		if (globalEnableInsert) setGlobalEnableInsert(false);
	}, [globalEnableInsert, setGlobalEnableInsert]);

	const toggleInsert = useCallback(() => {
		if (enableInsert) disableInsert();
		else setEnableInsertLocal(true);
	}, [enableInsert, disableInsert]);

	const [endTimeLinked, setEndTimeLinked] = useState(() =>
		Boolean(line.endTimeLink),
	);
	const originalEndTimeRef = useRef<number | null>(null);
	const originalNextStartTimeRef = useRef<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 用于呈现时间戳更新效果
	useEffect(() => {
		if (!visualizeTimestampUpdate) return;
		const animation = startTimeRef.current?.animate(
			[
				{
					backgroundColor: "var(--accent-a8)",
				},
				{
					backgroundColor: "var(--accent-a4)",
				},
			],
			{
				duration: 500,
			},
		);

		return () => {
			animation?.cancel();
		};
	}, [line.startTime, visualizeTimestampUpdate]);

	useLayoutEffect(() => {
		if (toolMode !== ToolMode.Edit) {
			disableInsert();
		}
	}, [toolMode, disableInsert]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 用于呈现时间戳更新效果
	useEffect(() => {
		if (!visualizeTimestampUpdate) return;
		const animation = endTimeRef.current?.animate(
			[
				{
					backgroundColor: "var(--accent-a8)",
				},
				{
					backgroundColor: "var(--accent-a4)",
				},
			],
			{
				duration: 500,
			},
		);

		return () => {
			animation?.cancel();
		};
	}, [line.endTime, visualizeTimestampUpdate]);

	useEffect(() => {
		if (!endTimeLinked) return;
		const nextLine = store.get(lyricLinesAtom).lyricLines[lineIndex + 1];
		if (!nextLine) {
			editLyricLines((state) => {
				const targetLine = state.lyricLines[lineIndex];
				if (!targetLine) return;
				if (targetLine.endTimeLink) delete targetLine.endTimeLink;
			});
			return;
		}
		if (nextLine.startTime === line.endTime) return;
		editLyricLines((state) => {
			const targetLine = state.lyricLines[lineIndex + 1];
			if (!targetLine) return;
			targetLine.startTime = line.endTime;
		});
	}, [endTimeLinked, editLyricLines, line.endTime, lineIndex, store]);
	useEffect(() => {
		const linked = Boolean(line.endTimeLink);
		if (linked === endTimeLinked) return;
		setEndTimeLinked(linked);
	}, [endTimeLinked, line.endTimeLink]);


	const onToggleEndTimeLink = useCallback(
		(evt: React.MouseEvent<HTMLButtonElement>) => {
			evt.preventDefault();
			evt.stopPropagation();
			if (endTimeLinked) {
				setEndTimeLinked(false);
				originalEndTimeRef.current = null;
				originalNextStartTimeRef.current = null;
				editLyricLines((state) => {
					const targetLine = state.lyricLines[lineIndex];
					if (!targetLine) return;
					const linkInfo = targetLine.endTimeLink;
					if (!linkInfo) return;
					if (
						typeof linkInfo.originalEndTime !== "number" ||
						!Number.isFinite(linkInfo.originalEndTime)
					) {
						delete targetLine.endTimeLink;
						return;
					}
					targetLine.endTime = linkInfo.originalEndTime;
					const nextTarget = state.lyricLines[lineIndex + 1];
					if (
						nextTarget &&
						Number.isFinite(linkInfo.originalNextStartTime ?? Number.NaN)
					) {
						nextTarget.startTime =
							linkInfo.originalNextStartTime ?? nextTarget.startTime;
					}
					delete targetLine.endTimeLink;
				});
				return;
			}
			const nextLine = store.get(lyricLinesAtom).lyricLines[lineIndex + 1];
			if (!nextLine) return;
			originalEndTimeRef.current = line.endTime;
			originalNextStartTimeRef.current = nextLine?.startTime ?? null;
			editLyricLines((state) => {
				const targetLine = state.lyricLines[lineIndex];
				if (!targetLine) return;
				const nextTarget = state.lyricLines[lineIndex + 1];
				if (!nextTarget) return;
				const originalEndTime =
					targetLine.endTimeLink?.originalEndTime ?? targetLine.endTime;
				const originalNextStartTime =
					targetLine.endTimeLink?.originalNextStartTime ??
					nextTarget.startTime ??
					null;
				const desiredEndTime = nextTarget.startTime ?? targetLine.endTime;
				targetLine.endTimeLink = {
					originalEndTime,
					originalNextStartTime,
				};
				targetLine.endTime = desiredEndTime;
				nextTarget.startTime = desiredEndTime;
			});
			setEndTimeLinked(true);
		},
		[editLyricLines, endTimeLinked, line.endTime, lineIndex, store],
	);

	return (
		<>
			{lineSelected && (
				<LyricLineScroller
					lineAtom={lineAtom}
					wordsContainer={wordsContainerRef.current}
					editingRomanWordIndex={editingRomanWordIndex}
				/>
			)}
			{enableInsert && (
				<InsertLineButton
					lineIndex={lineIndex}
					selectedLinesCountAtom={selectedLinesCountAtom}
					disableInsert={disableInsert}
				/>
			)}
			<ContextMenu.Root
				onOpenChange={(opened) => {
					if (opened) {
						if (!store.get(selectedLinesAtom).has(line.id)) {
							store.set(selectedLinesAtom, new Set([line.id]));
						}
					}
				}}
			>
				<ContextMenu.Trigger disabled={toolMode !== ToolMode.Edit}
				><Flex
						mx="2"
						my={line.isBG && toolMode === ToolMode.Sync && compactBGInSync ? "0" : "1"}
						direction="row"
						className={classNames(
							styles.lyricLine,
							line.isBG && toolMode === ToolMode.Sync && compactBGInSync && styles.bg,
							lineSelected && styles.selected,
							toolMode === ToolMode.Sync && styles.sync,
							toolMode === ToolMode.Edit && styles.edit,
							line.ignoreSync && styles.ignoreSync,
							hasError && toolMode === ToolMode.Edit && styles.error,
						)}
						align="center"
						gapX="4"
						draggable={toolMode === ToolMode.Edit}
						style={{
							...(isSectionStart ? { marginTop: "16px" } : {}),
						}}
						onPointerDown={(evt) => {
							blockDragRef.current =
								(evt.target as HTMLElement | null)?.tagName === "INPUT";
						}}
						onPointerUp={() => {
							blockDragRef.current = false;
						}}
						onDragStart={(evt) => {
							if (blockDragRef.current) {
								blockDragRef.current = false;
								evt.preventDefault();
								evt.stopPropagation();
								return;
							}
							evt.dataTransfer.dropEffect = "move";
							store.set(isDraggingAtom, true);
							store.set(draggingIdAtom, line.id);
						}}
						onDragEnd={() => {
							store.set(isDraggingAtom, false);
						}}
						onDragOver={(evt) => {
							if (!store.get(isDraggingAtom)) return;
							if (store.get(draggingIdAtom) === line.id) return;
							if (lineSelected) return;
							evt.preventDefault();
							evt.dataTransfer.dropEffect = "move";
							const rect = evt.currentTarget.getBoundingClientRect();
							const innerY = evt.clientY - rect.top;
							if (innerY < rect.height / 2) {
								evt.currentTarget.classList.add(styles.dropTop);
								evt.currentTarget.classList.remove(styles.dropBottom);
							} else {
								evt.currentTarget.classList.remove(styles.dropTop);
								evt.currentTarget.classList.add(styles.dropBottom);
							}
						}}
						onDrop={(evt) => {
							evt.currentTarget.classList.remove(styles.dropTop);
							evt.currentTarget.classList.remove(styles.dropBottom);
							if (!store.get(isDraggingAtom)) return;
							const rect = evt.currentTarget.getBoundingClientRect();
							const innerY = evt.clientY - rect.top;
							const selectedLines = store.get(selectedLinesAtom);
							const selectedLineIds = selectedLines.has(
								store.get(draggingIdAtom),
							)
								? selectedLines
								: new Set([store.get(draggingIdAtom)]);
							const indexDelta = innerY >= rect.height / 2 ? 1 : 0;
							editLyricLines((state) => {
								const filteredLines = state.lyricLines.filter(
									(l) => !selectedLineIds.has(l.id),
								);
								const targetLines = state.lyricLines.filter((l) =>
									selectedLineIds.has(l.id),
								);
								const targetIndex = filteredLines.findIndex(
									(l) => l.id === line.id,
								);
								if (targetIndex < 0) return;
								state.lyricLines = [
									...filteredLines.slice(0, targetIndex + indexDelta),
									...targetLines,
									...filteredLines.slice(targetIndex + indexDelta),
								];
							});
						}}
						onDragLeave={(evt) => {
							evt.currentTarget.classList.remove(styles.dropTop);
							evt.currentTarget.classList.remove(styles.dropBottom);
						}}
						onClick={(evt) => {
							evt.stopPropagation();
							evt.preventDefault();

							const now = Date.now();
							const clickInterval = now - lastClickTimeRef.current;
							lastClickTimeRef.current = now;

							if (clickInterval < 300) {
								if (evt.ctrlKey || evt.metaKey) {
									// Open Suggested Splits Dialog for the whole line
									store.set(suggestedSplitsDialogAtom, {
										open: true,
										lineId: line.id,
									});
									return;
								}
							}

							if (evt.ctrlKey) {
								setSelectedLines((v) => {
									if (v.has(line.id)) {
										v.delete(line.id);
									} else {
										v.add(line.id);
									}
								});
							} else if (evt.shiftKey) {
								setSelectedLines((v) => {
									if (v.size > 0) {
										let minBoundry = Number.NaN;
										let maxBoundry = Number.NaN;
										const lyricLines = store.get(lyricLinesAtom).lyricLines;
										lyricLines.forEach((line, i) => {
											if (v.has(line.id)) {
												if (Number.isNaN(minBoundry)) minBoundry = i;
												if (Number.isNaN(maxBoundry)) maxBoundry = i;
 
												minBoundry = Math.min(minBoundry, i, lineIndex);
												maxBoundry = Math.max(maxBoundry, i, lineIndex);
											}
										});
										for (let i = minBoundry; i <= maxBoundry; i++) {
											v.add(lyricLines[i].id);
										}
									} else {
										v.add(line.id);
									}
								});
							} else {
								setSelectedLines((state) => {
									if (!state.has(line.id) || state.size !== 1) {
										state.clear();
										state.add(line.id);
									}
								});
								setSelectedWords((state) => {
									state.clear();
									if (toolMode === ToolMode.Sync && syncLevelMode === "line") {
										const units = getSynchronizableUnits(line);
										for (const unit of units) {
											state.add(unit.id);
										}
									}
								});
							}
						}}
						asChild
					><div
						>
							<Flex
									direction="column"
									align="center"
									justify="center"
									ml="3"
									style={{ minWidth: "40px" }}
								>
									<Text
										className={classNames(
											styles.lineNumber,
											line.ignoreSync && styles.ignored,
										)}
										align="center"
										color="gray"
									>
										{displayNumber > 0 && displayNumber}
									</Text>
									{line.isBG && <VideoBackgroundEffectFilled color="var(--accent-9)" />}
									{line.isDuet && <TextAlignRightFilled color="#44AA33" />}
							</Flex>
							<div
								className={classNames(
									styles.lyricLineContainer,
									toolMode === ToolMode.Edit && styles.edit,
									toolMode === ToolMode.Sync && styles.sync,
								)}
							>
								{isSectionStart && (
									<Flex gap="2" mb="1" align="center">
										<Text
											size="1"
											weight="bold"
											color={customHeaderColor ? undefined : (categoryColor as any)}
											style={{ 
												opacity: 0.8, 
												textTransform: "uppercase",
												color: customHeaderColor || undefined
											}}
										>
											{activeGeniusHeader}
										</Text>
										{toolMode === ToolMode.Sync && (
											<Button
											size="1"
											variant="ghost"
											onClick={(e) => {
												e.stopPropagation();
												const currentTime = store.get(currentTimeAtom);
												editLyricLines((state) => {
													shiftSectionToTime(state.lyricLines, lineIndex, currentTime);
												});
											}}
										>
											{t("experimentalFeatures.geniusCategorization.snapToPlayhead", "Snap to Playhead")}
											</Button>
										)}
										{toolMode === ToolMode.Sync && (
											<Button
											size="1"
											variant="ghost"
											onClick={(e) => {
												e.stopPropagation();
												const lyricLines = store.get(lyricLinesAtom).lyricLines;
												const previousSection = findPreviousMatchingSection(lyricLines, lineIndex);

												if (previousSection) {
													let copyResult: ReturnType<typeof copySectionTimings>;
													editLyricLines((state) => {
														copyResult = copySectionTimings(state.lyricLines, lineIndex, previousSection);
													});
													toast.success(t("common.success", "Success"));
													if (copyResult && !copyResult.lengthsMatch) {
														toast.info("Section lengths differ; copied matching lines only.");
													}
												} else {
													toast.info(t("experimentalFeatures.geniusCategorization.noPreviousFound", "No previous identical header found with timing."));
												}
											}}
										>
											{t("experimentalFeatures.geniusCategorization.copyPrevious", "Copy Previous Timing")}
											</Button>
										)}
									</Flex>
								)}
								<div
									className={classNames(
										styles.lyricWordsContainer,
										toolMode === ToolMode.Edit && styles.edit,
										toolMode === ToolMode.Sync && styles.sync,
										!showTimestamps && styles.hideTimestamps,
									)}
									ref={wordsContainerRef}
									style={{
										backgroundColor: activeGeniusHeader
											? customHeaderColor 
												? `${customHeaderColor}15` // 15 is roughly 8% opacity
												: `var(--${categoryColor}-2)`
											: undefined,
										borderLeft: activeGeniusHeader
											? `2px solid ${customHeaderColor || `var(--${categoryColor}-9)`}`
											: undefined,
										borderRadius: isSectionStart ? "var(--radius-2)" : "0",
										padding: activeGeniusHeader ? "4px 8px" : undefined,
									}}
								>
									{words.map((wordAtom, wi) => {
										const word = store.get(wordAtom);
										return (
											<Fragment key={`word-${word.id}`}>
												{enableInsert && (
													<IconButton
														size="1"
														variant="soft"
														onClick={(evt) => {
															evt.preventDefault();
															evt.stopPropagation();
															editLyricLines((state) => {
																state.lyricLines[lineIndex].words.splice(
																	wi,
																	0,
																	newLyricWord(),
																);
															});
														}}
													>
														<AddFilled />
													</IconButton>
												)}
												<Flex
													direction="column"
													align="stretch"
													gap="3"
													data-word-index={wi}
													className={styles.wordGroup}
												>
													<LyricWordView
														wordAtom={wordAtom}
														wordIndex={wi}
														line={line}
														lineIndex={lineIndex}
														isHeaderLine={false}
													/>
													{toolMode === ToolMode.Edit &&

														showWordRomanizationInput && (
															<RomanWordView
																wordAtom={wordAtom}
																wordIndex={wi}
																editingIndexAtom={editingRomanWordIndexAtom}
															/>
														)}
												</Flex>
											</Fragment>
										);
									})}
									{enableInsert && (
										<IconButton
											size="1"
											variant="soft"
											onClick={(evt) => {
												evt.preventDefault();
												evt.stopPropagation();
												editLyricLines((state) => {
													state.lyricLines[lineIndex].words.push(
														newLyricWord(),
													);
												});
											}}
										>
											<AddFilled />
										</IconButton>
									)}
									{toolMode === ToolMode.Edit && (
										<TextField.Root
											placeholder={t("lyricLineView.insertWord", "插入单词…")}
											className={classNames(
												styles.insertWordField,
												words.length === 0 && styles.empty,
											)}
											style={{
												alignSelf: "center",
											}}
											onKeyDown={(evt) => {
												if (evt.key === "Enter") {
													evt.preventDefault();
													evt.stopPropagation();
													const { word, enableRuby } = parseRubyShortcut(
														evt.currentTarget.value,
													);
													editLyricLines((state) => {
														const newWord = newLyricWord();
														state.lyricLines[lineIndex].words.push({
															...newWord,
															word,
															ruby: enableRuby
																? [
																		{
																			word: "",
																			startTime: newWord.startTime,
																			endTime: newWord.endTime,
																		},
																	]
																: undefined,
														});
													});
													evt.currentTarget.value = "";
												}
											}}
										/>
									)}
								</div>
								{toolMode === ToolMode.Edit && (
									<>
										{showTranslation && (
											<SubLineEdit
												lineAtom={lineAtom}
												lineIndex={lineIndex}
												type="translatedLyric"
											/>
										)}
										{showRomanization && (
											<SubLineEdit
												lineAtom={lineAtom}
												lineIndex={lineIndex}
												type="romanLyric"
											/>
										)}
									</>
								)}
							</div>
											{toolMode === ToolMode.Edit && (
								<Flex p="3">
									<IconButton
										size="1"
										variant={enableInsert ? "solid" : "soft"}
										onClick={(evt) => {
											evt.preventDefault();
											evt.stopPropagation();
											toggleInsert();
										}}
									>
										<AddFilled />
									</IconButton>
								</Flex>
							)}
											{toolMode === ToolMode.Sync && showTimestamps && (
								<Flex pr="3" gap="1" direction="column" align="stretch">
									<div className={styles.startTime} ref={startTimeRef}>
										{msToTimestamp(line.startTime)}
									</div>
									<button
										type="button"
										className={classNames(styles.endTime, styles.endTimeButton)}
										ref={endTimeRef}
										onClick={onToggleEndTimeLink}
									>
										<span
											style={{
												display: "inline-flex",
												alignItems: "center",
											}}
										>
											{endTimeLinked ? (
												<LinkMultiple20Regular />
											) : showEndTimeAsDuration ? (
												`+${line.endTime - line.startTime}ms`
											) : (
												msToTimestamp(line.endTime)
											)}
										</span>
									</button>
								</Flex>
							)}
						</div>
					</Flex>
				</ContextMenu.Trigger>
				<ContextMenu.Content>
					<LyricLineMenu lineIndex={lineIndex} />
				</ContextMenu.Content>
			</ContextMenu.Root>
			{(enableInsertLocal || (globalEnableInsert && isLastLine)) && (
				<Button
					mx="2"
					my="1"
					variant="soft"
					size="1"
					style={{
						width: "calc(100% - var(--space-4))",
					}}
					onClick={(evt) => {
						editLyricLines((state) => {
							const selectedLines = store.get(selectedLinesAtom);
							if (selectedLines.size > 0) {
								const linesToCopy = state.lyricLines.filter((l) =>
									selectedLines.has(l.id),
								);
								const newLines = linesToCopy.map((l) => ({
									...l,
									id: newLyricLine().id,
									words: l.words.map((w) => ({
										...w,
										id: newLyricWord().id,
									})),
								}));
								state.lyricLines.splice(lineIndex + 1, 0, ...newLines);
							} else {
								state.lyricLines.splice(lineIndex + 1, 0, newLyricLine());
							}
						});
						// setInsertMode(InsertMode.None);
						if (!evt.shiftKey) {
							disableInsert();
						}
					}}
				>
					{selectedLinesCount > 0
						? t("lyricLineView.duplicateLinesHere", {
								count: selectedLinesCount,
								defaultValue: "Duplicate {count} selected line(s) here",
						  })
						: t("lyricLineView.insertLine", "在此插入新行")}
				</Button>
			)}
		</>
	);
});
