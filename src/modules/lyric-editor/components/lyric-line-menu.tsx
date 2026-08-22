import { ContextMenu } from "@radix-ui/themes";
import { atom, useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
	globalEnableInsertAtom,
	timingCopyPlacementAtom,
} from "$/modules/lyric-editor/components/lyric-line-view-states";
import {
	reverseSyncLineIdsAtom,
	reverseSyncTimingBackupAtom,
} from "$/modules/settings/states/sync";
import {
	spectrogramSplitModeAtom,
	spectrogramTopTrackLinesAtom,
} from "$/modules/spectrogram/states";
import {
	ActiveFileKind,
	activeFileKindAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	vocalistNamesAtom,
} from "$/states/main";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import {
	createLineTimingSnapshots,
	type LineTimingSnapshot,
	restoreLineTimingSnapshots,
} from "../utils/line-timing";

const selectedLinesSizeAtom = atom((get) => get(selectedLinesAtom).size);

export const LyricLineMenu = ({ lineIndex }: { lineIndex: number }) => {
	const { t } = useTranslation();
	const setGlobalEnableInsert = useSetAtom(globalEnableInsertAtom);
	const setTimingCopyPlacement = useSetAtom(timingCopyPlacementAtom);

	const selectedLinesSize = useAtomValue(selectedLinesSizeAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const activeFileKind = useAtomValue(activeFileKindAtom);
	const isLyricsfile = activeFileKind === ActiveFileKind.Lyricsfile;
	const [reverseSyncLineIds, setReverseSyncLineIds] = useAtom(
		reverseSyncLineIdsAtom,
	);
	const setReverseSyncTimingBackup = useSetAtom(reverseSyncTimingBackupAtom);
	const [splitMode, setSplitMode] = useAtom(spectrogramSplitModeAtom);
	const [topTrackLines, setTopTrackLines] = useAtom(
		spectrogramTopTrackLinesAtom,
	);

	const store = useStore();

	const lineObjs = useAtomValue(lyricLinesAtom);
	const currentLine = lineObjs.lyricLines[lineIndex];
	const reverseSyncChecked = currentLine
		? reverseSyncLineIds.has(currentLine.id)
		: false;

	function reverseSyncOnCheck(checked: boolean) {
		if (!currentLine) return;
		const lineId = currentLine.id;
		if (checked) {
			const lyrics = store.get(lyricLinesAtom).lyricLines;
			const snapshots = createLineTimingSnapshots(lyrics, new Set([lineId]));
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
			const snapshot = backup.get(lineId);
			if (snapshot) {
				editLyricLines((state) => {
					restoreLineTimingSnapshots(state.lyricLines, [
						snapshot,
					] satisfies LineTimingSnapshot[]);
				});
			}
			setReverseSyncTimingBackup((prev) => {
				const nextMap = new Map(prev);
				nextMap.delete(lineId);
				return nextMap;
			});
		}
		setReverseSyncLineIds((prev: Set<string>): Set<string> => {
			const next = new Set(prev);
			if (checked) next.add(lineId);
			else next.delete(lineId);
			return next;
		});
	}
	const selectedLineObjs = lineObjs.lyricLines.filter((line) =>
		selectedLines.has(line.id),
	);
	const [Bgchecked, setBgChecked] = React.useState(() => {
		if (selectedLineObjs.every((line) => line.isBG)) return true;
		else if (selectedLineObjs.every((line) => !line.isBG)) return false;
		else return "indeterminate" as const;
	});
	const [DuetChecked, setDuetChecked] = React.useState(() => {
		if (selectedLineObjs.every((line) => line.isDuet)) return true;
		else if (selectedLineObjs.every((line) => !line.isDuet)) return false;
		else return "indeterminate" as const;
	});
	const [MiddleChecked, setMiddleChecked] = React.useState(() => {
		if (selectedLineObjs.every((line) => line.isMiddle)) return true;
		else if (selectedLineObjs.every((line) => !line.isMiddle)) return false;
		else return "indeterminate" as const;
	});
	const [DuetGroupChecked, setDuetGroupChecked] = React.useState(() => {
		if (selectedLineObjs.every((line) => line.isDuetGroup)) return true;
		else if (selectedLineObjs.every((line) => !line.isDuetGroup)) return false;
		else return "indeterminate" as const;
	});
	const combineEnabled = (() => {
		if (selectedLinesSize < 2) return null;
		const lineIdxs = lineObjs.lyricLines
			.filter((line) => selectedLines.has(line.id))
			.map((line) => lineObjs.lyricLines.indexOf(line));
		const minIdx = Math.min(...lineIdxs);
		const maxIdx = Math.max(...lineIdxs);
		if (lineIdxs.length !== maxIdx - minIdx + 1) return null;
		for (let i = minIdx; i <= maxIdx; i++)
			if (!lineIdxs.includes(i)) return null;
		return { minIdx, maxIdx };
	})();

	function bgOnCheck(checked: boolean) {
		setBgChecked(checked);
		editLyricLines((state) => {
			const lines = state.lyricLines.filter((line) =>
				selectedLines.has(line.id),
			);
			for (const line of lines) line.isBG = checked;
		});
	}
	function duetOnCheck(checked: boolean) {
		setDuetChecked(checked);
		editLyricLines((state) => {
			const lines = state.lyricLines.filter((line) =>
				selectedLines.has(line.id),
			);
			for (const line of lines) {
				line.isDuet = checked;
				if (checked) {
					line.isMiddle = false;
					line.isDuetGroup = false;
				}
			}
		});
		if (checked) {
			setMiddleChecked(false);
			setDuetGroupChecked(false);
		}
	}
	function middleOnCheck(checked: boolean) {
		setMiddleChecked(checked);
		editLyricLines((state) => {
			const lines = state.lyricLines.filter((line) =>
				selectedLines.has(line.id),
			);
			for (const line of lines) {
				line.isMiddle = checked;
				if (checked) {
					line.isDuet = false;
					line.isDuetGroup = false;
				}
			}
		});
		if (checked) {
			setDuetChecked(false);
			setDuetGroupChecked(false);
		}
	}
	function duetGroupOnCheck(checked: boolean) {
		setDuetGroupChecked(checked);
		editLyricLines((state) => {
			const lines = state.lyricLines.filter((line) =>
				selectedLines.has(line.id),
			);
			for (const line of lines) {
				line.isDuetGroup = checked;
				if (checked) {
					line.isDuet = false;
					line.isMiddle = false;
				}
			}
		});
		if (checked) {
			setDuetChecked(false);
			setMiddleChecked(false);
		}
	}

	const vocalistNames = useAtomValue(vocalistNamesAtom);
	// Every line has a vocalist, even a plain lead line with none of the
	// duet/middle/group flags set (implicit "v1", the same id the
	// lyricsfile writer/parser use for it) - renaming was previously only
	// exposed for v2/v3/v4 lines, so a normal song with a single vocalist
	// had no way to rename them at all.
	const currentLineVocalistId = currentLine
		? currentLine.isDuetGroup
			? "v4"
			: currentLine.isDuet
				? "v2"
				: currentLine.isMiddle
					? "v3"
					: "v1"
		: undefined;

	const VOCALIST_ROLE_LABELS: Record<string, string> = {
		v1: "v1-lead (Principal)",
		v2: "v2-duet (Duet)",
		v3: "v3-middle (Middle)",
		v4: "v4-harmony (Harmony)",
	};

	function renameVocalist() {
		if (!currentLineVocalistId) return;
		const roleLabel =
			VOCALIST_ROLE_LABELS[currentLineVocalistId] || currentLineVocalistId;
		const currentName = vocalistNames[currentLineVocalistId] ?? "";
		const nextName = window.prompt(
			t("contextMenu.renameVocalistPrompt", "Rename vocalist for {{role}}:", {
				role: roleLabel,
			}),
			currentName,
		);
		if (nextName === null) return;
		const trimmed = nextName.trim();
		editLyricLines((state) => {
			if (!state.vocalistNames) state.vocalistNames = {};
			if (trimmed) {
				state.vocalistNames[currentLineVocalistId] = trimmed;
			} else {
				delete state.vocalistNames[currentLineVocalistId];
			}
		});
	}

	const vocalistItemLabel = currentLineVocalistId
		? `${VOCALIST_ROLE_LABELS[currentLineVocalistId] || currentLineVocalistId}: ${vocalistNames[currentLineVocalistId] || t("lyricLineView.empty", "None")}`
		: "";

	return (
		<>
			<ContextMenu.CheckboxItem checked={Bgchecked} onCheckedChange={bgOnCheck}>
				{t("contextMenu.bgLyric", "Background line")}
			</ContextMenu.CheckboxItem>
			<ContextMenu.CheckboxItem
				checked={DuetChecked}
				onCheckedChange={duetOnCheck}
			>
				{t("contextMenu.duetLyric", "Duet line")}
			</ContextMenu.CheckboxItem>
			<ContextMenu.CheckboxItem
				checked={DuetGroupChecked}
				onCheckedChange={duetGroupOnCheck}
			>
				{t("contextMenu.duetGroupLyric", "Duet line (harmony, sung together)")}
			</ContextMenu.CheckboxItem>
			<ContextMenu.CheckboxItem
				checked={MiddleChecked}
				onCheckedChange={middleOnCheck}
			>
				{t("contextMenu.middleLyric", "Third voice (middle) line")}
			</ContextMenu.CheckboxItem>
			{isLyricsfile && currentLineVocalistId && (
				<ContextMenu.Item onSelect={renameVocalist}>
					{t("contextMenu.renameVocalist", "Rename vocalist...")}
					{vocalistItemLabel ? ` (${vocalistItemLabel})` : ""}
				</ContextMenu.Item>
			)}
			<ContextMenu.CheckboxItem
				checked={reverseSyncChecked}
				onCheckedChange={reverseSyncOnCheck}
			>
				{t("contextMenu.reverseSyncOrder", "Reverse sync order")}
			</ContextMenu.CheckboxItem>

			<ContextMenu.Separator />
			<ContextMenu.CheckboxItem
				checked={splitMode}
				onCheckedChange={setSplitMode}
			>
				{t("contextMenu.splitSpectrogram", "Split Spectrogram")}
			</ContextMenu.CheckboxItem>
			{splitMode && (
				<ContextMenu.CheckboxItem
					checked={currentLine ? topTrackLines.has(currentLine.id) : false}
					onCheckedChange={(checked) => {
						if (!currentLine) return;
						const next = new Set(topTrackLines);
						const linesToToggle = selectedLines.has(currentLine.id)
							? selectedLines
							: new Set([currentLine.id]);

						for (const id of linesToToggle) {
							if (checked) next.add(id);
							else next.delete(id);
						}
						setTopTrackLines(next);
					}}
				>
					{t("contextMenu.moveToTopTrack", "Show on Top Track")}
				</ContextMenu.CheckboxItem>
			)}

			<ContextMenu.Separator />
			<ContextMenu.Item
				onSelect={() => {
					editLyricLines((state) => {
						state.lyricLines.splice(lineIndex, 0, newLyricLine());
					});
				}}
			>
				{t("contextMenu.insertLineBefore", "Insert new line before")}
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={() => {
					editLyricLines((state) => {
						state.lyricLines.splice(lineIndex + 1, 0, newLyricLine());
					});
				}}
			>
				{t("contextMenu.insertLineAfter", "Insert new line after")}
			</ContextMenu.Item>
			<ContextMenu.Item onSelect={copyLines} disabled={selectedLinesSize === 0}>
				{t("contextMenu.copyLine", {
					count: selectedLinesSize,
					defaultValue: "Duplicate line",
				})}
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={() => {
					setTimingCopyPlacement(null);
					setGlobalEnableInsert(true);
				}}
				disabled={selectedLinesSize === 0}
			>
				{t("contextMenu.duplicateTo", "Duplicate to...")}
			</ContextMenu.Item>
			<ContextMenu.Item onSelect={combineLines} disabled={!combineEnabled}>
				{t("contextMenu.combineLine", "Combine lines")}
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={() => {
					editLyricLines((state) => {
						if (selectedLinesSize === 0) {
							state.lyricLines.splice(lineIndex, 1);
						} else {
							state.lyricLines = state.lyricLines.filter(
								(line) => !selectedLines.has(line.id),
							);
						}
					});
				}}
			>
				{t("contextMenu.deleteLine", {
					count: selectedLinesSize,
					defaultValue: "Delete line",
				})}
			</ContextMenu.Item>
		</>
	);

	function combineLines() {
		editLyricLines((state) => {
			if (!combineEnabled) return;
			const { minIdx, maxIdx } = combineEnabled;
			const target = state.lyricLines[minIdx];
			for (let i = minIdx + 1; i <= maxIdx; i++) {
				const line = state.lyricLines[i];
				target.words.push(...line.words);
			}
			target.endTime = state.lyricLines[maxIdx].endTime;
			state.lyricLines.splice(minIdx + 1, maxIdx - minIdx);
		});
	}

	function copyLines() {
		editLyricLines((state) => {
			state.lyricLines = state.lyricLines.flatMap((line) => {
				if (!selectedLines.has(line.id)) return line;
				const newLine: LyricLine = {
					...line,
					id: newLyricLine().id,
					words: line.words.map((word) => ({
						...word,
						id: newLyricWord().id,
					})),
				};
				return [line, newLine];
			});
		});
	}
};
