import { open } from "@tauri-apps/plugin-shell";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom, withImmer } from "jotai-immer";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { uid } from "uid";
import { useFileOpener } from "$/hooks/useFileOpener.ts";
import { audioEngine } from "$/modules/audio/audio-engine";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import { getSynchronizableUnits } from "$/modules/lyric-editor/utils/lyric-states.ts";
import { validateSections } from "$/modules/lyric-editor/utils/section-system.ts";
import { exportLyricsfileText } from "$/modules/lyricsfile-processor";
import { useFolderProject } from "$/modules/project/folder-project/useFolderProject";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import {
	segmentationEngineAtom,
	segmentationSplitEnglishAtom,
} from "$/modules/segmentation/states";
import { matchesSavedSyllabificationEngine } from "$/modules/segmentation/utils/detect-syllabification-engine";
import {
	segmentLyricLines,
	segmentWord,
} from "$/modules/segmentation/utils/segmentation";
import { SYLLABIFICATION_ENGINES } from "$/modules/segmentation/utils/syllabification-engines";
import { useSegmentationConfig } from "$/modules/segmentation/utils/useSegmentationConfig";
import { allowConsecutiveBackgroundLinesAtom, lyricTextNormalizationOptionsAtom } from "$/modules/settings/states";
import {
	advancedSegmentationDialogAtom,
	autoSegmentDialogAtom,
	confirmDialogAtom,
	historyRestoreDialogAtom,
	latencyTestDialogAtom,
	learnedSplitsDialogAtom,
	lyricsfileConverterDialogAtom,
	metadataEditorDialogAtom,
	projectBrowserDialogAtom,
	projectManagerDialogAtom,
	projectsDialogAtom,
	settingsDialogAtom,
	submitToAMLLDBDialogAtom,
	timeShiftDialogAtom,
	timeStretchDialogAtom,
	ttmlChecklistDialogAtom,
	workspaceBrowserDialogAtom,
} from "$/states/dialogs.ts";
import {
	keyDeleteSelectionAtom,
	keyNewFileAtom,
	keyOpenFileAtom,
	keyRedoAtom,
	keySaveFileAtom,
	keySelectAllAtom,
	keySelectInvertedAtom,
	keySelectWordsOfMatchedSelectionAtom,
	keyUndoAtom,
} from "$/states/keybindings.ts";
import {
	ActiveFileKind,
	activeFileKindAtom,
	FILE_KIND_EXTENSIONS,
	isDirtyAtom,
	lastSavedTimeAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	redoLyricLinesAtom,
	saveFileHandlerAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	stripKnownFileExtension,
	undoableLyricLinesAtom,
	undoLyricLinesAtom,
} from "$/states/main.ts";
import { type LyricWord, type LyricWordBase, newLyricWord } from "$/types/ttml";
import { openFileWithDialog } from "$/utils/fileDialog.ts";
import { saveFile } from "$/utils/fileSystem.ts";
import { error, log } from "$/utils/logging.ts";
import { createHistoryActionGate } from "./history-action-gate";

export const useTopMenuActions = () => {
	const { t } = useTranslation();
	const [saveFileName, setSaveFileName] = useAtom(saveFileNameAtom);
	const [activeFileKind, setActiveFileKind] = useAtom(activeFileKindAtom);
	const newLyricLine = useSetAtom(newLyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setMetadataEditorOpened = useSetAtom(metadataEditorDialogAtom);
	const setSettingsDialogOpened = useSetAtom(settingsDialogAtom);
	const undoLyricLines = useAtomValue(undoableLyricLinesAtom);
	const store = useStore();
	const isDirty = useAtomValue(isDirtyAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const setHistoryRestoreDialog = useSetAtom(historyRestoreDialogAtom);
	const setAdvancedSegmentationDialog = useSetAtom(
		advancedSegmentationDialogAtom,
	);
	const setAutoSegmentDialog = useSetAtom(autoSegmentDialogAtom);
	const savedSegmentationEngine = useAtomValue(segmentationEngineAtom);
	const setSplitEnglish = useSetAtom(segmentationSplitEnglishAtom);
	const setLearnedSplitsDialog = useSetAtom(learnedSplitsDialogAtom);
	const setTimeShiftDialog = useSetAtom(timeShiftDialogAtom);
	const setTimeStretchDialog = useSetAtom(timeStretchDialogAtom);
	const setTTMLChecklistDialog = useSetAtom(ttmlChecklistDialogAtom);
	const setProjectBrowserDialog = useSetAtom(projectBrowserDialogAtom);
	const setProjectManagerDialog = useSetAtom(projectManagerDialogAtom);
	const setWorkspaceBrowserDialog = useSetAtom(workspaceBrowserDialogAtom);
	const setProjectsDialog = useSetAtom(projectsDialogAtom);
	const { saveLyricsOnly: saveFolderLyricsOnly } = useFolderProject();
	const { openFile } = useFileOpener();
	const setProjectId = useSetAtom(projectIdAtom);
	const setSaveFileHandler = useSetAtom(saveFileHandlerAtom);
	const { config: segmentationConfig } = useSegmentationConfig();
	const lyricLines = useAtomValue(lyricLinesAtom);
	const newFileKey = useAtomValue(keyNewFileAtom);
	const openFileKey = useAtomValue(keyOpenFileAtom);
	const saveFileKey = useAtomValue(keySaveFileAtom);
	const undoKey = useAtomValue(keyUndoAtom);
	const redoKey = useAtomValue(keyRedoAtom);
	const selectAllLinesKey = useAtomValue(keySelectAllAtom);
	const selectInvertedLinesKey = useAtomValue(keySelectInvertedAtom);
	const selectWordsOfMatchedSelectionKey = useAtomValue(
		keySelectWordsOfMatchedSelectionAtom,
	);
	const deleteSelectionKey = useAtomValue(keyDeleteSelectionAtom);
	const runHistoryAction = useMemo(
		() => createHistoryActionGate(requestAnimationFrame),
		[],
	);

	const buildRubySegments = useCallback(
		(text: string, baseWord: LyricWordBase) => {
			const sourceWord: LyricWord = {
				...newLyricWord(),
				word: text,
				startTime: baseWord.startTime,
				endTime: baseWord.endTime,
				emptyBeat: 0,
			};
			const segments = segmentWord(sourceWord, segmentationConfig);
			if (segments.length === 0) {
				return [
					{
						word: text,
						startTime: baseWord.startTime,
						endTime: baseWord.endTime,
					},
				];
			}
			return segments.map((segment) => ({
				word: segment.word,
				startTime: segment.startTime,
				endTime: segment.endTime,
			}));
		},
		[segmentationConfig],
	);

	const onNewFile = useCallback(() => {
		const action = () => {
			newLyricLine();
			setProjectId(uid());
			setSaveFileName("lyric.ttml");
			setActiveFileKind(ActiveFileKind.TTML);
		};

		if (isDirty) {
			setConfirmDialog({
				open: true,
				title: t("confirmDialog.newFile.title", "Confirm New File"),
				description: t(
					"confirmDialog.newFile.description",
					"You have unsaved changes. If you proceed, these changes will be lost. Are you sure you want to create a new file?",
				),
				onConfirm: action,
			});
		} else {
			action();
		}
	}, [
		isDirty,
		newLyricLine,
		setConfirmDialog,
		t,
		setProjectId,
		setSaveFileName,
		setActiveFileKind,
	]);

	const onOpenFile = useCallback(async () => {
		const file = await openFileWithDialog({
			multiple: false,
			filters: [
				{
					name: "Lyric/Audio files",
					extensions: [
						"ttml",
						"lyricsfile.yaml",
						"yaml",
						"lrc",
						"qrc",
						"eslrc",
						"lys",
						"yrc",
						"mp3",
						"flac",
						"wav",
						"ogg",
						"m4a",
						"opus",
						"webm",
					],
				},
			],
		});
		if (!file || Array.isArray(file)) return;
		openFile(file);
	}, [openFile]);

	const onOpenFileFromClipboard = useCallback(async () => {
		try {
			const ttmlText = await navigator.clipboard.readText();
			const file = new File([ttmlText], "lyric.ttml", {
				type: "application/xml",
			});
			openFile(file);
		} catch (e) {
			error("Failed to parse TTML file from clipboard", e);
		}
	}, [openFile]);

	const onSaveFile = useCallback(async (): Promise<boolean> => {
		const action = async (): Promise<boolean> => {
			try {
				const shouldFallback = await saveFolderLyricsOnly();
				if (!shouldFallback) return false;

				const currentLyrics = store.get(lyricLinesAtom);
				const sectionIssues = validateSections(currentLyrics);
				if (sectionIssues.length > 0) {
					toast.info(
						`Section review: ${sectionIssues.length} non-blocking issue${sectionIssues.length === 1 ? "" : "s"}.`,
					);
				}
				const isLyricsfile = activeFileKind === ActiveFileKind.Lyricsfile;
				const fileText = isLyricsfile
					? exportLyricsfileText(currentLyrics)
					: exportTTMLText(
							currentLyrics,
							store.get(lyricTextNormalizationOptionsAtom),
							{ allowConsecutiveBackgroundLines: store.get(allowConsecutiveBackgroundLinesAtom) },
						);
				const suggestedName = `${stripKnownFileExtension(saveFileName)}${FILE_KIND_EXTENSIONS[activeFileKind]}`;
				const savedName = await saveFile(fileText, {
					suggestedName,
					types: [
						{
							description: isLyricsfile
								? "Lyricsfile YAML Files"
								: "TTML Files",
							accept: isLyricsfile
								? {
										"application/yaml": [
											FILE_KIND_EXTENSIONS[ActiveFileKind.Lyricsfile],
										],
									}
								: {
										"application/ttml+xml": [
											FILE_KIND_EXTENSIONS[ActiveFileKind.TTML],
										],
									},
						},
					],
				});
				if (savedName) {
					setSaveFileName(savedName);
					store.set(lastSavedTimeAtom, Date.now());
					toast.success(
						t("header.status.savedAs", "Saved as {name}", { name: savedName }),
					);
					return true;
				}
				return false;
			} catch (e) {
				error("Failed to save file", e);
				toast.error(t("error.saveFileFailed", "Failed to save file"));
				return false;
			}
		};

		const lyrics = store.get(lyricLinesAtom);
		const firstUntimedLine = lyrics.lyricLines.find(
			(line) => line.endTime === 0 && getSynchronizableUnits(line).length > 0,
		);
		let untimedWord: LyricWord | undefined;
		let untimedLine: import("$/types/ttml").LyricLine | undefined;

		if (firstUntimedLine) {
			untimedLine = firstUntimedLine;
			untimedWord = getSynchronizableUnits(firstUntimedLine)[0].word;
		} else {
			untimedLine = lyrics.lyricLines.find((line) =>
				getSynchronizableUnits(line).some((u) => u.word.endTime === 0),
			);
			if (untimedLine) {
				untimedWord = getSynchronizableUnits(untimedLine).find(
					(u) => u.word.endTime === 0,
				)?.word;
			}
		}

		if (untimedLine && untimedWord) {
			const line = untimedLine;
			const word = untimedWord;
			setConfirmDialog({
				open: true,
				title: t(
					"confirmDialog.untimedLyrics.title",
					"Untimed Lyrics Detected",
				),
				description: t(
					"confirmDialog.untimedLyrics.description",
					"There is an untimed line or word in your lyrics. Would you like to fix it or export anyway?",
				),
				confirmText: t(
					"confirmDialog.untimedLyrics.exportAnyway",
					"Export Anyway",
				),
				cancelText: t("confirmDialog.untimedLyrics.fixIt", "Fix It"),
				onConfirm: action,
				onCancel: () => {
					store.set(selectedLinesAtom, new Set([line.id]));
					store.set(selectedWordsAtom, new Set([word.id]));
					audioEngine.seekMusic(line.startTime / 1000);
					store.set(currentTimeAtom, line.startTime);
				},
			});
		} else {
			return action();
		}
		return false;
	}, [
		saveFileName,
		activeFileKind,
		store,
		setSaveFileName,
		setConfirmDialog,
		t,
		saveFolderLyricsOnly,
	]);

	useEffect(() => {
		setSaveFileHandler(() => onSaveFile);
	}, [onSaveFile, setSaveFileHandler]);

	const onOpenHistoryRestore = useCallback(() => {
		setHistoryRestoreDialog(true);
	}, [setHistoryRestoreDialog]);

	const onSaveFileToClipboard = useCallback(async () => {
		const action = async () => {
			try {
				const lyric = store.get(lyricLinesAtom);
				const sectionIssues = validateSections(lyric);
				if (sectionIssues.length > 0) {
					toast.info(
						`Section review: ${sectionIssues.length} non-blocking issue${sectionIssues.length === 1 ? "" : "s"}.`,
					);
				}
				const ttml = exportTTMLText(
					lyric,
					store.get(lyricTextNormalizationOptionsAtom),
					{ allowConsecutiveBackgroundLines: store.get(allowConsecutiveBackgroundLinesAtom) },
				);
				await navigator.clipboard.writeText(ttml);
			} catch (e) {
				error("Failed to save TTML file into clipboard", e);
			}
		};

		const lyrics = store.get(lyricLinesAtom);
		const firstUntimedLine = lyrics.lyricLines.find(
			(line) => line.endTime === 0 && getSynchronizableUnits(line).length > 0,
		);
		let untimedWord: LyricWord | undefined;
		let untimedLine: import("$/types/ttml").LyricLine | undefined;

		if (firstUntimedLine) {
			untimedLine = firstUntimedLine;
			untimedWord = getSynchronizableUnits(firstUntimedLine)[0].word;
		} else {
			untimedLine = lyrics.lyricLines.find((line) =>
				getSynchronizableUnits(line).some((u) => u.word.endTime === 0),
			);
			if (untimedLine) {
				untimedWord = getSynchronizableUnits(untimedLine).find(
					(u) => u.word.endTime === 0,
				)?.word;
			}
		}

		if (untimedLine && untimedWord) {
			const line = untimedLine;
			const word = untimedWord;
			setConfirmDialog({
				open: true,
				title: t(
					"confirmDialog.untimedLyrics.title",
					"Untimed Lyrics Detected",
				),
				description: t(
					"confirmDialog.untimedLyrics.description",
					"There is an untimed line or word in your lyrics. Would you like to fix it or export anyway?",
				),
				confirmText: t(
					"confirmDialog.untimedLyrics.exportAnyway",
					"Export Anyway",
				),
				cancelText: t("confirmDialog.untimedLyrics.fixIt", "Fix It"),
				onConfirm: action,
				onCancel: () => {
					store.set(selectedLinesAtom, new Set([line.id]));
					store.set(selectedWordsAtom, new Set([word.id]));
					audioEngine.seekMusic(line.startTime / 1000);
					store.set(currentTimeAtom, line.startTime);
				},
			});
		} else {
			action();
		}
	}, [store, setConfirmDialog, t]);

	const onSubmitToAMLLDB = useCallback(() => {
		store.set(submitToAMLLDBDialogAtom, true);
	}, [store]);

	const onOpenMetadataEditor = useCallback(() => {
		setMetadataEditorOpened(true);
	}, [setMetadataEditorOpened]);

	const onOpenProjectBrowser = useCallback(() => {
		setProjectBrowserDialog(true);
	}, [setProjectBrowserDialog]);

	const onOpenProjectManager = useCallback(() => {
		setProjectManagerDialog(true);
	}, [setProjectManagerDialog]);

	const onOpenWorkspace = useCallback(() => {
		setWorkspaceBrowserDialog(true);
	}, [setWorkspaceBrowserDialog]);

	const onOpenProjects = useCallback(() => {
		setProjectsDialog(true);
	}, [setProjectsDialog]);

	const onOpenSettings = useCallback(() => {
		setSettingsDialogOpened(true);
	}, [setSettingsDialogOpened]);

	const onOpenLatencyTest = useCallback(() => {
		store.set(latencyTestDialogAtom, true);
	}, [store]);

	const onOpenTTMLChecklist = useCallback(() => {
		setTTMLChecklistDialog(true);
	}, [setTTMLChecklistDialog]);

	const onOpenLyricsfileConverter = useCallback(() => {
		store.set(lyricsfileConverterDialogAtom, true);
	}, [store]);

	const onOpenGitHub = useCallback(async () => {
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open("https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL");
		} else {
			window.open("https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL");
		}
	}, []);

	const onOpenWiki = useCallback(async () => {
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open("https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/wiki");
		} else {
			window.open("https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/wiki");
		}
	}, []);

	const onUndo = useCallback(() => {
		if (!store.get(undoableLyricLinesAtom).canUndo) return;
		runHistoryAction(() => store.set(undoLyricLinesAtom));
	}, [runHistoryAction, store]);

	const onRedo = useCallback(() => {
		if (!store.get(undoableLyricLinesAtom).canRedo) return;
		runHistoryAction(() => store.set(redoLyricLinesAtom));
	}, [runHistoryAction, store]);

	const onUnselectAll = useCallback(() => {
		const immerSelectedLinesAtom = withImmer(selectedLinesAtom);
		const immerSelectedWordsAtom = withImmer(selectedWordsAtom);
		store.set(immerSelectedLinesAtom, (old) => {
			old.clear();
		});
		store.set(immerSelectedWordsAtom, (old) => {
			old.clear();
		});
	}, [store]);

	const onSelectAll = useCallback(() => {
		const lines = store.get(lyricLinesAtom).lyricLines;
		const selectedLineIds = store.get(selectedLinesAtom);
		const selectedLines = lines.filter((l) => selectedLineIds.has(l.id));
		const selectedWordIds = store.get(selectedWordsAtom);
		const selectedWords = lines
			.flatMap((l) => l.words)
			.filter((w) => selectedWordIds.has(w.id));
		if (selectedWords.length > 0) {
			const tmpWordIds = new Set(selectedWordIds);
			for (const selLine of selectedLines) {
				for (const word of selLine.words) {
					tmpWordIds.delete(word.id);
				}
			}
			if (tmpWordIds.size === 0) {
				store.set(
					selectedWordsAtom,
					new Set(selectedLines.flatMap((line) => line.words.map((w) => w.id))),
				);
				return;
			}
		} else {
			store.set(
				selectedLinesAtom,
				new Set(store.get(lyricLinesAtom).lyricLines.map((l) => l.id)),
			);
		}
		const sel = window.getSelection();
		if (sel) {
			if (sel.empty) {
				sel.empty();
			} else if (sel.removeAllRanges) {
				sel.removeAllRanges();
			}
		}
	}, [store]);

	const onSelectInverted = useCallback(() => {}, []);

	const onSelectWordsOfMatchedSelection = useCallback(() => {}, []);

	const onDeleteSelection = useCallback(() => {
		const selectedWordIds = store.get(selectedWordsAtom);
		const selectedLineIds = store.get(selectedLinesAtom);
		log("deleting selections", selectedWordIds, selectedLineIds);
		if (selectedWordIds.size === 0) {
			editLyricLines((prev) => {
				prev.lyricLines = prev.lyricLines.filter(
					(l) => !selectedLineIds.has(l.id),
				);
			});
		} else {
			editLyricLines((prev) => {
				for (const line of prev.lyricLines) {
					line.words = line.words.filter((w) => !selectedWordIds.has(w.id));
				}
			});
		}
		store.set(selectedWordsAtom, new Set());
		store.set(selectedLinesAtom, new Set());
	}, [store, editLyricLines]);

	const onAutoSegment = useCallback(() => {
		setAutoSegmentDialog(true);
	}, [setAutoSegmentDialog]);

	const onQuickAutoSegment = useCallback(() => {
		if (
			!matchesSavedSyllabificationEngine(
				lyricLines.lyricLines,
				savedSegmentationEngine,
			)
		) {
			setAutoSegmentDialog(true);
			return;
		}

		setSplitEnglish(savedSegmentationEngine !== "none");
		editLyricLines((draft) => {
			draft.lyricLines = segmentLyricLines(draft.lyricLines, {
				...segmentationConfig,
				engine: savedSegmentationEngine,
				splitEnglish: savedSegmentationEngine !== "none",
			});
		});
		toast.success(
			t("autoSegmentApplied", {
				defaultValue: "Auto-segmented with {engine}",
				engine:
					SYLLABIFICATION_ENGINES.find(
						({ id }) => id === savedSegmentationEngine,
					)?.name ?? savedSegmentationEngine,
			}),
		);
	}, [
		editLyricLines,
		lyricLines.lyricLines,
		savedSegmentationEngine,
		segmentationConfig,
		setAutoSegmentDialog,
		setSplitEnglish,
		t,
	]);

	const onRubySegment = useCallback(() => {
		const selectedWordIds = store.get(selectedWordsAtom);
		const hasSelection = selectedWordIds.size > 0;
		editLyricLines((state) => {
			for (const line of state.lyricLines) {
				for (const word of line.words) {
					if (hasSelection && !selectedWordIds.has(word.id)) continue;
					if (!word.ruby || word.ruby.length === 0) continue;
					const nextRuby: LyricWordBase[] = [];
					for (const rubyWord of word.ruby) {
						const parts = rubyWord.word.split("|");
						const nextSegments = buildRubySegments(parts[0] ?? "", rubyWord);
						const fallbackBase = {
							word: "",
							startTime: word.startTime,
							endTime: word.endTime,
						};
						const extraSegments = parts
							.slice(1)
							.flatMap((part) => buildRubySegments(part, fallbackBase));
						nextRuby.push(...nextSegments, ...extraSegments);
					}
					word.ruby = nextRuby;
				}
			}
		});
	}, [buildRubySegments, editLyricLines, store]);

	const onOpenTimeShift = useCallback(() => {
		setTimeShiftDialog(true);
	}, [setTimeShiftDialog]);

	const onOpenTimeStretch = useCallback(() => {
		setTimeStretchDialog(true);
	}, [setTimeStretchDialog]);

	const onSyncLineTimestamps = useCallback(() => {
		const action = () => {
			editLyricLines((draft) => {
				for (let i = 0; i < draft.lyricLines.length; i++) {
					const line = draft.lyricLines[i];
					if (line.words.length === 0) continue;

					let startTime = line.words[0].startTime;
					let endTime = line.words[line.words.length - 1].endTime;

					if (i + 1 < draft.lyricLines.length) {
						const nextLine = draft.lyricLines[i + 1];
						if (nextLine.isBG && nextLine.words.length > 0) {
							const nextLineStart = nextLine.words[0].startTime;
							const nextLineEnd =
								nextLine.words[nextLine.words.length - 1].endTime;
							startTime = Math.min(startTime, nextLineStart);
							endTime = Math.max(endTime, nextLineEnd);
						}
					}

					line.startTime = startTime;
					line.endTime = endTime;
				}
			});
		};

		setConfirmDialog({
			open: true,
			title: t(
				"confirmDialog.syncLineTimestamps.title",
				"Confirm Sync Line Timestamps",
			),
			description: t(
				"confirmDialog.syncLineTimestamps.description",
				"This action will automatically synchronize the start and end times of all lines based on the timestamps of each word in the line, matching the start and end times of the first and last syllables. Are you sure you want to proceed?",
			),
			onConfirm: action,
		});
	}, [editLyricLines, setConfirmDialog, t]);

	const onOpenAdvancedSegmentation = useCallback(() => {
		setAdvancedSegmentationDialog(true);
	}, [setAdvancedSegmentationDialog]);
	const onOpenLearnedSplits = useCallback(() => {
		setLearnedSplitsDialog(true);
	}, [setLearnedSplitsDialog]);

	return {
		newFileKey,
		openFileKey,
		saveFileKey,
		undoKey,
		redoKey,
		selectAllLinesKey,
		unselectAllLinesKey: selectAllLinesKey,
		selectInvertedLinesKey,
		selectWordsOfMatchedSelectionKey,
		deleteSelectionKey,
		undoDisabled: !undoLyricLines.canUndo,
		redoDisabled: !undoLyricLines.canRedo,
		onNewFile,
		onOpenFile,
		onOpenFileFromClipboard,
		onSaveFile,
		onOpenHistoryRestore,
		onSaveFileToClipboard,
		onSubmitToAMLLDB,
		onUndo,
		onRedo,
		onSelectAll,
		onUnselectAll,
		onSelectInverted,
		onSelectWordsOfMatchedSelection,
		onDeleteSelection,
		onOpenTimeShift,
		onOpenTimeStretch,
		onOpenMetadataEditor,
		onOpenProjectBrowser,
		onOpenProjectManager,
		onOpenProjects,
		onOpenWorkspace,
		onOpenSettings,
		onAutoSegment,
		onQuickAutoSegment,
		onRubySegment,
		onOpenAdvancedSegmentation,
		onOpenLearnedSplits,
		onSyncLineTimestamps,
		onOpenLatencyTest,
		onOpenTTMLChecklist,
		onOpenLyricsfileConverter,
		onOpenGitHub,
		onOpenWiki,
	};
};
