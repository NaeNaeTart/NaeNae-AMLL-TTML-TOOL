/*
 * Copyright 2023-2026 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/blob/main/LICENSE
 */

import {
	CutRegular,
	DeleteRegular,
	PaddingLeftRegular,
	PaddingRightRegular,
	SplitVerticalRegular,
	TaskListLtrRegular,
} from "@fluentui/react-icons";
import {
	ContextMenu,
	IconButton,
	TextField,
} from "@radix-ui/themes";
import classNames from "classnames";
import { type Atom, atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	type FC,
	type MouseEvent,
	memo,
	type PropsWithChildren,
	type SyntheticEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import {
	displayRomanizationInSyncAtom,
	enableManualTimestampEditAtom,
	enableSyncGlowAnimationAtom,
	highlightActiveWordAtom,
	highlightErrorsAtom,
	LayoutMode,
	layoutModeAtom,
	legacySpaceLabelsAtom,
	showTimestampsAtom,
} from "$/modules/settings/states/index.ts";
import { instantHighlightFadeAtom } from "$/modules/settings/states/preview";
import {
	enableTimeModeDoubleClickEditAtom,
	enableUpcomingWordHighlightAtom,
	syncLevelModeAtom,
	upcomingWordHighlightColorAtom,
	upcomingWordHighlightThresholdAtom,
	visualizeTimestampUpdateAtom,
} from "$/modules/settings/states/sync.ts";
import { splitWordDialogAtom } from "$/states/dialogs.ts";
import {
	editingWordStateAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	showEndTimeAsDurationAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import { type LyricLine, type LyricWord, newLyricWord } from "$/types/ttml.ts";
import { msToTimestamp, parseTimespan } from "$/utils/timestamp.ts";
import { AutoSizeTextField, RubyEditor } from "../tools/RubyEditor.tsx";
import {
	buildRubySelectionId,
	getSynchronizableUnits,
} from "../utils/lyric-states.ts";
import { normalizeLineTime } from "../utils/normalize-line-time.ts";
import styles from "./index.module.css";
import { LyricLineMenu } from "./lyric-line-menu.tsx";
import { LyricWordMenu } from "./lyric-word-menu";

const isDraggingAtom = atom(false);

const useWordBlank = (word: string) =>
	useMemo(
		() => word.length === 0 || (word.length > 0 && word.trim().length === 0),
		[word],
	);

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

const getDisplayWordText = (
	t: (
		key: string,
		defaultValue: string,
		options?: { count?: number },
	) => string,
	word: string,
	isWordBlank: boolean,
	romanWord?: string,
	displayRomanizationInSync?: boolean,
) => {
	if (displayRomanizationInSync && romanWord && romanWord.trim() !== "")
		return romanWord;
	if (word === "") return t("lyricWordView.empty", "空白");
	if (isWordBlank)
		return t("lyricWordView.spaceCount", "空格 x{count}", {
			count: word.length,
		});
	return word;
};

type LyricWordViewEditProps = {
	wordAtom: Atom<LyricWord>;
	wordIndex: number;
	line: LyricLine;
	lineIndex: number;
};

type LyricWordViewEditSpanProps = {
	wordAtom: Atom<LyricWord>;
	wordIndex: number;
	line: LyricLine;
	className?: string;
	onDoubleClick?: (evt: MouseEvent<HTMLSpanElement>) => void;
};

const LyricWordViewEditSpan = ({
	wordAtom,
	wordIndex,
	line,
	className,
	children,
	onDoubleClick,
	...props
}: PropsWithChildren<
	LyricWordViewEditSpanProps & React.HTMLAttributes<HTMLSpanElement>
>) => {
	const word = useAtomValue(wordAtom);
	const store = useStore();
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const isWordSelectedAtom = useMemo(
		() => atom((get) => get(selectedWordsAtom).has(get(wordAtom).id)),
		[wordAtom],
	);
	const isWordSelected = useAtomValue(isWordSelectedAtom);
	const selectedWords = useAtomValue(selectedWordsAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const blockDragRef = useRef(false);
	const lastClickTimeRef = useRef(0);
	const syncLevelMode = useAtomValue(syncLevelModeAtom);

	function onWordSelect(evt: MouseEvent<HTMLSpanElement>) {
		if (toolMode === ToolMode.Sync && syncLevelMode === "line") {
			setSelectedLines((state) => {
				if (!state.has(line.id) || state.size !== 1) {
					state.clear();
					state.add(line.id);
				}
			});
			setSelectedWords((state) => {
				const units = getSynchronizableUnits(line);
				state.clear();
				for (const unit of units) {
					state.add(unit.id);
				}
			});
			return;
		}
		if (evt.ctrlKey || evt.metaKey) {
			setSelectedWords((v) => {
				if (v.has(word.id)) {
					v.delete(word.id);
				} else {
					v.add(word.id);
				}
			});
		} else if (evt.shiftKey) {
			setSelectedWords((v) => {
				if (v.size > 0) {
					let minBoundry = Number.NaN;
					let maxBoundry = Number.NaN;
					line.words.forEach((word, i) => {
						if (v.has(word.id)) {
							if (Number.isNaN(minBoundry)) minBoundry = i;
							if (Number.isNaN(maxBoundry)) maxBoundry = i;

							minBoundry = Math.min(minBoundry, i, wordIndex);
							maxBoundry = Math.max(maxBoundry, i, wordIndex);
						}
					});
					for (let i = minBoundry; i <= maxBoundry; i++) {
						v.add(line.words[i].id);
					}
				} else {
					v.add(word.id);
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
				if (!state.has(word.id) || state.size !== 1) {
					state.clear();
					state.add(word.id);
				}
			});
		}
	}

	return (
		<span
			{...props}
			data-lyric-word-interactive=""
			draggable={toolMode === ToolMode.Edit}
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
				if (!isWordSelected) onWordSelect(evt);
				evt.dataTransfer.effectAllowed = "copyMove";
				evt.dataTransfer.dropEffect = "move";
				store.set(isDraggingAtom, true);
				evt.stopPropagation();
			}}
			onDragEnd={() => {
				store.set(isDraggingAtom, false);
				blockDragRef.current = false;
			}}
			onDragOver={(evt) => {
				if (!store.get(isDraggingAtom)) return;
				if (isWordSelected) return;
				evt.preventDefault();
				evt.dataTransfer.dropEffect = "move";
				const rect = evt.currentTarget.getBoundingClientRect();
				const innerX = evt.clientX - rect.left;
				if (innerX < rect.width / 2) {
					evt.currentTarget.classList.add(styles.dropLeft);
					evt.currentTarget.classList.remove(styles.dropRight);
				} else {
					evt.currentTarget.classList.remove(styles.dropLeft);
					evt.currentTarget.classList.add(styles.dropRight);
				}
				const isCopyingWords = evt.ctrlKey || evt.metaKey;
				evt.dataTransfer.dropEffect = isCopyingWords ? "copy" : "move";
			}}
			onDrop={(evt) => {
				evt.currentTarget.classList.remove(styles.dropLeft);
				evt.currentTarget.classList.remove(styles.dropRight);
				if (!store.get(isDraggingAtom)) return;
				if (isWordSelected) return;

				const rect = evt.currentTarget.getBoundingClientRect();
				const innerX = evt.clientX - rect.left;
				const insertRight = innerX > rect.width / 2;

				const isCopyingWords = evt.ctrlKey || evt.metaKey;
				editLyricLines((state) => {
					let collectedWords: LyricWord[] = [];
					for (const line of state.lyricLines) {
						const words = line.words.filter((w) => selectedWords.has(w.id));
						collectedWords.push(...words);
						if (!isCopyingWords) {
							const deletedAtBounds =
								line.words.length > 0 &&
								(selectedWords.has(line.words[0].id) ||
									selectedWords.has(line.words[line.words.length - 1].id));
							line.words = line.words.filter((w) => !selectedWords.has(w.id));
							if (deletedAtBounds) normalizeLineTime(line);
						}
					}
					const targetLine = state.lyricLines.find(({ id }) => id === line.id);
					if (!targetLine) throw new Error("Target line not found");
					const targetIndex = targetLine.words.findIndex(
						(w) => w.id === word.id,
					);
					if (targetIndex < 0) throw new Error("Target word not found");
					if (isCopyingWords) {
						collectedWords = collectedWords.map((w) => ({
							...w,
							id: newLyricWord().id,
						}));
						setSelectedWords((v) => {
							v.clear();
							for (const w of collectedWords) {
								v.add(w.id);
							}
						});
					}
					const insertPosition = targetIndex + (insertRight ? 1 : 0);
					const insertedAtBounds =
						insertPosition === 0 || insertPosition === targetLine.words.length;
					targetLine.words.splice(insertPosition, 0, ...collectedWords);
					if (insertedAtBounds) normalizeLineTime(targetLine);
				});
			}}
			onDragLeave={(evt) => {
				evt.currentTarget.classList.remove(styles.dropLeft);
				evt.currentTarget.classList.remove(styles.dropRight);
			}}
			className={className}
			onClick={(evt) => {
				const now = Date.now();
				const wasAlreadySelected = isWordSelected && selectedWords.size === 1;
				const isSelectionClick = !evt.ctrlKey && !evt.metaKey && !evt.shiftKey;
				const clickInterval = now - lastClickTimeRef.current;
				lastClickTimeRef.current = now;

				evt.stopPropagation();
				evt.preventDefault();

				if ((evt.ctrlKey || evt.metaKey) && evt.detail === 2) {
					setSelectedLines((state) => {
						state.clear();
						state.add(line.id);
					});
					setSelectedWords((state) => {
						state.clear();
						state.add(word.id);
					});
					onDoubleClick?.(evt);
					return;
				}

				onWordSelect(evt);

				if (wasAlreadySelected && isSelectionClick && clickInterval > 100) {
					onDoubleClick?.(evt);
				}
			}}
		>
			{children}
		</span>
	);
};

function WordEditField<F extends keyof LyricWord, V extends LyricWord[F]>({
	wordAtom,
	fieldName,
	formatter,
	parser,
	// textFieldStyle,
	children,
	...other
}: PropsWithChildren<
	{
		wordAtom: Atom<LyricWord>;
		fieldName: F;
		formatter: (v: V) => string;
		parser: (v: string) => V;
		textFieldStyle?: React.CSSProperties;
	} & TextField.RootProps
>) {
	const [fieldInput, setFieldInput] = useState<string | undefined>(undefined);
	const [fieldPlaceholder, setFieldPlaceholder] = useState<string>("");

	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	const currentValueAtom = useMemo(
		() =>
			atom((get) => {
				const word = get(wordAtom);
				return formatter(word[fieldName] as V);
			}),
		[fieldName, wordAtom, formatter],
	);
	const currentValue = useAtomValue(currentValueAtom);
	const store = useStore();

	const onInputFinished = useCallback(
		(rawValue: string) => {
			try {
				const thisWord = store.get(wordAtom);
				const { word: inputWord, enableRuby } =
					fieldName === "word"
						? parseRubyShortcut(rawValue)
						: { word: rawValue, enableRuby: false };
				const value =
					fieldName === "word"
						? (inputWord as unknown as V)
						: parser(inputWord as string);
				editLyricLines((state) => {
					for (const line of state.lyricLines) {
						for (const word of line.words) {
							if (thisWord.id === word.id) {
								word[fieldName] = value;
								if (fieldName === "word" && enableRuby && !word.ruby) {
									word.ruby = [];
								}
								break;
							}
						}
					}
					return state;
				});
			} catch {
				if (typeof currentValue === "string") setFieldInput(currentValue);
			}
		},
		[wordAtom, store, editLyricLines, currentValue, fieldName, parser],
	);

	useLayoutEffect(() => {
		setFieldInput(currentValue);
		setFieldPlaceholder("");
	}, [currentValue]);

	return (
		<TextField.Root
			size="1"
			value={fieldInput ?? ""}
			placeholder={fieldPlaceholder}
			disabled={fieldInput === undefined}
			onChange={(evt) => setFieldInput(evt.currentTarget.value)}
			onKeyDown={(evt) => {
				if (evt.key !== "Enter") return;
				onInputFinished(evt.currentTarget.value);
			}}
			onBlur={(evt) => {
				if (evt.currentTarget.value === currentValue) return;
				onInputFinished(evt.currentTarget.value);
			}}
			{...other}
		>
			{children}
		</TextField.Root>
	);
}

const LyricWordViewEditAdvance = ({
	wordAtom,
	wordIndex,
	line,
	lineIndex,
}: LyricWordViewEditProps) => {
	const store = useStore();
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setOpenSplitWordDialog = useSetAtom(splitWordDialogAtom);
	const setSplitState = useSetAtom(editingWordStateAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const currentWord = useAtomValue(wordAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const isWordSelectedAtom = useMemo(
		() => atom((get) => get(selectedWordsAtom).has(get(wordAtom).id)),
		[wordAtom],
	);
	const isWordSelected = useAtomValue(isWordSelectedAtom);

	const isWordBlank = useWordBlank(currentWord.word);
	const showRubyEditor = useMemo(
		() => currentWord.ruby !== undefined,
		[currentWord.ruby],
	);

	const hasError = useMemo(
		() => currentWord.startTime > currentWord.endTime,
		[currentWord.startTime, currentWord.endTime],
	);

	const className = useMemo(
		() =>
			classNames(
				styles.lyricWord,
				styles.edit,
				styles.advance,
				isWordSelected && styles.selected,
				isWordBlank && styles.blank,
				showRubyEditor && styles.rubyEnabled,
				hasError && toolMode === ToolMode.Edit && styles.error,
			),
		[isWordBlank, isWordSelected, showRubyEditor, hasError, toolMode],
	);

	return (
		<ContextMenu.Root
			onOpenChange={(open) => {
				if (!open) return;
				const currentStore = store;
				const currentSelectedWords = currentStore.get(selectedWordsAtom);
				if (currentSelectedWords.has(currentWord.id))
					return;
				setSelectedWords((state) => {
					state.clear();
					state.add(currentWord.id);
				});
				setSelectedLines((state) => {
					state.clear();
					state.add(line.id);
				});
			}}
		>
			<ContextMenu.Trigger>
				<LyricWordViewEditSpan
					wordAtom={wordAtom}
					wordIndex={wordIndex}
					className={className}
					line={line}
					onDoubleClick={(evt) => {
						if (!evt.ctrlKey && !evt.metaKey) return;
						setSplitState({
							wordIndex,
							lineIndex,
							word: currentWord.word,
						});
						setOpenSplitWordDialog(true);
					}}
				>
					<WordEditField
						size="1"
						wordAtom={wordAtom}
						fieldName="startTime"
						formatter={msToTimestamp}
						parser={parseTimespan}
						style={{
							minWidth: "0",
						}}
					>
						<TextField.Slot>
							<PaddingLeftRegular />
						</TextField.Slot>
					</WordEditField>
					<div className={styles.advanceBar}>
						<IconButton
							variant="soft"
							size="1"
							onClick={() => {
								setSplitState({
									wordIndex,
									lineIndex,
									word: currentWord.word,
								});
								setOpenSplitWordDialog(true);
							}}
						>
							<CutRegular />
						</IconButton>
						<WordEditField
							size="1"
							wordAtom={wordAtom}
							fieldName="word"
							formatter={String}
							parser={String}
							style={{
								minWidth: "0em",
							}}
						/>
						<IconButton
							variant="soft"
							size="1"
							onClick={() => {
								editLyricLines((state) => {
									const selectedWords = store.get(selectedWordsAtom);
									for (const line of state.lyricLines) {
										line.words = line.words.filter(
											(w) => !selectedWords.has(w.id),
										);
									}
								});
							}}
						>
							<DeleteRegular />
						</IconButton>
					</div>
					<div className={styles.rubyAdvanceRow}>
						<RubyEditor
							wordAtom={wordAtom}
							forceShow
							showIcon
							className={styles.rubyEditorCompact}
						/>
					</div>
					<WordEditField
						size="1"
						wordAtom={wordAtom}
						fieldName="endTime"
						formatter={msToTimestamp}
						parser={parseTimespan}
						style={{
							minWidth: "0",
						}}
					>
						<TextField.Slot>
							<PaddingRightRegular />
						</TextField.Slot>
					</WordEditField>
					<div className={styles.advanceBar}>
						<WordEditField
							size="1"
							type="number"
							min={0}
							wordAtom={wordAtom}
							fieldName="emptyBeat"
							formatter={String}
							parser={Number.parseInt}
							style={{
								minWidth: "0",
							}}
						>
							<TextField.Slot>
								<SplitVerticalRegular />
							</TextField.Slot>
						</WordEditField>
						<IconButton
							variant="soft"
							size="1"
							onClick={() => {
								editLyricLines((state) => {
									for (const line of state.lyricLines)
										for (const word of line.words)
											if (word.word === currentWord.word)
												word.emptyBeat = currentWord.emptyBeat;
								});
							}}
						>
							<TaskListLtrRegular />
						</IconButton>
					</div>
				</LyricWordViewEditSpan>
			</ContextMenu.Trigger>
			<ContextMenu.Content
				onPointerDown={(evt) => evt.stopPropagation()}
				onClick={(evt) => evt.stopPropagation()}
			>
				<LyricWordMenu
					wordAtom={wordAtom}
					wordIndex={wordIndex}
					lineIndex={lineIndex}
				/>
				<LyricLineMenu lineIndex={lineIndex} />
			</ContextMenu.Content>
		</ContextMenu.Root>
	);
};

const LyricWorldViewEdit = ({
	wordAtom,
	wordIndex,
	line,
	lineIndex,
}: LyricWordViewEditProps) => {
	const { t } = useTranslation();
	const word = useAtomValue(wordAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const isWordSelectedAtom = useMemo(
		() => atom((get) => get(selectedWordsAtom).has(get(wordAtom).id)),
		[wordAtom],
	);
	const isWordSelected = useAtomValue(isWordSelectedAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const setOpenSplitWordDialog = useSetAtom(splitWordDialogAtom);
	const setSplitState = useSetAtom(editingWordStateAtom);
	const [editing, setEditing] = useState(false);
	const [editingValue, setEditingValue] = useState(word.word);
	const store = useStore();
	const toolMode = useAtomValue(toolModeAtom);
	const isWordBlank = useWordBlank(word.word);
	const isSpaceWord = isWordBlank && word.word.length > 0;
	const legacySpaceLabels = useAtomValue(legacySpaceLabelsAtom);
	const useCompactSpace = isSpaceWord && !legacySpaceLabels;
	// In Edit Mode, we always want to see the original word in the capsule.
	const displayWord = getDisplayWordText(t, word.word, isWordBlank, word.romanWord, false);
	const spaceLabel = isSpaceWord
		? t("lyricWordView.spaceCount", "空格 x{count}", {
				count: word.word.length,
			})
		: undefined;
	const showRubyEditor = useMemo(() => word.ruby !== undefined, [word.ruby]);

	const hasError = useMemo(
		() => word.startTime > word.endTime,
		[word.startTime, word.endTime],
	);

	useEffect(() => {
		if (editing) setEditingValue(word.word);
	}, [editing, word.word]);

	const className = useMemo(
		() =>
			classNames(
				styles.lyricWord,
				styles.edit,
				isWordSelected && styles.selected,
				isWordBlank && styles.blank,
				useCompactSpace && styles.compactSpace,
				showRubyEditor && styles.rubyEnabled,
				hasError && toolMode === ToolMode.Edit && styles.error,
			),
		[
			isWordBlank,
			useCompactSpace,
			isWordSelected,
			showRubyEditor,
			hasError,
			toolMode,
		],
	);
	const onEnter = useCallback(
		(evt: SyntheticEvent<HTMLInputElement>) => {
			setEditing(false);
			const { word: parsedWord, enableRuby } = parseRubyShortcut(
				evt.currentTarget.value,
			);
			if (parsedWord !== word.word || enableRuby) {
				editLyricLines((state) => {
					const targetWord = state.lyricLines[lineIndex]?.words[wordIndex];
					if (!targetWord) return;
					targetWord.word = parsedWord;
					if (enableRuby && !targetWord.ruby) {
						targetWord.ruby = [];
					}
				});
			}
		},
		[editLyricLines, lineIndex, word.word, wordIndex],
	);

	return editing ? (
		<div className={className}>
			<span className={styles.wordEditRow}>
				<AutoSizeTextField
					autoFocus
					value={editingValue}
					style={{ minWidth: "2ch" }}
					onChange={(evt) => setEditingValue(evt.currentTarget.value)}
					onBlur={onEnter}
					onKeyDown={(evt) => {
						if (evt.key === "Enter") onEnter(evt);
					}}
				/>
				{showRubyEditor && <RubyEditor wordAtom={wordAtom} />}
			</span>
		</div>
	) : (
		<ContextMenu.Root
			onOpenChange={(open) => {
				if (!open) return;
				const currentStore = store;
				const currentSelectedWords = currentStore.get(selectedWordsAtom);
				if (currentSelectedWords.has(word.id))
					return;
				setSelectedWords((state) => {
					state.clear();
					state.add(word.id);
				});
				setSelectedLines((state) => {
					state.clear();
					state.add(line.id);
				});
			}}
		>
			<ContextMenu.Trigger>
				<LyricWordViewEditSpan
					wordAtom={wordAtom}
					wordIndex={wordIndex}
					className={className}
					line={line}
					style={
						useCompactSpace
							? ({ "--space-count": word.word.length } as React.CSSProperties)
							: undefined
					}
					onDoubleClick={(evt) => {
						if (evt.ctrlKey || evt.metaKey) {
							setSplitState({
								wordIndex,
								lineIndex,
								word: word.word,
							});
							setOpenSplitWordDialog(true);
							return;
						}
						setEditing(true);
					}}
				>
					<span className={styles.wordEditRow}>
						<div className={styles.wordMainContainer}>
							<div
								className={styles.wordMainText}
								title={spaceLabel}
								aria-label={spaceLabel}
							>
								{useCompactSpace ? null : displayWord}
							</div>
						</div>
						{showRubyEditor && <RubyEditor wordAtom={wordAtom} />}
					</span>
				</LyricWordViewEditSpan>
			</ContextMenu.Trigger>
			<ContextMenu.Content
				onPointerDown={(evt) => evt.stopPropagation()}
				onClick={(evt) => evt.stopPropagation()}
			>
				<LyricWordMenu
					wordAtom={wordAtom}
					wordIndex={wordIndex}
					lineIndex={lineIndex}
				/>
				<LyricLineMenu lineIndex={lineIndex} />
			</ContextMenu.Content>
		</ContextMenu.Root>
	);
};

const LyricSyncWordView: FC<{
	syncId: string;
	wordAtom: Atom<LyricWord>;
	line: LyricLine;
	startTime: number;
	endTime: number;
	displayWord: string;
	isWordBlank: boolean;
	wordIndex: number;
	lineIndex: number;
	rubyIndex?: number;
	editableField: "word" | "romanWord";
}> = ({
	syncId,
	wordAtom,
	line,
	startTime,
	endTime,
	displayWord,
	isWordBlank,
	wordIndex,
	lineIndex,
	rubyIndex = -1,
	editableField,
}) => {
	const word = useAtomValue(wordAtom);
	const isWordSelectedAtom = useMemo(
		() => atom((get) => get(selectedWordsAtom).has(syncId)),
		[syncId],
	);
	const isWordSelected = useAtomValue(isWordSelectedAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const visualizeTimestampUpdate = useAtomValue(visualizeTimestampUpdateAtom);
	const showTimestamps = useAtomValue(showTimestampsAtom);
	const showEndTimeAsDuration = useAtomValue(showEndTimeAsDurationAtom);
	const highlightErrors = useAtomValue(highlightErrorsAtom);
	const highlightActiveWord = useAtomValue(highlightActiveWordAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const syncLevelMode = useAtomValue(syncLevelModeAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const enableSyncGlowAnimation = useAtomValue(enableSyncGlowAnimationAtom);
	const enableManualTimestampEdit = useAtomValue(enableManualTimestampEditAtom);
	const enableTimeModeDoubleClickEdit = useAtomValue(
		enableTimeModeDoubleClickEditAtom,
	);

	const store = useStore();
	const enableUpcomingWordHighlight = useAtomValue(
		enableUpcomingWordHighlightAtom,
	);
	const upcomingWordHighlightColor = useAtomValue(
		upcomingWordHighlightColorAtom,
	);
	const upcomingWordHighlightThreshold = useAtomValue(
		upcomingWordHighlightThresholdAtom,
	);

	const startTimeRef = useRef<HTMLDivElement>(null);
	const endTimeRef = useRef<HTMLDivElement>(null);
	const ambientHighlightRef = useRef<HTMLDivElement>(null);
	const wordContainerRef = useRef<HTMLDivElement>(null);
	const lastClickTimeRef = useRef(0);

	// Keep mutable refs for active-highlight settings to avoid re-subscribing on every settings change
	const highlightActiveWordRef = useRef(highlightActiveWord);
	const enableSyncGlowAnimationRef = useRef(enableSyncGlowAnimation);
	useEffect(() => { highlightActiveWordRef.current = highlightActiveWord; }, [highlightActiveWord]);
	useEffect(() => { enableSyncGlowAnimationRef.current = enableSyncGlowAnimation; }, [enableSyncGlowAnimation]);

	// ── PERF FIX: Drive the active/animated classes imperatively via store.sub
	// instead of subscribing to currentTimeAtom inside React (which causes ~60fps
	// re-renders of every visible word).
	useEffect(() => {
		const updateActive = () => {
			const el = wordContainerRef.current;
			if (!el) return;
			const currentTime = store.get(currentTimeAtom);
			const isActive = currentTime >= startTime && currentTime < endTime;
			if (isActive) {
				if (highlightActiveWordRef.current) {
					el.classList.add(styles.active);
					if (enableSyncGlowAnimationRef.current) {
						el.classList.add(styles.animated);
					} else {
						el.classList.remove(styles.animated);
					}
				}
			} else {
				el.classList.remove(styles.active);
				el.classList.remove(styles.animated);
			}
		};
		updateActive();
		return store.sub(currentTimeAtom, updateActive);
	}, [store, startTime, endTime]);

	// Inline timestamp editing state: null = not editing, "start" | "end" = editing that field
	const [editingTime, setEditingTime] = useState<"start" | "end" | null>(null);
	const [editingInput, setEditingInput] = useState("");
	const [editingTextField, setEditingTextField] = useState<
		"word" | "romanWord" | null
	>(null);
	const [editingTextValue, setEditingTextValue] = useState("");
	const editingTextInputRef = useRef<HTMLInputElement>(null);
	const editingTextMeasureRef = useRef<HTMLSpanElement>(null);
	const editingTextValueRef = useRef("");
	const [editingTextWidth, setEditingTextWidth] = useState<number>();
	const textForMeasurement = editingTextValue || " ";

	useEffect(() => {
		if (!editingTextField) return;
		editingTextInputRef.current?.focus();
		editingTextInputRef.current?.select();
	}, [editingTextField]);

	useLayoutEffect(() => {
		if (
			!editingTextField ||
			!editingTextMeasureRef.current ||
			!textForMeasurement
		)
			return;
		setEditingTextWidth(
			Math.ceil(editingTextMeasureRef.current.getBoundingClientRect().width),
		);
	}, [editingTextField, textForMeasurement]);

	const commitTextEdit = useCallback(
		(field: "word" | "romanWord", value: string) => {
			editLyricLines((state) => {
				const targetLine = state.lyricLines.find((item) => item.id === line.id);
				const targetWord = targetLine?.words[wordIndex];
				if (targetWord) targetWord[field] = value;
			});
			setEditingTextField(null);
		},
		[editLyricLines, line.id, wordIndex],
	);

	useEffect(() => {
		if (!editingTextField) return;

		const commitOnOutsidePointerDown = (event: PointerEvent) => {
			if (editingTextInputRef.current?.contains(event.target as Node)) return;
			commitTextEdit(editingTextField, editingTextValueRef.current);
		};

		document.addEventListener("pointerdown", commitOnOutsidePointerDown, true);
		return () =>
			document.removeEventListener("pointerdown", commitOnOutsidePointerDown, true);
	}, [commitTextEdit, editingTextField]);

	const commitTimeEdit = useCallback(
		(field: "start" | "end", rawValue: string) => {
			try {
				const newMs = parseTimespan(rawValue);
				editLyricLines((state) => {
					const targetLine = state.lyricLines.find((l) => l.id === line.id);
					if (!targetLine) return;
					const word = targetLine.words[wordIndex];
					if (!word) return;
					if (rubyIndex >= 0) {
						const ruby = word.ruby?.[rubyIndex];
						if (!ruby) return;
						if (field === "start") ruby.startTime = newMs;
						else ruby.endTime = newMs;
					} else {
						if (field === "start") word.startTime = newMs;
						else word.endTime = newMs;
					}
				});
			} catch {
				// invalid format — silently revert
			}
			setEditingTime(null);
		},
		[editLyricLines, line.id, wordIndex, rubyIndex],
	);

	const startTimeDisplay = msToTimestamp(startTime);
	const endTimeDisplay = showEndTimeAsDuration
		? `+${endTime - startTime}ms`
		: msToTimestamp(endTime);

	// Optimized render loop for pre-playback word ambient highlighting
	useEffect(() => {
		if (!enableUpcomingWordHighlight || !ambientHighlightRef.current) return;

		const updateHighlight = () => {
			if (!ambientHighlightRef.current) return;
			const currentTime = store.get(currentTimeAtom);
			const delta = startTime - currentTime;
			const threshold = upcomingWordHighlightThreshold;

			const isBlueActive =
				ambientHighlightRef.current.parentElement?.classList.contains(
					styles.active,
				);

			// Extend the highlight window by 50ms to sync with the React blue highlight render delay
			if (
				delta > -50 &&
				!isBlueActive &&
				(threshold <= 0 || delta <= threshold)
			) {
				// Cap effective delta at 0 so opacity stays at maximum (0.75) during the 50ms delay window
				const effectiveDelta = Math.max(0, delta);
				const opacity =
					threshold > 0 ? 0.75 * (1 - effectiveDelta / threshold) : 0.75;
				ambientHighlightRef.current.style.transition = "none";
				ambientHighlightRef.current.style.opacity = opacity.toFixed(3);
				ambientHighlightRef.current.style.backgroundColor =
					upcomingWordHighlightColor;
			} else {
				ambientHighlightRef.current.style.transition = "none";
				ambientHighlightRef.current.style.opacity = "0";
			}
		};

		// Run immediately to establish initial state without waiting for playback
		updateHighlight();

		return store.sub(currentTimeAtom, updateHighlight);
	}, [
		enableUpcomingWordHighlight,
		upcomingWordHighlightColor,
		upcomingWordHighlightThreshold,
		startTime,
		store,
	]);

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
	}, [startTime, visualizeTimestampUpdate]);

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
	}, [endTime, visualizeTimestampUpdate]);

	const instantFade = useAtomValue(instantHighlightFadeAtom);
	const hasError = useMemo(() => startTime > endTime, [startTime, endTime]);
	const setOpenSplitWordDialog = useSetAtom(splitWordDialogAtom);
	const setEditingWordState = useSetAtom(editingWordStateAtom);

	// active/animated classes are applied imperatively by the store.sub effect above
	const className = useMemo(
		() =>
			classNames(
				styles.lyricWord,
				styles.sync,
				instantFade && styles.hasInstantFade,
				isWordSelected && styles.selected,
				isWordBlank && styles.blank,
				hasError &&
					(toolMode === ToolMode.Edit ||
						(toolMode === ToolMode.Sync &&
							showTimestamps &&
							highlightErrors)) &&
					styles.error,
				/* highlightGrammarWarnings is visually disabled as per user request */
			),
		[
			instantFade,
			isWordBlank,
			isWordSelected,
			hasError,
			toolMode,
			showTimestamps,
			highlightErrors,
		],
	);


	return (
		<div
			ref={wordContainerRef}
			className={className}
			style={{ position: "relative", zIndex: 1 }}
			onPointerDown={(evt) => {
				evt.stopPropagation();
				evt.preventDefault();
				setSelectedLines((state) => {
					state.clear();
					state.add(line.id);
				});
				setSelectedWords((state) => {
					state.clear();
					if (syncLevelMode === "line") {
						const units = getSynchronizableUnits(line);
						for (const unit of units) {
							state.add(unit.id);
						}
					} else {
						state.add(syncId);
					}
				});
			}}
			onClick={(evt) => {
				evt.stopPropagation();
				evt.preventDefault();

				const now = Date.now();
				const clickInterval = now - lastClickTimeRef.current;
				lastClickTimeRef.current = now;

				// Only trigger double-click actions within the standard double-click window.
				if (clickInterval > 300) return;

				if (evt.ctrlKey || evt.metaKey) {
					setEditingWordState({
						wordIndex,
						lineIndex,
						word: word.word,
					});
					setOpenSplitWordDialog(true);
					return;
				}
				if (!enableTimeModeDoubleClickEdit) return;

				const value = word[editableField] || "";
				editingTextValueRef.current = value;
				setEditingTextValue(value);
				setEditingTextField(editableField);
			}}
		>
			<div
				ref={ambientHighlightRef}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					opacity: 0,
					zIndex: -1,
					pointerEvents: "none",
					borderRadius: "inherit",
				}}
			/>
			{showTimestamps && (
				<div
					className={classNames(styles.startTime)}
					ref={startTimeRef}
					title={enableManualTimestampEdit ? "Click to edit start time" : undefined}
					style={{ cursor: enableManualTimestampEdit ? "text" : "default" }}
					onClick={(e) => {
						if (!enableManualTimestampEdit) return;
						e.stopPropagation();
						setEditingInput(startTimeDisplay);
						setEditingTime("start");
					}}
				>
					{editingTime === "start" ? (
						<input
							autoFocus
							value={editingInput}
							onChange={(e) => setEditingInput(e.target.value)}
							onBlur={() => commitTimeEdit("start", editingInput)}
							onKeyDown={(e) => {
								if (e.key === "Enter") commitTimeEdit("start", editingInput);
								if (e.key === "Escape") setEditingTime(null);
								e.stopPropagation();
							}}
							onClick={(e) => e.stopPropagation()}
							style={{
								width: "100%",
								background: "transparent",
								border: "none",
								outline: "1px solid var(--accent-8)",
								borderRadius: "2px",
								color: "inherit",
								fontFamily: "inherit",
								fontSize: "inherit",
								textAlign: "center",
								padding: "0 2px",
							}}
						/>
					) : (
						startTimeDisplay
					)}
				</div>
			)}
			{editingTextField ? (
				<>
					<span ref={editingTextMeasureRef} className={styles.syncWordInputMeasure}>
						{textForMeasurement}
					</span>
					<input
						ref={editingTextInputRef}
						value={editingTextValue}
						style={
							editingTextWidth ? { width: `${editingTextWidth}px` } : undefined
						}
						onChange={(event) => {
							editingTextValueRef.current = event.currentTarget.value;
							setEditingTextValue(event.currentTarget.value);
						}}
						onBlur={(event) =>
							commitTextEdit(editingTextField, event.currentTarget.value)
						}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => event.stopPropagation()}
						onKeyDown={(event) => {
							event.stopPropagation();
							if (event.key === "Enter") {
								event.preventDefault();
								commitTextEdit(editingTextField, event.currentTarget.value);
							}
							if (event.key === "Escape") {
								event.preventDefault();
								setEditingTextField(null);
							}
						}}
						className={styles.syncWordInput}
					/>
				</>
			) : (
				<div className={styles.displayWord}>{displayWord}</div>
			)}
			{showTimestamps && (
				<div
					className={classNames(styles.endTime)}
					ref={endTimeRef}
					title={enableManualTimestampEdit ? "Click to edit end time" : undefined}
					style={{ cursor: enableManualTimestampEdit ? "text" : "default" }}
					onClick={(e) => {
						if (!enableManualTimestampEdit) return;
						e.stopPropagation();
						setEditingInput(
							showEndTimeAsDuration ? msToTimestamp(endTime) : endTimeDisplay,
						);
						setEditingTime("end");
					}}
				>
					{editingTime === "end" ? (
						<input
							autoFocus
							value={editingInput}
							onChange={(e) => setEditingInput(e.target.value)}
							onBlur={() => commitTimeEdit("end", editingInput)}
							onKeyDown={(e) => {
								if (e.key === "Enter") commitTimeEdit("end", editingInput);
								if (e.key === "Escape") setEditingTime(null);
								e.stopPropagation();
							}}
							onClick={(e) => e.stopPropagation()}
							style={{
								width: "100%",
								background: "transparent",
								border: "none",
								outline: "1px solid var(--accent-8)",
								borderRadius: "2px",
								color: "inherit",
								fontFamily: "inherit",
								fontSize: "inherit",
								textAlign: "center",
								padding: "0 2px",
							}}
						/>
					) : (
						endTimeDisplay
					)}
				</div>
			)}
		</div>
	);
};

const LyricWorldViewSync: FC<{
	wordAtom: Atom<LyricWord>;
	wordIndex: number;
	line: LyricLine;
	lineIndex: number;
}> = ({ wordAtom, line, lineIndex, wordIndex }) => {
	const { t } = useTranslation();
	const word = useAtomValue(wordAtom);
	const displayRomanizationInSync = useAtomValue(displayRomanizationInSyncAtom);
	const hasRomanization =
		displayRomanizationInSync && word.romanWord?.trim() !== "";
	const isWordBlank = useWordBlank(word.word);
	const getDisplayWord = useCallback(
		(
			displayText: string,
			isBlank: boolean,
			romanWord?: string,
			showRomanization?: boolean,
		) =>
			getDisplayWordText(t, displayText, isBlank, romanWord, showRomanization),
		[t],
	);

	const content =
		word.ruby && word.ruby.length > 0 ? (
			<div className={styles.rubySyncRow}>
				{word.ruby.map((rubyWord, rubyIndex) => {
					const isRubyBlank =
						rubyWord.word.length === 0 ||
						(rubyWord.word.length > 0 && rubyWord.word.trim().length === 0);
					return (
						<LyricSyncWordView
							key={`${word.id}-ruby-${rubyIndex}`}
							syncId={buildRubySelectionId(word.id, rubyIndex)}
							wordAtom={wordAtom}
							line={line}
							startTime={rubyWord.startTime}
							endTime={rubyWord.endTime}
							displayWord={getDisplayWord(rubyWord.word, isRubyBlank)}
							isWordBlank={isRubyBlank}
							wordIndex={wordIndex}
							lineIndex={lineIndex}
							rubyIndex={rubyIndex}
							editableField="word"
						/>
					);
				})}
			</div>
		) : (
			<LyricSyncWordView
				syncId={word.id}
				wordAtom={wordAtom}
				line={line}
				startTime={word.startTime}
				endTime={word.endTime}
				displayWord={getDisplayWord(
					word.word,
					isWordBlank,
					word.romanWord,
					displayRomanizationInSync,
				)}
				isWordBlank={isWordBlank}
				wordIndex={wordIndex}
				lineIndex={lineIndex}
				editableField={hasRomanization ? "romanWord" : "word"}
			/>
		);

	return content;
};

type LyricWordViewProps = {
	wordAtom: Atom<LyricWord>;
	wordIndex: number;
	line: LyricLine;
	lineIndex: number;
};

export const LyricWordView: FC<LyricWordViewProps & { isHeaderLine?: boolean }> = memo(
	({ wordAtom, wordIndex, line, lineIndex, isHeaderLine }) => {
	const word = useAtomValue(wordAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const layoutMode = useAtomValue(layoutModeAtom);

	const isWordBlank = useWordBlank(word.word);
	const hasRuby = word.ruby && word.ruby.length > 0;

	if (isHeaderLine) {
		return (
			<div className={styles.wordMainText} style={{ padding: "8px 0" }}>
				{word.word}
			</div>
		);
	}

	return (
		<div>
			{toolMode === ToolMode.Edit && layoutMode === LayoutMode.Simple && (
				<LyricWorldViewEdit
					wordAtom={wordAtom}
					line={line}
					lineIndex={lineIndex}
					wordIndex={wordIndex}
				/>
			)}
			{toolMode === ToolMode.Edit && layoutMode === LayoutMode.Advance && (
				<LyricWordViewEditAdvance
					wordAtom={wordAtom}
					line={line}
					lineIndex={lineIndex}
					wordIndex={wordIndex}
				/>
			)}
			{toolMode === ToolMode.Sync && (hasRuby || !isWordBlank) && (
				<LyricWorldViewSync
					wordAtom={wordAtom}
					line={line}
					lineIndex={lineIndex}
					wordIndex={wordIndex}
				/>
			)}
		</div>
	);
	},
	// Custom comparator: line.id is stable (never changes after creation).
	// Checking it instead of the full line object prevents all word views in a
	// line from re-rendering when a single word's timestamp is committed.
	// The wordAtom reference changes (via splitAtom) only for the modified word,
	// so only that word re-renders.
	(prev, next) =>
		prev.wordAtom === next.wordAtom &&
		prev.wordIndex === next.wordIndex &&
		prev.lineIndex === next.lineIndex &&
		prev.line.id === next.line.id,
);

export default LyricWordView;
