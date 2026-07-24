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
import { saveFile } from "$/utils/fileSystem.ts";
import { useFileOpener } from "$/hooks/useFileOpener.ts";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import { validateSections } from "$/modules/lyric-editor/utils/section-system";
import { pluginManager } from "$/modules/plugins/plugin-manager";
import {
	geniusImportLyricsDialogAtom,
	importFromLRCLIBDialogAtom,
	importFromTextDialogAtom,
	lyricallyImportLyricsDialogAtom,
} from "$/states/dialogs.ts";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main.ts";
import { error } from "$/utils/logging.ts";

export const ImportExportLyric = () => {
	const store = useStore();
	const setImportFromTextDialog = useSetAtom(importFromTextDialogAtom);
	const setImportFromLRCLIBDialog = useSetAtom(importFromLRCLIBDialogAtom);
	const setGeniusImportLyricsDialog = useSetAtom(geniusImportLyricsDialogAtom);
	const setLyricallyImportDialog = useSetAtom(lyricallyImportLyricsDialogAtom);
	const { openFile } = useFileOpener();
	const { t } = useTranslation();
	const notifySectionIssues = () => {
		const count = validateSections(store.get(lyricLinesAtom)).length;
		if (count > 0) {
			toast.info(
				`Section review: ${count} non-blocking issue${count === 1 ? "" : "s"}.`,
			);
		}
	};

	const onImportLyric = (extension: string) => {
		const inputEl = document.createElement("input");
		inputEl.type = "file";
		inputEl.accept = `.${extension},*/*`;
		inputEl.addEventListener(
			"change",
			() => {
				const file = inputEl.files?.[0];
				if (!file) return;

				openFile(file, extension);
			},
			{
				once: true,
			},
		);
		inputEl.click();
	};

	const onImportWithPlugin = (pluginId: string, extension: string) => async () => {
		const inputEl = document.createElement("input");
		inputEl.type = "file";
		inputEl.accept = `.${extension}`;
		inputEl.addEventListener("change", async () => {
			const file = inputEl.files?.[0];
			if (!file) return;

			try {
				const text = await file.text();
				const transformed = await pluginManager.runImporter(pluginId, text);
				const newFile = new File([transformed], file.name, { type: "application/xml" });
				openFile(newFile, extension);
			} catch (e: any) {
				error(`Plugin import failed: ${pluginId}`, e);
				alert(e.message || "Import failed. Please make sure you are using a valid TTML file.");
			}
		}, { once: true });
		inputEl.click();
	};

	const onExportLyric =
		(stringifier: (lines: LyricLine[]) => string, extension: string) =>
		async () => {
			notifySectionIssues();
			const lyricState = store.get(lyricLinesAtom);
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

	const exporters = pluginManager.getExporters();
	const importers = pluginManager.getImporters();

	const onExportWithPlugin = (pluginId: string, extension: string) => async () => {
		notifySectionIssues();
		const lyricState = store.get(lyricLinesAtom);
		
		// Use TTML as the primary interchange format for plugins
		const ttmlData = exportTTMLText(lyricState);
		
		try {
			const result = await pluginManager.runExporter(pluginId, ttmlData);
			const saveFileName = store.get(saveFileNameAtom);
			const baseName = saveFileName.replace(/\.[^.]*$/, "");
			const fileName = `${baseName}.${extension}`;
			await saveFile(result, {
				suggestedName: fileName,
				types: [
					{
						description: `${extension.toUpperCase()} Files`,
						accept: { "text/plain": [`.${extension}`] },
					},
				],
			});
		} catch (e) {
			error(`Plugin export failed: ${pluginId}`, e);
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
						{t("topBar.menu.importLyric.fromLyrically", "Import from Lyrically...")}
					</DropdownMenu.Item>

					<DropdownMenu.Item onClick={() => setGeniusImportLyricsDialog(true)}>
						{t("topBar.menu.importLyric.fromGenius", "从 Genius 导入…")}
					</DropdownMenu.Item>

					<DropdownMenu.Item onClick={() => onImportLyric("lrc")}>
						{t("topBar.menu.importLyric.fromLyRiC", "从 LyRiC 文件导入")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("eslrc")}>
						{t("topBar.menu.importLyric.fromESLyRiC", "从 ESLyRiC 文件导入")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("qrc")}>
						{t("topBar.menu.importLyric.fromQRC", "从 QRC 文件导入")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("yrc")}>
						{t("topBar.menu.importLyric.fromYRC", "从 YRC 文件导入")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("lys")}>
						{t(
							"topBar.menu.importLyric.fromLrcfySylb",
							"从 Lyricify Syllable 文件导入",
						)}
					</DropdownMenu.Item>
					{importers.length > 0 && <DropdownMenu.Separator />}
					{importers.map(plugin => (
						<DropdownMenu.Item key={plugin.metadata.id} onClick={onImportWithPlugin(plugin.metadata.id, "ttml")}>
							{plugin.metadata.name}
						</DropdownMenu.Item>
					))}
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
					<DropdownMenu.Item onClick={onExportLyric(stringifyEslrc, "lrc")}>
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

					{exporters.length > 0 && <DropdownMenu.Separator />}
					{exporters.map(plugin => (
						<DropdownMenu.Item key={plugin.metadata.id} onClick={onExportWithPlugin(plugin.metadata.id, "ttml")}>
							Export to {plugin.metadata.name}
						</DropdownMenu.Item>
					))}
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		</>
	);
};
