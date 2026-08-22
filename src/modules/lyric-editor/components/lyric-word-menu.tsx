import { ContextMenu } from "@radix-ui/themes";
import { type Atom, atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	combineWordsDialogAtom,
	replaceRomanizationDialogAtom,
	replaceWordDialogAtom,
	splitWordDialogAtom,
} from "$/states/dialogs";
import {
	editingWordStateAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
} from "$/types/ttml";
import { getPhoneticSyllables } from "$/utils/phonetic";
import {
	combineWordsApplyToAllAtom,
	combineWordsIgnoreCaseAtom,
} from "../tools/combine-words-options";
import {
	combineMatchingWordSequences,
	combineSelectedWords,
	getCombineWordSelection,
} from "../utils/combine-words";
import { normalizeLineTime } from "../utils/normalize-line-time";

const selectedLinesSizeAtom = atom((get) => get(selectedLinesAtom).size);
const selectedWordsSizeAtom = atom((get) => get(selectedWordsAtom).size);

export const LyricWordMenu = ({
	wordIndex,
	wordAtom,
	lineIndex,
}: {
	wordIndex: number;
	wordAtom: Atom<LyricWord>;
	lineIndex: number;
}) => {
	const { t } = useTranslation();

	const store = useStore();
	const selectedWordsSize = useAtomValue(selectedWordsSizeAtom);
	const selectedLinesSize = useAtomValue(selectedLinesSizeAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setOpenSplitWordDialog = useSetAtom(splitWordDialogAtom);
	const setOpenReplaceWordDialog = useSetAtom(replaceWordDialogAtom);
	const setReplaceRomanizationDialog = useSetAtom(
		replaceRomanizationDialogAtom,
	);
	const setCombineWordsDialog = useSetAtom(combineWordsDialogAtom);
	const setEditingWordState = useSetAtom(editingWordStateAtom);
	const word = useAtomValue(wordAtom);
	const combineApplyToAll = useAtomValue(combineWordsApplyToAllAtom);
	const combineIgnoreCase = useAtomValue(combineWordsIgnoreCaseAtom);
	const combineShiftClickRef = useRef(false);

	return (
		<>
			<ContextMenu.Item
				disabled={selectedWordsSize !== 1}
				onSelect={() => {
					setEditingWordState({
						wordIndex,
						lineIndex,
						word: word.word,
					});
					setOpenSplitWordDialog(true);
				}}
			>
				{t("contextMenu.splitWord", "Split word…")}
			</ContextMenu.Item>
			{/[\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u4E00-\u9FA5]/.test(
				word.word,
			) && (
				<ContextMenu.Item
					disabled={selectedWordsSize !== 1 || word.word.length <= 1}
					onSelect={async () => {
						try {
							const allLines = store.get(lyricLinesAtom).lyricLines;
							const fullProjectText = allLines
								.map((l) => l.words.map((w) => w.word).join(""))
								.join("");
							let projectLangPriority: "ja" | "zh" | "ko" | "auto" = "auto";

							if (/[\u3040-\u309F\u30A0-\u30FF]/.test(fullProjectText))
								projectLangPriority = "ja";
							else if (/[\uAC00-\uD7AF]/.test(fullProjectText))
								projectLangPriority = "ko";
							else if (/[\u4E00-\u9FA5]/.test(fullProjectText))
								projectLangPriority = "zh";

							const syllables = await getPhoneticSyllables(
								word.word,
								projectLangPriority,
							);
							if (syllables.length <= 1) {
								toast.info(
									t(
										"contextMenu.noSyllablesFound",
										"No multiple syllables found.",
									),
								);
								return;
							}

							editLyricLines((state) => {
								const line = state.lyricLines[lineIndex];
								if (!line) return;

								const targetWordIndex = line.words.findIndex(
									(w) => w.id === word.id,
								);
								if (targetWordIndex === -1) return;

								const originalWord = line.words[targetWordIndex];
								const duration = originalWord.endTime - originalWord.startTime;
								const syllDuration = Math.floor(duration / syllables.length);

								const wordChars = Array.from(originalWord.word);
								const newWords: LyricWord[] = wordChars.map((char, i) => {
									const nw = newLyricWord();
									nw.word = char;
									nw.romanWord = syllables[i] ?? "";
									nw.startTime = originalWord.startTime + i * syllDuration;
									nw.endTime =
										i === wordChars.length - 1
											? originalWord.endTime
											: originalWord.startTime + (i + 1) * syllDuration;
									return nw;
								});

								line.words.splice(targetWordIndex, 1, ...newWords);
							});
						} catch (e) {
							console.error("Failed to split syllables", e);
							toast.error(t("common.error", "An error occurred"));
						}
					}}
				>
					{t(
						"contextMenu.splitIntoSyllables",
						"Split into Syllables (Romanized)",
					)}
				</ContextMenu.Item>
			)}
			<ContextMenu.Item
				disabled={selectedWordsSize !== 1}
				onSelect={() => {
					setEditingWordState({
						wordIndex,
						lineIndex,
						word: word.word,
					});
					setOpenReplaceWordDialog(true);
				}}
			>
				{t("contextMenu.replaceWord", "Replace word…")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={selectedWordsSize !== 1}
				onSelect={() => {
					setReplaceRomanizationDialog({
						open: true,
						lineIndex,
						wordIndex,
					});
				}}
			>
				{t("contextMenu.replaceRomanization", "Replace Romanization…")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!(selectedWordsSize > 1 && selectedLinesSize === 1)}
				onPointerDown={(event) => {
					combineShiftClickRef.current = event.shiftKey;
				}}
				onPointerCancel={() => {
					combineShiftClickRef.current = false;
				}}
				onSelect={() => {
					const combineImmediately = combineShiftClickRef.current;
					combineShiftClickRef.current = false;
					if (combineImmediately) {
						editLyricLines((state) => {
							const sourceLine = state.lyricLines[lineIndex];
							if (!sourceLine) return;

							const selectedWordIds = store.get(selectedWordsAtom);
							const selection = getCombineWordSelection(
								sourceLine.words,
								selectedWordIds,
							);
							if (!selection) return;

							if (combineApplyToAll && selection.isContiguous) {
								for (const line of state.lyricLines) {
									line.words = combineMatchingWordSequences(
										line.words,
										selection.words,
										combineIgnoreCase,
									);
								}
							} else {
								sourceLine.words = combineSelectedWords(
									sourceLine.words,
									selectedWordIds,
								);
							}
						});
						return;
					}
					setCombineWordsDialog({ open: true, lineIndex });
				}}
			>
				{t("contextMenu.combineWords", "Combine words")}
				<span style={{ marginLeft: "auto", color: "var(--gray-9)" }}>
					Shift+click
				</span>
			</ContextMenu.Item>

			<ContextMenu.Item
				disabled={selectedWordsSize === 0}
				onSelect={() => {
					editLyricLines((state) => {
						const selectedWords = store.get(selectedWordsAtom);
						for (const line of state.lyricLines) {
							const originalLength = line.words.length;
							const filteredWords = line.words.filter(
								(w) => !selectedWords.has(w.id),
							);
							line.words = filteredWords;
							if (originalLength !== filteredWords.length)
								normalizeLineTime(line);
						}
					});
				}}
			>
				{t("contextMenu.deleteWords", {
					count: selectedWordsSize,
					defaultValue: "Delete {count} word(s)",
				})}
			</ContextMenu.Item>

			<ContextMenu.Separator />

			<ContextMenu.Item
				disabled={selectedWordsSize !== 1}
				onSelect={() => afterToNewLine()}
			>
				{t(
					"contextMenu.moveFollowingWordToNewLine",
					"Move followings to new line",
				)}
			</ContextMenu.Item>

			<ContextMenu.Item
				disabled={selectedWordsSize === 0}
				onSelect={() => selectedToNewLine()}
			>
				{t("contextMenu.moveWordToNewLine", {
					count: selectedWordsSize,
					defaultValue: "Move {count} word(s) to new line",
				})}
			</ContextMenu.Item>

			<ContextMenu.Separator />
		</>
	);

	function selectedToNewLine() {
		editLyricLines((state) => {
			const selectedWordIds = store.get(selectedWordsAtom);
			const selectedWords: LyricWord[] = [];
			const affectedLines: LyricLine[] = [];
			for (const line of state.lyricLines) {
				const deletedAtBounds =
					line.words.length > 0 &&
					(selectedWordIds.has(line.words[0].id) ||
						selectedWordIds.has(line.words[line.words.length - 1].id));
				line.words = line.words.filter((w) => {
					if (selectedWordIds.has(w.id)) {
						selectedWords.push(w);
						affectedLines.push(line);
						return false;
					}
					return true;
				});
				if (deletedAtBounds) normalizeLineTime(line);
			}
			const newLine = {
				...newLyricLine(),
				isBG: state.lyricLines[lineIndex].isBG,
				isDuet: state.lyricLines[lineIndex].isDuet,
			} as LyricLine;
			newLine.words.push(...selectedWords);
			normalizeLineTime(newLine);
			state.lyricLines.splice(lineIndex + 1, 0, newLine);
		});
	}

	function afterToNewLine() {
		editLyricLines((state) => {
			const line = state.lyricLines[lineIndex];
			if (!line) return;
			const word = line.words[wordIndex];
			if (!word) return;
			if (/^\s*$/.test(word.word) && !word.startTime && !word.endTime)
				line.words.splice(wordIndex, 1);
			const wordsToMove = line.words.splice(wordIndex);
			const newLine = {
				...newLyricLine(),
				isBG: line.isBG,
				isDuet: line.isDuet,
			} as LyricLine;
			newLine.words.push(...wordsToMove);
			normalizeLineTime(line);
			normalizeLineTime(newLine);
			state.lyricLines.splice(lineIndex + 1, 0, newLine);
		});
	}
};
