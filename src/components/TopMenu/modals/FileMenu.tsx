import { join } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Button, DropdownMenu } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { RESET } from "jotai-history";
import { Toolbar } from "radix-ui";
import { type CSSProperties } from "react";
import { toast } from "react-toastify";
import { Trans, useTranslation } from "react-i18next";
import { parseLyricsfile } from "$/modules/lyricsfile-processor";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
} from "$/modules/project/folder-project/state";
import { ImportExportLyric } from "$/modules/project/modals/ImportExportLyric";
import { confirmDialogAtom } from "$/states/dialogs";
import {
	ActiveFileKind,
	activeFileKindAtom,
	FILE_KIND_EXTENSIONS,
	isDirtyAtom,
	lyricLinesAtom,
	saveFileNameAtom,
	stripKnownFileExtension,
	undoableLyricLinesAtom,
} from "$/states/main";
import { parseLyric } from "$/modules/project/logic/ttml-parser";
import { formatKeyBindings } from "$/utils/keybindings";
import { useTopMenuActions } from "../useTopMenuActions";

type FileMenuProps = {
	variant: "toolbar" | "submenu";
	buttonStyle?: CSSProperties;
};

const FileMenuItems = () => {
	const menu = useTopMenuActions();
	const store = useStore();
	const { t } = useTranslation();
	const activeDir = useAtomValue(activeProjectDirAtom);
	const [manifest, setManifest] = useAtom(activeProjectManifestAtom);
	const [activeFileKind, setActiveFileKind] = useAtom(activeFileKindAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);

	const hasDualFormat = Boolean(
		activeDir &&
			manifest?.ttmlFile &&
			manifest?.lyricsfileFile &&
			manifest.ttmlFile !== manifest.lyricsfileFile,
	);

	const executeSwitchFormat = async (targetKind: ActiveFileKind) => {
		if (targetKind === activeFileKind) return;

		// Clean up YAML-specific roles when switching to TTML
		const cleanupForTTML = () => {
			if (targetKind === ActiveFileKind.TTML) {
				const currentLyrics = store.get(lyricLinesAtom);
				const hasYamlSpecifics =
					currentLyrics.vocalistNames !== undefined ||
					currentLyrics.sections?.some((s) => s.vocalist !== undefined);

				if (hasYamlSpecifics) {
					store.set(lyricLinesAtom, {
						...currentLyrics,
						vocalistNames: undefined,
						sections: currentLyrics.sections?.map((section) => {
							const { vocalist, ...rest } = section;
							return rest;
						}),
					});
				}
			}
		};

		// 1. Inside a Folder Project
		if (activeDir && manifest) {
			const companionFile =
				targetKind === ActiveFileKind.TTML
					? manifest.ttmlFile
					: manifest.lyricsfileFile;

			// If the companion file exists on disk, read and parse it
			if (companionFile) {
				try {
					const filePath = await join(activeDir, companionFile);
					const text = await readTextFile(filePath);
					if (targetKind === ActiveFileKind.Lyricsfile) {
						const parsed = parseLyricsfile(text);
						store.set(lyricLinesAtom, parsed);
					} else {
						const parsed = parseLyric(text);
						store.set(lyricLinesAtom, parsed);
					}
					store.set(saveFileNameAtom, companionFile);
					setActiveFileKind(targetKind);
					store.set(undoableLyricLinesAtom, RESET);
					toast.success(
						t("topBar.menu.switchedFormat", "Switched to {file}", {
							file: companionFile,
						}),
					);
					return;
				} catch (switchError) {
					const reason =
						switchError instanceof Error ? switchError.message : String(switchError);
					toast.error(
						t("topBar.menu.switchFormatFailed", "Failed to switch format: {reason}", {
							reason,
						}),
					);
					return;
				}
			}

			// Companion file does not exist on disk yet: convert in-memory lyric & update manifest
			cleanupForTTML();
			const currentName = store.get(saveFileNameAtom);
			const baseName = stripKnownFileExtension(currentName) || "lyric";
			const newFileName = `${baseName}${FILE_KIND_EXTENSIONS[targetKind]}`;

			setActiveFileKind(targetKind);
			store.set(saveFileNameAtom, newFileName);
			setManifest({
				...manifest,
				...(targetKind === ActiveFileKind.Lyricsfile
					? { lyricsfileFile: newFileName }
					: { ttmlFile: newFileName }),
			});
			toast.success(
				t("topBar.menu.switchedFormat", "Switched to {file}", {
					file: newFileName,
				}),
			);
			return;
		}

		// 2. Standalone mode (no folder project open)
		cleanupForTTML();
		const currentName = store.get(saveFileNameAtom);
		const baseName = stripKnownFileExtension(currentName) || "lyric";
		const newFileName = `${baseName}${FILE_KIND_EXTENSIONS[targetKind]}`;
		setActiveFileKind(targetKind);
		store.set(saveFileNameAtom, newFileName);
		toast.success(
			t("topBar.menu.switchedFormat", "Switched to {file}", {
				file: newFileName,
			}),
		);
	};

	const handleSwitchFormat = (targetKind: ActiveFileKind) => {
		if (targetKind === activeFileKind) return;
		const isDirty = store.get(isDirtyAtom);
		const companionFile =
			activeDir && manifest
				? (targetKind === ActiveFileKind.TTML ? manifest.ttmlFile : manifest.lyricsfileFile)
				: undefined;

		if (isDirty && companionFile) {
			setConfirmDialog({
				open: true,
				title: t("topBar.menu.switchFormatDirtyTitle", "Unsaved Changes in Current File"),
				description: t(
					"topBar.menu.switchFormatDirtyDesc",
					"You have unsaved changes in the current file. Switching format will load the companion file from disk and discard unsaved edits. What would you like to do?",
				),
				confirmText: t("topBar.menu.discardAndSwitch", "Discard & Switch"),
				confirmColor: "red",
				cancelText: t("common.cancel", "Cancel"),
				secondaryConfirmText: t("topBar.menu.saveAndSwitch", "Save & Switch"),
				onSecondaryConfirm: () => {
					menu.onSaveFile().then(() => {
						void executeSwitchFormat(targetKind);
					});
				},
				onConfirm: () => {
					void executeSwitchFormat(targetKind);
				},
			});
			return;
		}
		void executeSwitchFormat(targetKind);
	};

	const getShortcut = (key: string[] | undefined) =>
		key ? formatKeyBindings(key) : undefined;

	const isYaml = activeFileKind === ActiveFileKind.Lyricsfile;

	return (
		<>
			<DropdownMenu.Item
				onSelect={menu.onNewFile}
				shortcut={getShortcut(menu.newFileKey)}
			>
				{isYaml ? (
					<Trans i18nKey="topBar.menu.newYamlLyric">New YAML File</Trans>
				) : (
					<Trans i18nKey="topBar.menu.newLyric">New TTML File</Trans>
				)}
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onOpenFile}
				shortcut={getShortcut(menu.openFileKey)}
			>
				{isYaml ? (
					<Trans i18nKey="topBar.menu.openYamlLyric">Open YAML File</Trans>
				) : (
					<Trans i18nKey="topBar.menu.openLyric">Open TTML File</Trans>
				)}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenFileFromClipboard}>
				<Trans i18nKey="topBar.menu.openFromClipboard">
					Open TTML from Clipboard
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onSaveFile}
				shortcut={getShortcut(menu.saveFileKey)}
			>
				{isYaml ? (
					<Trans i18nKey="topBar.menu.saveYamlLyric">Save YAML File</Trans>
				) : (
					<Trans i18nKey="topBar.menu.saveLyric">Save TTML File</Trans>
				)}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenProjects}>
				<Trans i18nKey="topBar.menu.projects">Projects</Trans>
			</DropdownMenu.Item>
			{hasDualFormat && manifest && (
				<>
					<DropdownMenu.Separator />
					<DropdownMenu.Group>
						<DropdownMenu.Label>
							<Trans i18nKey="topBar.menu.projectFormat">Project Format</Trans>
						</DropdownMenu.Label>
						<DropdownMenu.Item
							onSelect={() => void handleSwitchFormat(ActiveFileKind.TTML)}
							style={{
								fontWeight:
									activeFileKind === ActiveFileKind.TTML ? "bold" : "normal",
								backgroundColor:
									activeFileKind === ActiveFileKind.TTML
										? "var(--accent-a3)"
										: undefined,
								color:
									activeFileKind === ActiveFileKind.TTML
										? "var(--accent-11)"
										: undefined,
							}}
						>
							{activeFileKind === ActiveFileKind.TTML ? "✓ " : "  "}
							{manifest.ttmlFile}
						</DropdownMenu.Item>
						<DropdownMenu.Item
							onSelect={() => void handleSwitchFormat(ActiveFileKind.Lyricsfile)}
							style={{
								fontWeight:
									activeFileKind === ActiveFileKind.Lyricsfile
										? "bold"
										: "normal",
								backgroundColor:
									activeFileKind === ActiveFileKind.Lyricsfile
										? "var(--accent-a3)"
										: undefined,
								color:
									activeFileKind === ActiveFileKind.Lyricsfile
										? "var(--accent-11)"
										: undefined,
							}}
						>
							{activeFileKind === ActiveFileKind.Lyricsfile ? "✓ " : "  "}
							{manifest.lyricsfileFile}
						</DropdownMenu.Item>
					</DropdownMenu.Group>
				</>
			)}
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onSaveFileToClipboard}>
				<Trans i18nKey="topBar.menu.saveLyricToClipboard">
					Save to Clipboard
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<ImportExportLyric />
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onSubmitToAMLLDB}>
				<Trans i18nKey="topBar.menu.uploadToAMLLDB">
					Upload to AMLL Database
				</Trans>
			</DropdownMenu.Item>
		</>
	);
};

export const FileMenu = (props: FileMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.file">文件</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<FileMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger>
					<Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.file">文件</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<FileMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
