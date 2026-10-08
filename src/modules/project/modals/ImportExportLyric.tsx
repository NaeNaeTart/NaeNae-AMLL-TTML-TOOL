import {
	type LyricLine,
	stringifyAss,
	stringifyEslrc,
	stringifyLrc,
	stringifyLys,
	stringifyQrc,
	stringifyYrc,
} from "@applemusic-like-lyrics/lyric";
import { DropdownMenu } from "@radix-ui/themes";
import { useSetAtom, useStore } from "jotai";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { validateSections } from "$/modules/lyric-editor/utils/section-system";
import { lyricTextNormalizationOptionsAtom } from "$/modules/settings/states";
import {
	geniusImportLyricsDialogAtom,
	importFromLRCLIBDialogAtom,
	importFromTextDialogAtom,
	lyricallyImportLyricsDialogAtom,
} from "$/states/dialogs.ts";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main.ts";
import { normalizeLyricText } from "$/utils/apostrophe-normalization";
import { saveFile } from "$/utils/fileSystem.ts";
import { error } from "$/utils/logging.ts";

export const ImportExportLyric = () => {
	const store = useStore();
	const setImportFromTextDialog = useSetAtom(importFromTextDialogAtom);
	const setImportFromLRCLIBDialog = useSetAtom(importFromLRCLIBDialogAtom);
	const setGeniusImportLyricsDialog = useSetAtom(geniusImportLyricsDialogAtom);
	const setLyricallyImportDialog = useSetAtom(lyricallyImportLyricsDialogAtom);
	const { t } = useTranslation();
	const notifySectionIssues = () => {
		const count = validateSections(store.get(lyricLinesAtom)).length;
		if (count > 0) {
			toast.info(
				`Section review: ${count} non-blocking issue${count === 1 ? "" : "s"}.`,
			);
		}
	};

	const onExportLyric =
		(stringifier: (lines: LyricLine[]) => string, extension: string) =>
		async () => {
			notifySectionIssues();
			const lyricState = normalizeLyricText(
				store.get(lyricLinesAtom),
				store.get(lyricTextNormalizationOptionsAtom),
			);
			const lyric = lyricState.lyricLines;
			const metadata = lyricState.metadata;

			const songwriter = metadata.find((m) => m.key === "songwriter");
			if (!songwriter || songwriter.value.every((v) => !v.trim())) {
				const confirm = window.confirm(
					t(
						"confirmDialog.noSongwriter.description",
						"The song has no songwriters. Do you want to continue saving?",
					),
				);
				if (!confirm) return;
			}

			const lyricForExport = lyric.map((line) => ({
				...line,
				startTime: Math.round(line.startTime),
				endTime: Math.round(line.endTime),
				words: line.words.map((word) => ({
					...word,
					startTime: Math.round(word.startTime),
					endTime: Math.round(word.endTime),
				})),
			}));
			const saveFileName = store.get(saveFileNameAtom);
			const baseName = saveFileName.replace(/\.[^.]*$/, "");
			const fileName = `${baseName}.${extension}`;
			try {
				const data = stringifier(lyricForExport);
				await saveFile(data, {
					suggestedName: fileName,
					types: [
						{
							description: `${extension.toUpperCase()} Files`,
							accept: { "text/plain": [`.${extension}`] },
						},
					],
				});
			} catch (e) {
				error(`Failed to export lyric with format "${extension}"`, e);
			}
		};

	return (
		<>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.importLyric.import", "导入歌词...")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onClick={() => setImportFromTextDialog(true)}>
						{t("topBar.menu.importLyric.fromPlainText", "从纯文本导入")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => setImportFromLRCLIBDialog(true)}>
						{t("topBar.menu.importLyric.fromLRCLIB", "从 LRCLIB 导入...")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => setLyricallyImportDialog(true)}>
						{t(
							"topBar.menu.importLyric.fromLyrically",
							"Import from Lyrically...",
						)}
					</DropdownMenu.Item>

					<DropdownMenu.Item onClick={() => setGeniusImportLyricsDialog(true)}>
						{t("topBar.menu.importLyric.fromGenius", "从 Genius 导入…")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.exportLyric.export", "导出歌词...")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onClick={onExportLyric(stringifyLrc, "lrc")}>
						{t("topBar.menu.exportLyric.toLyRiC", "导出到 LyRiC")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyEslrc, "eslrc")}>
						{t("topBar.menu.exportLyric.toESLyRiC", "导出到 ESLyRiC")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyQrc, "qrc")}>
						{t("topBar.menu.exportLyric.toQRC", "导出到 QRC")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyYrc, "yrc")}>
						{t("topBar.menu.exportLyric.toYRC", "导出到 YRC")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyLys, "lys")}>
						{t(
							"topBar.menu.exportLyric.toLrcfySylb",
							"导出到 Lyricify Syllable",
						)}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyAss, "ass")}>
						{t("topBar.menu.exportLyric.toASS", "导出到 ASS 字幕")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		</>
	);
};
