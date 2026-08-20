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

import React, {
	forwardRef,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type FC,
} from "react";
import {
	Button,
	Checkbox,
	Flex,
	Grid,
	IconButton,
	Popover,
	RadioGroup,
	Select,
	Spinner,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { QuestionCircle16Regular } from "@fluentui/react-icons";
import { atom, useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import {
	displayRomanizationInSyncAtom,
	LayoutMode,
	layoutModeAtom,
	showLineRomanizationAtom,
	showLineTranslationAtom,
	showWordRomanizationInputAtom,
} from "$/modules/settings/states/index.ts";
import {
	ActiveFileKind,
	activeFileKindAtom,
	editingTimeFieldAtom,
	lyricLinesAtom,
	requestFocusAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	showEndTimeAsDurationAtom,
	vocalistNamesAtom,
} from "$/states/main.ts";
import {
	reverseSyncLineIdsAtom,
	reverseSyncTimingBackupAtom,
} from "$/modules/settings/states/sync";
import { grammarCheckDialogAtom } from "$/modules/lyric-editor/modals/GrammarCheckDialog.tsx";
import {
	createLineTimingSnapshots,
	restoreLineTimingSnapshots,
	type LineTimingSnapshot,
} from "$/modules/lyric-editor/utils/line-timing";
import { type LyricLine, type LyricWord, newLyricLine } from "$/types/ttml";
import { msToTimestamp, parseTimespan } from "$/utils/timestamp.ts";
import {
	buildLineRomanization,
	getPhoneticSyllables,
} from "$/utils/phonetic";
import { RibbonFrame, RibbonSection } from "./common";
import { advancedRibbonControlsAtom } from "$/modules/onboarding/states";

const GrammarCheckButton = () => {
	const { t } = useTranslation();
	const store = useStore();
	return (
		<Button
			onClick={() => {
				store.set(grammarCheckDialogAtom, true);
			}}
		>
			{t("ribbonBar.editMode.grammarCheck", "Grammar Check")}
		</Button>
	);
};

const MULTIPLE_VALUES = Symbol("multiple-values");

function EditField<
	L extends Word extends true ? LyricWord : LyricLine,
	F extends keyof L,
	Word extends boolean | undefined = undefined,
>({
	label,
	isWordField,
	fieldName,
	formatter,
	parser,
	textFieldStyle,
}: {
	label: string;
	isWordField?: Word;
	fieldName: F;
	formatter: (v: L[F]) => string;
	parser: (v: string) => L[F];
	textFieldStyle?: React.CSSProperties;
}) {
	const [fieldInput, setFieldInput] = useState<string | undefined>(undefined);
	const [fieldPlaceholder, setFieldPlaceholder] = useState<string>("");
	const [showDurationInput, setShowDurationInput] = useAtom(
		showEndTimeAsDurationAtom,
	);
	const itemAtom = useMemo(
		() => (isWordField ? selectedWordsAtom : selectedLinesAtom),
		[isWordField],
	);

	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const { t } = useTranslation();
	const setEditingTimeField = useSetAtom(editingTimeFieldAtom);

	const [requestFocus, setRequestFocus] = useAtom(requestFocusAtom);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (requestFocus === fieldName && !isWordField && inputRef.current) {
			inputRef.current.focus();
			setRequestFocus(null);
		}
	}, [requestFocus, fieldName, isWordField, setRequestFocus]);

	const hasErrorAtom = useMemo(
		() =>
			atom((get) => {
				if (fieldName !== "startTime" && fieldName !== "endTime") {
					return false;
				}

				const selectedItems = get(itemAtom);
				if (selectedItems.size === 0) return false;

				const lyricLines = get(lyricLinesAtom);

				if (isWordField) {
					const selectedWords = selectedItems;
					for (const line of lyricLines.lyricLines) {
						for (const word of line.words) {
							if (selectedWords.has(word.id)) {
								if (word.startTime > word.endTime) {
									return true;
								}
							}
						}
					}
				} else {
					const selectedLines = selectedItems;
					for (const line of lyricLines.lyricLines) {
						if (selectedLines.has(line.id)) {
							if (line.startTime > line.endTime) {
								return true;
							}
						}
					}
				}
				return false;
			}),
		[fieldName, isWordField, itemAtom],
	);
	const hasError = useAtomValue(hasErrorAtom);

	const currentValueAtom = useMemo(
		() =>
			atom((get) => {
				const selectedItems = get(itemAtom);
				const lyricLines = get(lyricLinesAtom);
				if (selectedItems.size === 0) return undefined;

				if (isWordField) {
					const selectedWords = selectedItems as Set<string>;
					const values = new Set();
					for (const line of lyricLines.lyricLines) {
						for (const word of line.words) {
							if (selectedWords.has(word.id)) {
								values.add(word[fieldName as keyof LyricWord]);
							}
						}
					}
					if (values.size === 1)
						return formatter(values.values().next().value as L[F]);
					return MULTIPLE_VALUES;
				}
				const selectedLines = selectedItems as Set<string>;
				const values = new Set();
				for (const line of lyricLines.lyricLines) {
					if (selectedLines.has(line.id)) {
						values.add(line[fieldName as keyof LyricLine]);
					}
				}
				if (values.size === 1)
					return formatter(values.values().next().value as L[F]);
				return MULTIPLE_VALUES;
			}),
		[fieldName, formatter, isWordField, itemAtom],
	);
	const currentValue = useAtomValue(currentValueAtom);
	const store = useStore();
	const durationValueAtom = useMemo(
		() =>
			atom((get) => {
				if (fieldName !== "endTime") return undefined;
				const selectedItems = get(itemAtom);
				const lyricLines = get(lyricLinesAtom);
				if (selectedItems.size === 0) return undefined;
				const durations = new Set<number>();
				if (isWordField) {
					const selectedWords = selectedItems as Set<string>;
					for (const line of lyricLines.lyricLines) {
						for (const word of line.words) {
							if (selectedWords.has(word.id)) {
								durations.add(word.endTime - word.startTime);
							}
						}
					}
				} else {
					const selectedLines = selectedItems as Set<string>;
					for (const line of lyricLines.lyricLines) {
						if (selectedLines.has(line.id)) {
							durations.add(line.endTime - line.startTime);
						}
					}
				}
				if (durations.size === 1) return durations.values().next().value;
				return MULTIPLE_VALUES;
			}),
		[fieldName, isWordField, itemAtom],
	);
	const durationValue = useAtomValue(durationValueAtom);
	const compareValue = useMemo(() => {
		if (fieldName === "endTime" && showDurationInput) {
			if (durationValue === MULTIPLE_VALUES) return "";
			if (typeof durationValue === "number") return String(durationValue);
			return "";
		}
		if (typeof currentValue === "string") return currentValue;
		return "";
	}, [currentValue, durationValue, fieldName, showDurationInput]);

	const onInputFinished = useCallback(
		(rawValue: string) => {
			try {
				const selectedItems = store.get(itemAtom);
				if (fieldName === "endTime" && showDurationInput) {
					const trimmedValue = rawValue.trim();
					const isDelta =
						trimmedValue.startsWith("+") || trimmedValue.startsWith("-");
					const parsedValue = Number(trimmedValue);
					if (!Number.isFinite(parsedValue)) return;
					if (!isDelta && parsedValue <= 0) return;
					editLyricLines((state) => {
						for (const line of state.lyricLines) {
							if (isWordField) {
								const updates = new Map<
									string,
									{ startTime?: number; endTime?: number }
								>();

								// First pass: Calculate all new end times for selected words
								for (
									let wordIndex = 0;
									wordIndex < line.words.length;
									wordIndex++
								) {
									const word = line.words[wordIndex];
									if (!selectedItems.has(word.id)) continue;

									const nextWord = line.words[wordIndex + 1];
									const nextStartTime = nextWord?.startTime;
									const originalEndTime = word.endTime;

									// Calculate new end time
									const newEndTimeRaw = isDelta
										? word.endTime + parsedValue
										: word.startTime + parsedValue;
									const newEndTime = Math.max(word.startTime, newEndTimeRaw);

									// Store the update for the current word
									const wordUpdate = updates.get(word.id) || {};
									wordUpdate.endTime = newEndTime;
									updates.set(word.id, wordUpdate);

									// If it was synchronized, store the start time update for the next word
									if (
										isDelta &&
										nextWord &&
										originalEndTime === nextStartTime
									) {
										// We only move nextWord's startTime if the new end time doesn't exceed its original end time
										// to avoid inverting its duration (unless it's also selected, handled below)
										const nextWordOriginalEndTime = nextWord.endTime;
										if (
											newEndTime <= nextWordOriginalEndTime ||
											selectedItems.has(nextWord.id)
										) {
											const nextUpdate = updates.get(nextWord.id) || {};
											nextUpdate.startTime = newEndTime;
											// Don't auto-fix nextWord.endTime here, let the second pass or its own delta fix it
											updates.set(nextWord.id, nextUpdate);
										}
									}
								}

								// Second pass: Apply updates and ensure durations are valid
								for (
									let wordIndex = 0;
									wordIndex < line.words.length;
									wordIndex++
								) {
									const word = line.words[wordIndex];
									const update = updates.get(word.id);

									if (update) {
										if (update.startTime !== undefined) {
											word.startTime = update.startTime;
										}
										if (update.endTime !== undefined) {
											word.endTime = update.endTime;
										}
										// Ensure valid duration after applying updates
										if (word.endTime < word.startTime) {
											word.endTime = word.startTime;
										}
									}
								}
							} else if (selectedItems.has(line.id)) {
								const newEndTimeRaw = isDelta
									? line.endTime + parsedValue
									: line.startTime + parsedValue;
								line.endTime = Math.max(line.startTime, newEndTimeRaw);
							}
						}
						return state;
					});
					return;
				}
				const value = parser(rawValue);
				editLyricLines((state) => {
					for (const line of state.lyricLines) {
						if (isWordField) {
							for (const word of line.words) {
								if (selectedItems.has(word.id)) {
									(word as L)[fieldName] = value;
								}
							}
						} else {
							if (selectedItems.has(line.id)) {
								(line as L)[fieldName] = value;
							}
						}
					}
					return state;
				});
			} catch {
				if (compareValue) setFieldInput(compareValue);
			}
		},
		[
			itemAtom,
			store,
			editLyricLines,
			compareValue,
			fieldName,
			isWordField,
			parser,
			showDurationInput,
		],
	);

	useLayoutEffect(() => {
		if (fieldName === "endTime" && showDurationInput) {
			if (durationValue === MULTIPLE_VALUES) {
				setFieldInput("");
				setFieldPlaceholder(
					t("ribbonBar.editMode.multipleValues", "Multiple values..."),
				);
				return;
			}
			if (typeof durationValue === "number") {
				setFieldInput(String(durationValue));
				setFieldPlaceholder("");
				return;
			}
			setFieldInput(undefined);
			setFieldPlaceholder("");
			return;
		}
		if (currentValue === MULTIPLE_VALUES) {
			setFieldInput("");
			setFieldPlaceholder(t("ribbonBar.editMode.multipleValues", "Multiple values..."));
			return;
		}
		setFieldInput(currentValue);
		setFieldPlaceholder("");
	}, [currentValue, durationValue, fieldName, showDurationInput, t]);

	return (
		<>
			{fieldName === "endTime" ? (
				<Button
					size="1"
					variant="ghost"
					style={{ justifyContent: "flex-start", paddingLeft: "0px", marginLeft: 0 }}
					onClick={() => setShowDurationInput((v) => !v)}
				>
					{showDurationInput
						? t("ribbonBar.editMode.duration", "Duration")
						: label}
				</Button>
			) : (
				<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
					{label}
				</Text>
			)}
			<TextField.Root
				ref={inputRef}
				size="1"
				color={hasError ? "red" : undefined}
				variant={hasError ? "soft" : undefined}
				style={{ width: "8em", ...textFieldStyle }}
				value={fieldInput ?? ""}
				placeholder={fieldPlaceholder}
				disabled={fieldInput === undefined}
				onChange={(evt) => setFieldInput(evt.currentTarget.value)}
				onKeyDown={(evt) => {
					if (evt.key !== "Enter") return;
					onInputFinished(evt.currentTarget.value);
				}}
				onFocus={() => {
					if (
						!isWordField &&
						(fieldName === "startTime" || fieldName === "endTime")
					) {
						setEditingTimeField({
							isWord: false,
							field: fieldName as "startTime" | "endTime",
						});
					}
				}}
				onBlur={(evt) => {
					setEditingTimeField(null);

					if (evt.currentTarget.value === compareValue) return;
					onInputFinished(evt.currentTarget.value);
				}}
			/>
		</>
	);
}

function CheckboxField<
	L extends Word extends true ? LyricWord : LyricLine,
	F extends keyof L,
	V extends L[F] extends boolean | undefined ? boolean : never,
	Word extends boolean | undefined = undefined,
>({
	label,
	isWordField,
	fieldName,
	defaultValue,
	exclusiveWith,
}: {
	label: string;
	isWordField: Word;
	fieldName: F;
	defaultValue: V;
	/** When checked true, these sibling boolean fields on the same line are forced back to false. */
	exclusiveWith?: (keyof L)[];
}) {
	const itemAtom = useMemo(
		() => (isWordField ? selectedWordsAtom : selectedLinesAtom),
		[isWordField],
	);

	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const store = useStore();

	const currentValueAtom = useMemo(
		() =>
			atom((get) => {
				const selectedItems = get(itemAtom);
				const lyricLines = get(lyricLinesAtom);
				if (selectedItems.size) {
					if (isWordField) {
						const selectedWords = selectedItems as Set<string>;
						const values = new Set();
						for (const line of lyricLines.lyricLines) {
							for (const word of line.words) {
								if (selectedWords.has(word.id)) {
									values.add(word[fieldName as keyof LyricWord]);
								}
							}
						}
						if (values.size === 1) return values.values().next().value as L[F];
						return MULTIPLE_VALUES;
					}
					const selectedLines = selectedItems as Set<string>;
					const values = new Set();
					for (const line of lyricLines.lyricLines) {
						if (selectedLines.has(line.id)) {
							values.add(line[fieldName as keyof LyricLine]);
						}
					}
					if (values.size === 1) return values.values().next().value as L[F];
					return MULTIPLE_VALUES;
				}
				return undefined;
			}),
		[itemAtom, fieldName, isWordField],
	);
	const currentValue = useAtomValue(currentValueAtom);
	const isDisabledAtom = useMemo(
		() => atom((get) => get(itemAtom).size === 0),
		[itemAtom],
	);
	const isDisabled = useAtomValue(isDisabledAtom);
	const checkboxId = useId();

	return (
		<>
			<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
				<label htmlFor={checkboxId}>{label}</label>
			</Text>
			<Checkbox
				disabled={isDisabled}
				id={checkboxId}
				checked={
					currentValue
						? currentValue === MULTIPLE_VALUES
							? "indeterminate"
							: (currentValue as boolean)
						: defaultValue
				}
				onCheckedChange={(value) => {
					if (value === "indeterminate") return;
					editLyricLines((state) => {
						const selectedItems = store.get(itemAtom);
						for (const line of state.lyricLines) {
							if (isWordField) {
								for (const word of line.words) {
									if (selectedItems.has(word.id)) {
										(word as L)[fieldName] = value as L[F];
									}
								}
							} else {
								if (selectedItems.has(line.id)) {
									(line as L)[fieldName] = value as L[F];
									if (value && exclusiveWith) {
										for (const other of exclusiveWith) {
											(line as Record<string, unknown>)[other as string] =
												false;
										}
									}
								}
							}
						}
						return state;
					});
				}}
			/>
		</>
	);
}

function ReverseSyncCheckbox() {
	const { t } = useTranslation();
	const store = useStore();
	const selectedLines = useAtomValue(selectedLinesAtom);
	const [reverseSyncLineIds, setReverseSyncLineIds] = useAtom(
		reverseSyncLineIdsAtom,
	);
	const setReverseSyncTimingBackup = useSetAtom(reverseSyncTimingBackupAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const checkboxId = useId();

	const checked = useMemo(() => {
		if (selectedLines.size === 0) return false;
		const allSelected = [...selectedLines].every((id) =>
			reverseSyncLineIds.has(id),
		);
		const noneSelected = [...selectedLines].every(
			(id) => !reverseSyncLineIds.has(id),
		);
		if (allSelected) return true;
		if (noneSelected) return false;
		return "indeterminate" as const;
	}, [selectedLines, reverseSyncLineIds]);

	return (
		<>
			<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
				<label htmlFor={checkboxId}>
					{t("contextMenu.reverseSyncOrder", "Reverse sync order")}
				</label>
			</Text>
			<Checkbox
				disabled={selectedLines.size === 0}
				id={checkboxId}
				checked={checked}
				onCheckedChange={(value) => {
					if (value === "indeterminate") return;
					if (value) {
						const lyrics = store.get(lyricLinesAtom).lyricLines;
						const snapshots = createLineTimingSnapshots(
							lyrics,
							selectedLines,
						);
						if (snapshots.length > 0) {
							setReverseSyncTimingBackup((prev) => {
								const nextMap = new Map(prev);
								for (const snapshot of snapshots) {
									nextMap.set(snapshot.sourceLineId, snapshot);
								}
								return nextMap;
							});
						}
					} else {
						const backup = store.get(reverseSyncTimingBackupAtom);
						const snapshots = [...selectedLines]
							.map((lineId) => backup.get(lineId))
							.filter(
								(snapshot): snapshot is LineTimingSnapshot =>
									snapshot !== undefined,
							);
						if (snapshots.length > 0) {
							editLyricLines((state) => {
								restoreLineTimingSnapshots(
									state.lyricLines,
									snapshots,
								);
							});
						}
						setReverseSyncTimingBackup((prev) => {
							const nextMap = new Map(prev);
							for (const lineId of selectedLines) {
								nextMap.delete(lineId);
							}
							return nextMap;
						});
					}
					const next = new Set(reverseSyncLineIds);
					for (const lineId of selectedLines) {
						if (value) {
							next.add(lineId);
						} else {
							next.delete(lineId);
						}
					}
					setReverseSyncLineIds(next);
				}}
			/>
		</>
	);
}

function EditModeField({
	simpleModeLabel = "Simple Mode",
	advanceModeLabel = "Advanced Mode",
}) {
	const [layoutMode, setLayoutMode] = useAtom(layoutModeAtom);
	return (
		<RadioGroup.Root
			value={layoutMode}
			onValueChange={(v) => setLayoutMode(v as LayoutMode)}
			size="1"
		>
			<Flex gapY="3" direction="column">
				<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
					<RadioGroup.Item value={LayoutMode.Simple}>
						{simpleModeLabel}
					</RadioGroup.Item>
				</Text>
				<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
					<RadioGroup.Item value={LayoutMode.Advance}>
						{advanceModeLabel}
					</RadioGroup.Item>
				</Text>
			</Flex>
		</RadioGroup.Root>
	);
}
// function DropdownField<
// 	L extends Word extends true ? LyricWord : LyricLine,
// 	F extends keyof L,
// 	Word extends boolean | undefined = undefined,
// >({
// 	label,
// 	isWordField,
// 	fieldName,
// 	children,
// 	defaultValue,
// }: {
// 	label: string;
// 	isWordField: Word;
// 	fieldName: F;
// 	defaultValue: L[F];
// 	children?: ReactNode | undefined;
// }) {
// 	const itemAtom = useMemo(
// 		() => (isWordField ? selectedWordsAtom : selectedLinesAtom),
// 		[isWordField],
// 	);
// 	const selectedItems = useAtomValue(itemAtom);

// 	const [lyricLines, editLyricLines] = useAtom(currentLyricLinesAtom);

// 	const currentValue = useMemo(() => {
// 		if (selectedItems.size) {
// 			if (isWordField) {
// 				const selectedWords = selectedItems as Set<string>;
// 				const values = new Set();
// 				for (const line of lyricLines.lyricLines) {
// 					for (const word of line.words) {
// 						if (selectedWords.has(word.id)) {
// 							values.add(word[fieldName as keyof LyricWord]);
// 						}
// 					}
// 				}
// 				if (values.size === 1)
// 					return {
// 						multiplieValues: false,
// 						value: values.values().next().value as L[F],
// 					} as const;
// 				return {
// 					multiplieValues: true,
// 					value: "",
// 				} as const;
// 			}
// 			const selectedLines = selectedItems as Set<string>;
// 			const values = new Set();
// 			for (const line of lyricLines.lyricLines) {
// 				if (selectedLines.has(line.id)) {
// 					values.add(line[fieldName as keyof LyricLine]);
// 				}
// 			}
// 			if (values.size === 1)
// 				return {
// 					multiplieValues: false,
// 					value: values.values().next().value as L[F],
// 				} as const;
// 			return {
// 				multiplieValues: true,
// 				value: "",
// 			} as const;
// 		}
// 		return undefined;
// 	}, [selectedItems, fieldName, isWordField, lyricLines]);

// 	return (
// 		<>
// 			<Text wrap="nowrap" size="1">
// 				{label}
// 			</Text>
// 			<Select.Root
// 				size="1"
// 				disabled={selectedItems.size === 0}
// 				defaultValue={defaultValue as string}
// 				value={(currentValue?.value as string) ?? ""}
// 				onValueChange={(value) => {
// 					editLyricLines((state) => {
// 						for (const line of state.lyricLines) {
// 							if (isWordField) {
// 								for (const word of line.words) {
// 									if (selectedItems.has(word.id)) {
// 										(word as L)[fieldName] = value as L[F];
// 									}
// 								}
// 							} else {
// 								if (selectedItems.has(line.id)) {
// 									(line as L)[fieldName] = value as L[F];
// 								}
// 							}
// 						}
// 						return state;
// 					});
// 				}}
// 			>
// 				<Select.Trigger

// 				/>
// 				<Select.Content>{children}</Select.Content>
// 			</Select.Root>
// 		</>
// 	);
// }

const AuxiliaryDisplayField: FC = () => {
	const [showTranslation, setShowTranslation] = useAtom(
		showLineTranslationAtom,
	);
	const [showRomanization, setShowRomanization] = useAtom(
		showLineRomanizationAtom,
	);
	const [showWordRomanizationInput, setShowWordRomanizationInput] = useAtom(
		showWordRomanizationInputAtom,
	);
	const { t } = useTranslation();

	const idTranslation = useId();
	const idRomanization = useId();
	const idPerWord = useId();

	return (
		<Grid columns="1fr auto" gapX="4" gapY="1" flexGrow="1" align="center">
			<Text size="1" asChild style={{ color: "var(--accent-11)" }}>
				<label htmlFor={idTranslation}>
					{t("ribbonBar.editMode.showTranslation", "Show Translation Line")}
				</label>
			</Text>
			<Checkbox
				id={idTranslation}
				checked={showTranslation}
				onCheckedChange={(c) => setShowTranslation(Boolean(c))}
			/>
			<Text size="1" asChild style={{ color: "var(--accent-11)" }}>
				<label htmlFor={idRomanization}>
					{t("ribbonBar.editMode.showRomanization", "Show Romanization Line")}
				</label>
			</Text>
			<Checkbox
				id={idRomanization}
				checked={showRomanization}
				onCheckedChange={(c) => setShowRomanization(Boolean(c))}
			/>
			<Text size="1" asChild style={{ color: "var(--accent-11)" }}>
				<label htmlFor={idPerWord}>
					{t("ribbonBar.editMode.showWordRomanizationInput", "Show Per-Word Romanization")}
				</label>
			</Text>
			<Checkbox
				id={idPerWord}
				checked={showWordRomanizationInput}
				onCheckedChange={(c) => setShowWordRomanizationInput(Boolean(c))}
			/>
		</Grid>
	);
};

const PhoneticSection = ({ isSidebar }: { isSidebar?: boolean }) => {
	const { t } = useTranslation();
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const selectedWords = useAtomValue(selectedWordsAtom);
	const store = useStore();
	const [loading, setLoading] = useState(false);
	const [lang, setLang] = useState<"auto" | "ja" | "zh" | "ko" | "yue">("auto");


	const handleAutoFetch = useCallback(async () => {
		setLoading(true);
		try {
			const { lyricLines: originalLines } = store.get(lyricLinesAtom);
			
			if (selectedLines.size === 0 && selectedWords.size === 0) {
				toast.info(t("ribbonBar.editMode.phonetic.noSelection", "Please select lines or words first"));
				return;
			}

			const lineUpdates: Record<string, string> = {};
			const wordUpdates: Record<string, string> = {};

			if (selectedWords.size > 0) {
				const targetLines = originalLines.filter((line) =>
					line.words.some((word) => selectedWords.has(word.id)),
				);
				for (const line of targetLines) {
					// Pass word arrays directly to ensure capsule-aware mapping
					const capsuleTexts = line.words.map(w => w.word);
					if (capsuleTexts.join("").trim().length === 0) continue;
					
					// Get line-level phonetic data
					const lineSyllables = await getPhoneticSyllables(capsuleTexts, lang);

					for (let i = 0; i < line.words.length; i++) {
						const word = line.words[i];
						if (selectedWords.has(word.id)) {
							wordUpdates[word.id] = lineSyllables[i] ?? "";
						}
					}
				}
			} else {
				const targetLines = originalLines.filter((l) => selectedLines.has(l.id));
				for (const line of targetLines) {
					// Join for the line summary, but process capsules for word updates
					const capsuleTexts = line.words.map(w => w.word);
					if (line.words.length > 0) {
						// Distribute using capsule-aware mapping
						const syllables = await getPhoneticSyllables(capsuleTexts, lang);
						lineUpdates[line.id] = buildLineRomanization(
							capsuleTexts,
							syllables,
						);
						for (let i = 0; i < line.words.length; i++) {
							wordUpdates[line.words[i].id] = syllables[i] ?? "";
						}
					}
				}
			}

			editLyricLines((draft) => {
				for (const line of draft.lyricLines) {
					if (lineUpdates[line.id] !== undefined) {
						line.romanLyric = lineUpdates[line.id];
					}
					for (const word of line.words) {
						if (wordUpdates[word.id] !== undefined) {
							word.romanWord = wordUpdates[word.id];
						}
					}
				}
			});
			toast.success(t("ribbonBar.editMode.phonetic.success", "Phonetics fetched successfully"));
		} catch (e) {
			console.error(e);
			toast.error(t("ribbonBar.editMode.phonetic.error", "Failed to fetch phonetics"));
		} finally {
			setLoading(false);
		}
	}, [editLyricLines, selectedLines, selectedWords, store, t, lang]);

	const displayRomanization = useAtomValue(displayRomanizationInSyncAtom);

	return (
		<RibbonSection
			isSidebar={isSidebar}
			label={
				<Flex gap="1" align="center">
					{t("ribbonBar.editMode.romanization.section", "Romanization")}
					<Popover.Root>
						<Popover.Trigger>
							<IconButton size="1" variant="ghost" style={{ cursor: "pointer" }}>
								<QuestionCircle16Regular />
							</IconButton>
						</Popover.Trigger>
						<Popover.Content size="1" style={{ width: 300 }}>
							<Flex direction="column" gap="2">
								<Text size="2" weight="bold">{t("ribbonBar.editMode.romanization.info.title", "About Romanization")}</Text>
								<Text size="1">
									{t("ribbonBar.editMode.romanization.info.canDo", "✓ Can do: Auto-generate Romaji (JA), Pinyin (ZH), and Romaji (KO). Supports Kanji!")}
								</Text>
								<Text size="1">
									{t("ribbonBar.editMode.romanization.info.cannotDo", "✗ Cannot do: 100% accuracy for rare Kanji or proper names. CJK only. Minor errors may occur.")}
								</Text>
							</Flex>
						</Popover.Content>
					</Popover.Root>
				</Flex>
			}
		>
			<Grid columns="2" gap="2" align="center">
				<Select.Root value={lang} onValueChange={(v) => setLang(v as typeof lang)} size="1">
					<Select.Trigger />
					<Select.Content>
						<Select.Item value="auto">{t("common.autoDetect", "Auto Detect")}</Select.Item>
						<Select.Item value="ja">{t("ribbonBar.editMode.romanization.ja", "Japanese (Romaji)")}</Select.Item>
						<Select.Item value="zh">{t("ribbonBar.editMode.romanization.zh", "Chinese (Pinyin)")}</Select.Item>
						<Select.Item value="yue">{t("ribbonBar.editMode.romanization.yue", "Cantonese (Jyutping)")}</Select.Item>
						<Select.Item value="ko">{t("ribbonBar.editMode.romanization.ko", "Korean (Romaji)")}</Select.Item>
					</Select.Content>
				</Select.Root>
				<Button size="1" variant="soft" onClick={handleAutoFetch} disabled={loading}>
					{loading ? <Spinner size="1" /> : t("ribbonBar.editMode.romanization.autoFetch", "Romanize")}
				</Button>
				<Flex gap="2" align="center" style={{ gridColumn: "span 2", justifyContent: "center" }}>
					<Text size="1" color="gray">{t("settings.common.enabled", "Enabled")}</Text>
					<Switch 
						size="1" 
						checked={displayRomanization} 
						onCheckedChange={(checked) => store.set(displayRomanizationInSyncAtom, checked)} 
					/>
				</Flex>
			</Grid>
		</RibbonSection>
	);
};

const VOCAL_ROLE_MAP: Record<string, { label: string; defaultPlaceholder: string }> = {
	v1: { label: "v1 Lead (Principal)", defaultPlaceholder: "Lead" },
	v2: { label: "v2 Duet", defaultPlaceholder: "Duet" },
	v3: { label: "v3 Middle", defaultPlaceholder: "Middle" },
	v4: { label: "v4 Harmony", defaultPlaceholder: "Harmony" },
};

const VocalRolesSection: FC<{ isSidebar?: boolean }> = ({ isSidebar }) => {
	const { t } = useTranslation();
	const vocalistNames = useAtomValue(vocalistNamesAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	if (selectedLines.size === 0) return null;

	// Resolve the vocalist IDs used by the currently selected lines
	const selectedVocalistIds = new Set<string>();
	for (const line of lyricLines.lyricLines) {
		if (selectedLines.has(line.id)) {
			const id = line.isDuetGroup
				? "v4"
				: line.isDuet
					? "v2"
					: line.isMiddle
						? "v3"
						: "v1";
			selectedVocalistIds.add(id);
		}
	}

	if (selectedVocalistIds.size === 0) return null;

	return (
		<RibbonSection
			isSidebar={isSidebar}
			label={t("ribbonBar.editMode.vocalist", "Vocalist")}
		>
			<Grid columns="max-content 1fr" gap="2" gapY="1" align="center">
				{Array.from(selectedVocalistIds).map((id) => {
					const meta = VOCAL_ROLE_MAP[id] || {
						label: `${id} Vocalist`,
						defaultPlaceholder: id,
					};
					return (
						<React.Fragment key={id}>
							<Text size="1" color="gray" weight="medium">
								{meta.label}:
							</Text>
							<TextField.Root
								size="1"
								value={vocalistNames[id] ?? ""}
								placeholder={meta.defaultPlaceholder}
								style={{ width: "12em" }}
								onChange={(e) => {
									const val = e.target.value;
									editLyricLines((draft) => {
										if (!draft.vocalistNames) draft.vocalistNames = {};
										if (val.trim()) {
											draft.vocalistNames[id] = val;
										} else {
											delete draft.vocalistNames[id];
										}
									});
								}}
							/>
						</React.Fragment>
					);
				})}
			</Grid>
		</RibbonSection>
	);
};

export const EditModeRibbonBar: FC<{ isSidebar?: boolean }> = forwardRef<HTMLDivElement, { isSidebar?: boolean }>(
	({ isSidebar }, ref) => {
		const editLyricLines = useSetImmerAtom(lyricLinesAtom);
		const { t } = useTranslation();
		const selectedLines = useAtomValue(selectedLinesAtom);
		const selectedWords = useAtomValue(selectedWordsAtom);
		const [showAdvanced, setShowAdvanced] = useAtom(advancedRibbonControlsAtom);
		const activeFileKind = useAtomValue(activeFileKindAtom);
		const isLyricsfile = activeFileKind === ActiveFileKind.Lyricsfile;

		return (
			<RibbonFrame
				ref={ref}
				isSidebar={isSidebar}
				reserveControlRows={3}
			>
				<RibbonSection label={t("ribbonBar.editMode.new", "New")} isSidebar={isSidebar}>
					<Grid columns="1" gap="1" gapY="1" flexGrow="1" align="center">
						<Button
							size="1"
							variant="soft"
							onClick={() =>
								editLyricLines((draft) => {
									draft.lyricLines.push(newLyricLine());
								})
							}
						>
							{t("ribbonBar.editMode.lyricLine", "Lyric Line")}
						</Button>
					</Grid>
				</RibbonSection>
				{selectedLines.size > 0 && <RibbonSection isSidebar={isSidebar} label={t("ribbonBar.editMode.lineTiming", "Line Timing")}>
					<Grid columns="max-content 1fr" gap="2" gapY="1" flexGrow="1" align="center">
						<EditField
							label={t("ribbonBar.editMode.startTime", "Start Time")}
							fieldName="startTime"
							parser={parseTimespan}
							formatter={msToTimestamp}
						/>
						<EditField
							label={t("ribbonBar.editMode.endTime", "End Time")}
							fieldName="endTime"
							parser={parseTimespan}
							formatter={msToTimestamp}
						/>
					</Grid>
				</RibbonSection>}
				{selectedLines.size > 0 && <RibbonSection isSidebar={isSidebar} label={t("ribbonBar.editMode.lineProperties", "Line Properties")}>
					<Grid columns="max-content max-content" gap="4" gapY="1" flexGrow="1" align="center">
						<CheckboxField
							label={t("ribbonBar.editMode.bgLyric", "Background Vocal")}
							defaultValue={false}
							isWordField={false}
							fieldName="isBG"
						/>
						<CheckboxField
							label={t("ribbonBar.editMode.duetLyric", "Duet Vocal")}
							isWordField={false}
							fieldName="isDuet"
							defaultValue={false}
							exclusiveWith={["isMiddle", "isDuetGroup"]}
						/>
						<CheckboxField
							label={t(
								"ribbonBar.editMode.duetGroupLyric",
								"Duet (harmony, sung together)",
							)}
							isWordField={false}
							fieldName="isDuetGroup"
							defaultValue={false}
							exclusiveWith={["isDuet", "isMiddle"]}
						/>
						<CheckboxField
							label={t(
								"ribbonBar.editMode.middleLyric",
								"Third voice (middle)",
							)}
							isWordField={false}
							fieldName="isMiddle"
							defaultValue={false}
							exclusiveWith={["isDuet", "isDuetGroup"]}
						/>
						<CheckboxField
							label={t("ribbonBar.editMode.ignoreSync", "Ignore Sync")}
							isWordField={false}
							fieldName="ignoreSync"
							defaultValue={false}
						/>
						<ReverseSyncCheckbox />
					</Grid>
				</RibbonSection>}
				{showAdvanced && (selectedLines.size > 0 || selectedWords.size > 0) && <PhoneticSection isSidebar={isSidebar} />}
				{selectedWords.size > 0 && <RibbonSection isSidebar={isSidebar} label={t("ribbonBar.editMode.wordTiming", "Word Timing")}>
					<Grid columns="max-content 1fr" gap="2" gapY="1" flexGrow="1" align="center">
						<EditField
							label={t("ribbonBar.editMode.startTime", "Start Time")}
							fieldName="startTime"
							isWordField
							parser={parseTimespan}
							formatter={msToTimestamp}
						/>
						<EditField
							label={t("ribbonBar.editMode.endTime", "End Time")}
							fieldName="endTime"
							isWordField
							parser={parseTimespan}
							formatter={msToTimestamp}
						/>
						<EditField
							label={t("ribbonBar.editMode.emptyBeatCount", "Empty Beat Count")}
							fieldName="emptyBeat"
							isWordField
							parser={(v) => {
								const parsed = Number.parseInt(v, 10);
								return Number.isNaN(parsed) ? 0 : parsed;
							}}
							formatter={String}
						/>
					</Grid>
				</RibbonSection>}
				{selectedWords.size > 0 && <RibbonSection
					isSidebar={isSidebar}
					label={t("ribbonBar.editMode.wordProperties", "Word Properties")}
				>
					<Grid columns="max-content 1fr" gap="2" gapY="1" flexGrow="1" align="center">
						<EditField
							label={t("ribbonBar.editMode.wordContent", "Word Content")}
							fieldName="word"
							isWordField
							parser={(v) => v}
							formatter={(v) => v}
						/>
						<EditField
							label={t("ribbonBar.editMode.romanWord", "Word Romanization")}
							fieldName="romanWord"
							isWordField
							parser={(v) => v}
							formatter={(v) => v || ""}
						/>
						<CheckboxField
							label={t("ribbonBar.editMode.obscene", "Obscene")}
							isWordField
							fieldName="obscene"
							defaultValue={false}
						/>
					</Grid>
				</RibbonSection>}
				{showAdvanced && selectedLines.size > 0 && <RibbonSection
					isSidebar={isSidebar}
					label={t("ribbonBar.editMode.secondaryContent", "Secondary Content")}
				>
					<Grid columns="max-content 1fr" gap="2" gapY="1" flexGrow="1" align="center">
						<EditField
							label={t("ribbonBar.editMode.translatedLyric", "Translation")}
							fieldName="translatedLyric"
							parser={(v) => v}
							formatter={(v) => v}
							textFieldStyle={{ width: "15em" }}
						/>
						<EditField
							label={t("ribbonBar.editMode.romanLyric", "Romanization")}
							fieldName="romanLyric"
							parser={(v) => v}
							formatter={(v) => v}
							textFieldStyle={{ width: "15em" }}
						/>
					</Grid>
				</RibbonSection>}
				{(isLyricsfile || showAdvanced) && (
					<VocalRolesSection isSidebar={isSidebar} />
				)}
				{showAdvanced && <RibbonSection label={t("ribbonBar.editMode.layoutMode", "Layout")} isSidebar={isSidebar}>
					<EditModeField
						simpleModeLabel={t(
							"settings.common.layoutModeOptions.simple",
							"Simple Mode",
						)}
						advanceModeLabel={t(
							"settings.common.layoutModeOptions.advance",
							"Advanced Mode",
						)}
					/>
				</RibbonSection>}
				{showAdvanced && <RibbonSection
					label={t("ribbonBar.editMode.auxiliaryLineDisplay", "Auxiliary Line Display")}
					isSidebar={isSidebar}
				>
					<AuxiliaryDisplayField />
				</RibbonSection>}
				{showAdvanced && <RibbonSection label={t("ribbonBar.editMode.tools", "Check")} isSidebar={isSidebar}>
					<Flex gap="2" direction="column">
						<GrammarCheckButton />
					</Flex>
				</RibbonSection>}
				<RibbonSection label={t("ribbonBar.advanced", "Advanced")} isSidebar={isSidebar}>
					<Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
				</RibbonSection>
			</RibbonFrame>
		);
	},
);

export default EditModeRibbonBar;
