/**
 * @description 处理打开文件的逻辑
 */

import {
	type LyricLine,
	parseEslrc,
	parseLys,
	parseQrc,
	parseYrc,
} from "@applemusic-like-lyrics/lyric";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { uid } from "uid";

import { audioEngine } from "$/modules/audio/audio-engine";
import { convertMp3ToFlac } from "$/modules/audio/utils/mp3-converter";
import { getProjectList } from "$/modules/project/autosave/autosave";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import { isProjectMatch } from "$/modules/project/logic/project-match";
import { parseLyric as parseTTML } from "$/modules/project/logic/ttml-parser";
import {
	Mp3ConversionMode,
	mp3ConversionModeAtom,
	normalizeApostrophesOnImportAtom,
	normalizeCyrillicEsOnImportAtom,
} from "$/modules/settings/states";
import {
	confirmDialogAtom,
	mp3ConversionDialogAtom,
} from "$/states/dialogs";
import {
	isDirtyAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
} from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";
import { error as logError, log } from "$/utils/logging";
import { parseLrc } from "$/utils/parse-lrc";
import {
	normalizeImportedLyricApostrophes,
	normalizeImportedLyricCyrillicEs,
} from "$/utils/apostrophe-normalization";

const LYRIC_PARSERS: Record<string, (text: string) => LyricLine[]> = {
	lrc: parseLrc,
	eslrc: parseEslrc,
	qrc: parseQrc,
	yrc: parseYrc,
	lys: parseLys,
};

const AUDIO_EXTENSIONS = new Set([
	"opus",
	"flac",
	"webm",
	"weba",
	"wav",
	"ogg",
	"m4a",
	"oga",
	"mid",
	"mp3",
	"aiff",
	"wma",
	"au",
]);

export const useFileOpener = () => {
	const setNewLyricLines = useSetAtom(newLyricLinesAtom);
	const setProjectId = useSetAtom(projectIdAtom);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const setMp3ConversionDialog = useSetAtom(mp3ConversionDialogAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const { t } = useTranslation();

	const [conversionMode] = useAtom(mp3ConversionModeAtom);
	const normalizeApostrophesOnImport = useAtomValue(
		normalizeApostrophesOnImportAtom,
	);
	const normalizeCyrillicEsOnImport = useAtomValue(
		normalizeCyrillicEsOnImportAtom,
	);

	const normalizeLyricLines = useCallback(
		(lyricLines: LyricLine[]): TTMLLyric => {
			return {
				lyricLines: lyricLines.map((line) => ({
					...line,
					words: line.words.map((word) => ({
						...word,
						id: uid(),
						obscene: false,
						emptyBeat: 0,
					})),
					ignoreSync: false,
					id: uid(),
				})),
				metadata: [],
			};
		},
		[],
	);

	const performOpenFile = useCallback(
		async (file: File, forceExt?: string) => {
			const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
			const ext = forceExt ? forceExt.toLowerCase() : rawExt;

			try {
				if (AUDIO_EXTENSIONS.has(ext)) {
					if (ext === "mp3") {
						if (conversionMode === Mp3ConversionMode.Always) {
							const fileData = await file.arrayBuffer();
							const uint8Array = new Uint8Array(fileData);

							try {
								toast.info(
									t(
										"dialog.mp3Conversion.converting",
										"正在转换 MP3 到 FLAC...",
									),
								);
								const flacData = await convertMp3ToFlac(uint8Array, file.name);
								const flacArray = new Uint8Array(flacData);
								const flacBlob = new Blob([flacArray], {
									type: "audio/flac",
								});
								const flacFile = new File(
									[flacBlob],
									file.name.replace(/\.mp3$/i, ".flac"),
									{
										type: "audio/flac",
									},
								);
								await audioEngine.loadMusic(flacFile);
								toast.success(t("dialog.mp3Conversion.success", "转换成功"));
								return;
							} catch (e) {
								toast.error(
									t("dialog.mp3Conversion.failed", "转换失败: {error}", {
										error: e instanceof Error ? e.message : String(e),
									}),
								);
								audioEngine.loadMusic(file);
								return;
							}
						}

						if (conversionMode === Mp3ConversionMode.Ask) {
							const fileData = await file.arrayBuffer();
							const uint8Array = new Uint8Array(fileData);

							const doConvert = await new Promise<boolean>((resolve) => {
								setMp3ConversionDialog({
									open: true,
									fileName: file.name,
									onConvert: () => resolve(true),
									onSkip: () => resolve(false),
								});
							});

							if (!doConvert) {
								audioEngine.loadMusic(file);
								return;
							}

							try {
								toast.info(
									t(
										"dialog.mp3Conversion.converting",
										"正在转换 MP3 到 FLAC...",
									),
								);
								const flacData = await convertMp3ToFlac(uint8Array, file.name);
								const flacArray = new Uint8Array(flacData);
								const flacBlob = new Blob([flacArray], {
									type: "audio/flac",
								});
								const flacFile = new File(
									[flacBlob],
									file.name.replace(/\.mp3$/i, ".flac"),
									{
										type: "audio/flac",
									},
								);
								await audioEngine.loadMusic(flacFile);
								toast.success(t("dialog.mp3Conversion.success", "转换成功"));
								return;
							} catch (e) {
								toast.error(
									t("dialog.mp3Conversion.failed", "转换失败: {error}", {
										error: e instanceof Error ? e.message : String(e),
									}),
								);
								audioEngine.loadMusic(file);
								return;
							}
						}

						audioEngine.loadMusic(file);
						return;
					}
					audioEngine.loadMusic(file);
					return;
				}

				let lyricData: TTMLLyric | null = null;
				const text = await file.text();

				if (ext === "ttml") {
					lyricData = parseTTML(text);
				} else if (ext in LYRIC_PARSERS) {
					const parser = LYRIC_PARSERS[ext];
					const rawLines = parser(text);
					lyricData = normalizeLyricLines(rawLines);
				} else {
					toast.error(
						t("error.unsupportedFileFormat", "不支持的文件格式: {ext}", {
							ext,
						}),
					);
					return;
				}

				if (!lyricData) return;
				lyricData = normalizeImportedLyricApostrophes(
					lyricData,
					normalizeApostrophesOnImport,
				);
				lyricData = normalizeImportedLyricCyrillicEs(
					lyricData,
					normalizeCyrillicEsOnImport,
				);

				let resolvedProjectId = uid();

				try {
					if (lyricData.metadata.length > 0) {
						const projects = await getProjectList();
						const matchedProject = projects.find((p) =>
							isProjectMatch(p, lyricData as TTMLLyric),
						);

						if (matchedProject) {
							log(
								`匹配到了已有项目: ${matchedProject.name} (${matchedProject.id})`,
							);
							resolvedProjectId = matchedProject.id;
						} else {
							log("未匹配已有项目");
						}
					}
				} catch (e) {
					logError("解析项目数据时失败", e);
				}

				setProjectId(resolvedProjectId);
				setNewLyricLines(lyricData);
				const suggestedFile = getSuggestedTtmlFileName(lyricData.metadata);
				const nextFileName =
					ext === "ttml" ? file.name : (suggestedFile?.fileName ?? file.name);
				setSaveFileName(nextFileName);
			} catch (e) {
				logError(`Failed to open file: ${file.name}`, e);
				toast.error(t("error.openFileFailed", "打开文件失败"));
			}
		},
		[
			setNewLyricLines,
			setProjectId,
			setSaveFileName,
			normalizeLyricLines,
			t,
			conversionMode,
			normalizeApostrophesOnImport,
			normalizeCyrillicEsOnImport,
			setMp3ConversionDialog,
		],
	);

	const openFile = useCallback(
		/**
		 * 打开文件
		 * @param file
		 * @param forceExt 可选参数，用于强制指定解析方式，不传入则从文件后缀名推断
		 */
		(file: File, forceExt?: string) => {
			const run = () => performOpenFile(file, forceExt);

			const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
			const finalExt = forceExt || rawExt;

			if (AUDIO_EXTENSIONS.has(finalExt)) {
				run();
				return;
			}

			if (isDirty) {
				setConfirmDialog({
					open: true,
					title: t("confirmDialog.openFile.title", "确认打开文件"),
					description: t(
						"confirmDialog.openFile.description",
						"当前文件有未保存的更改。如果继续，这些更改将会丢失。确定要打开新文件吗？",
					),
					onConfirm: run,
				});
			} else {
				run();
			}
		},
		[isDirty, setConfirmDialog, t, performOpenFile],
	);

	return { openFile };
};
