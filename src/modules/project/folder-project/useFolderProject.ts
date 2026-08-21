import { isTauri } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import {
	exists,
	mkdir,
	readDir,
	readFile,
	readTextFile,
	remove,
	writeFile,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import { useAtom, useAtomValue, useStore } from "jotai";
import { RESET } from "jotai-history";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { uid } from "uid";
import { audioEngine } from "$/modules/audio/audio-engine";
import { loadedAudioAtom } from "$/modules/audio/states";
import {
	ensureExtension,
	getFileExtension,
	getFileNameFromPath,
	sanitizeFileName,
} from "$/modules/project/folder-project/manifest";
import {
	removeRecentProject,
	upsertRecentProject,
} from "$/modules/project/folder-project/recent-projects";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
	workspaceDirAtom,
	workspaceProjectsAtom,
	workspaceScanningAtom,
} from "$/modules/project/folder-project/state";
import {
	isProjectManifest,
	PROJECT_MANIFEST_FILENAME,
	type ProjectManifest,
} from "$/modules/project/folder-project/types";
import { scanProjectWorkspace } from "$/modules/project/folder-project/workspace-scan";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import {
	exportLyricsfileText,
	parseLyricsfile,
} from "$/modules/lyricsfile-processor";
import { parseLyric } from "$/modules/project/logic/ttml-parser";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import { reverseSyncLineIdsAtom } from "$/modules/settings/states/sync";
import { confirmDialogAtom } from "$/states/dialogs.ts";
import {
	ActiveFileKind,
	activeFileKindAtom,
	isDirtyAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	undoableLyricLinesAtom,
} from "$/states/main.ts";
import type { TTMLLyric } from "$/types/ttml";
import { log, error as logError } from "$/utils/logging.ts";

const AUDIO_MIME_BY_EXT: Record<string, string> = {
	flac: "audio/flac",
	wav: "audio/wav",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
	aac: "audio/aac",
	ogg: "audio/ogg",
	opus: "audio/opus",
};

const AUDIO_EXTS = new Set(Object.keys(AUDIO_MIME_BY_EXT));

export const useFolderProject = () => {
	const { t } = useTranslation();
	const store = useStore();
	const [activeDir, setActiveDir] = useAtom(activeProjectDirAtom);
	const [manifest, setManifest] = useAtom(activeProjectManifestAtom);
	const isDirty = useAtomValue(isDirtyAtom);

	const requireTauri = useCallback(() => {
		if (isTauri()) return true;
		toast.error(
			t(
				"error.folderProjectRequiresDesktop",
				"The project folder feature is only available in the desktop app",
			),
		);
		return false;
	}, [t]);

	const generateLyricText = useCallback((): string | null => {
		const lyric = store.get(lyricLinesAtom);
		const fileKind = store.get(activeFileKindAtom);
		if (fileKind === ActiveFileKind.Lyricsfile) {
			try {
				return exportLyricsfileText(lyric);
			} catch (e) {
				logError("Error when generating Lyricsfile YAML", e);
				toast.error(
					t(
						"error.lyricsfileGenerateFailed",
						"Failed to generate Lyricsfile YAML",
					),
				);
				return null;
			}
		}
		try {
			return exportTTMLText({
				...lyric,
				reversedSyncLineIds: Array.from(store.get(reverseSyncLineIdsAtom)),
			});
		} catch (e) {
			logError("Error when generating TTML", e);
			toast.error(t("error.ttmlGenerateFailed", "Failed to generate TTML"));
			return null;
		}
	}, [store, t]);

	const loadProjectFromDir = useCallback(
		async (dir: string): Promise<boolean> => {
			audioEngine.unloadMusic();
			let manifestText: string;
			try {
				const manifestPath = await join(dir, PROJECT_MANIFEST_FILENAME);
				manifestText = await readTextFile(manifestPath);
			} catch (e) {
				logError(`Failed to read project manifest in ${dir}`, e);
				toast.error(
					t("error.folderProjectInvalid", "Invalid project manifest file"),
				);
				return false;
			}
			let parsedManifest: unknown;
			try {
				parsedManifest = JSON.parse(manifestText);
			} catch (e) {
				logError("Failed to parse project manifest", e);
				toast.error(
					t("error.folderProjectInvalid", "Invalid project manifest file"),
				);
				return false;
			}
			if (!isProjectManifest(parsedManifest)) {
				toast.error(
					t("error.folderProjectInvalid", "Invalid project manifest file"),
				);
				return false;
			}

			let ttmlFile: string | undefined;
			let lyricsfileFile: string | undefined;

			try {
				const entries = await readDir(dir);
				const ttmlEntries = entries.filter(
					(e) => e.isFile && getFileExtension(e.name) === "ttml",
				);
				const yamlEntries = entries.filter((e) => {
					if (!e.isFile) return false;
					const ext = getFileExtension(e.name);
					return ext === "yaml" || ext === "yml";
				});

				if (
					parsedManifest.ttmlFile &&
					ttmlEntries.some((e) => e.name === parsedManifest.ttmlFile)
				) {
					ttmlFile = parsedManifest.ttmlFile;
				} else if (ttmlEntries.length > 0) {
					ttmlFile = ttmlEntries[0].name;
				}

				if (
					parsedManifest.lyricsfileFile &&
					yamlEntries.some((e) => e.name === parsedManifest.lyricsfileFile)
				) {
					lyricsfileFile = parsedManifest.lyricsfileFile;
				} else if (yamlEntries.length > 0) {
					lyricsfileFile = yamlEntries[0].name;
				}
			} catch {}

			// Default: Always open in TTML if available, otherwise open in YAML
			const activeLyricFileName = ttmlFile || lyricsfileFile || "";
			const isLyricsfile = !ttmlFile && Boolean(lyricsfileFile);

			parsedManifest.ttmlFile = ttmlFile;
			parsedManifest.lyricsfileFile = lyricsfileFile;
			parsedManifest.lyricFile = activeLyricFileName;

			let lyricData: TTMLLyric = { lyricLines: [], metadata: [] };
			if (activeLyricFileName) {
				const lyricPath = await join(dir, activeLyricFileName);
				let hasLyric = false;
				try {
					hasLyric = await exists(lyricPath);
				} catch (e) {
					logError(`Failed to check lyric file: ${lyricPath}`, e);
				}
				if (hasLyric) {
					try {
						const lyricText = await readTextFile(lyricPath);
						if (isLyricsfile) {
							lyricData = parseLyricsfile(lyricText);
						} else {
							const parsed = parseLyric(lyricText);
							lyricData = {
								metadata: parsed.metadata.map((meta) => ({ ...meta })),
								lyricLines: parsed.lyricLines.map((line) => ({
									...line,
									words: line.words.map((word) => ({
										...word,
										id: uid(),
										obscene: word.obscene ?? false,
										emptyBeat: word.emptyBeat ?? 0,
									})),
									ignoreSync: false,
									id: uid(),
								})),
								marks: parsed.marks,
								sections: parsed.sections,
								reversedSyncLineIds: parsed.reversedSyncLineIds,
							};
						}
					} catch (e) {
						logError(`Error when parsing lyric file: ${activeLyricFileName}`, e);
						toast.error(
							t("error.folderProjectLyricParse", "Failed to parse lyric file"),
						);
						return false;
					}
				} else {
					toast.info(
						t(
							"error.folderProjectNoLyric",
							"Add a lyric file before saving the project",
						),
					);
				}
			}

			let audioFile: File | null = null;
			if (parsedManifest.audioFile) {
				const audioPath = await join(dir, parsedManifest.audioFile);
				let hasAudio = false;
				try {
					hasAudio = await exists(audioPath);
				} catch (e) {
					logError(`Failed to check audio file: ${audioPath}`, e);
				}
				if (hasAudio) {
					try {
						const audioBytes = await readFile(audioPath);
						const ext = getFileExtension(parsedManifest.audioFile);
						audioFile = new File(
							[audioBytes as BlobPart],
							parsedManifest.audioFile,
							{ type: AUDIO_MIME_BY_EXT[ext] ?? "" },
						);
					} catch (e) {
						logError(
							`Failed to read project audio: ${parsedManifest.audioFile}`,
							e,
						);
						toast.warning(
							t(
								"error.folderProjectAudioReadFailed",
								"Failed to read project audio file",
							),
						);
					}
				}
			}

			store.set(projectIdAtom, uid());
			store.set(newLyricLinesAtom, lyricData);
			store.set(
				reverseSyncLineIdsAtom,
				new Set(lyricData.reversedSyncLineIds ?? []),
			);
			store.set(saveFileNameAtom, parsedManifest.lyricFile);
			store.set(
				activeFileKindAtom,
				isLyricsfile ? ActiveFileKind.Lyricsfile : ActiveFileKind.TTML,
			);

			setActiveDir(dir);
			setManifest(parsedManifest);

			if (audioFile) {
				try {
					await audioEngine.loadMusic(audioFile);
				} catch (e) {
					logError("Failed to load project audio", e);
					toast.error(
						t(
							"error.folderProjectAudioLoadFailed",
							"Failed to load project audio",
						),
					);
				}
			} else {
				toast.info(
					t(
						"error.folderProjectNoAudio",
						"Load an audio file before saving the project",
					),
				);
			}

			log(`Opened folder project: ${parsedManifest.name} (${dir})`);
			void upsertRecentProject({
				dir,
				name: parsedManifest.name,
				audioFile: parsedManifest.audioFile,
				lyricFile: parsedManifest.lyricFile,
				lyricsfileFile: parsedManifest.lyricsfileFile,
				ttmlFile: parsedManifest.ttmlFile,
				updatedAt: parsedManifest.updatedAt,
			});
			return true;
		},
		[store, t, setActiveDir, setManifest],
	);

	const importProjectDir = useCallback(
		async (dir: string): Promise<boolean> => {
			try {
				audioEngine.unloadMusic();
			} catch (e) {
				logError("Failed to unload music", e);
			}
			let entries: Awaited<ReturnType<typeof readDir>> | null = null;
			try {
				entries = await readDir(dir);
			} catch (e) {
				logError(`Failed to list project folder: ${dir}`, e);
				toast.error(
					t(
						"error.folderProjectUnavailable",
						"The project folder is not accessible",
					),
				);
				return false;
			}
			if (!entries) return false;
			const audioEntry = entries.find(
				(e) => e.isFile && AUDIO_EXTS.has(getFileExtension(e.name)),
			);
			const ttmlEntry = entries.find(
				(e) => e.isFile && getFileExtension(e.name) === "ttml",
			);
			const yamlEntry = entries.find(
				(e) =>
					e.isFile &&
					(getFileExtension(e.name) === "yaml" ||
						getFileExtension(e.name) === "yml"),
			);
			const lyricEntry = ttmlEntry ?? yamlEntry;
			const lyricsfileFileName = yamlEntry?.name;

			if (!audioEntry && !lyricEntry) {
				toast.error(
					t(
						"error.folderProjectNoContent",
						"No TTML, YAML, or audio files found in this folder",
					),
				);
				return false;
			}

			let lyricData: TTMLLyric = { lyricLines: [], metadata: [] };
			let lyricFileName = "";
			let isLyricsfile = false;

			if (lyricEntry) {
				const lyricPath = await join(dir, lyricEntry.name);
				try {
					const lyricText = await readTextFile(lyricPath);
					const ext = getFileExtension(lyricEntry.name);
					isLyricsfile = ext === "yaml" || ext === "yml";
					if (isLyricsfile) {
						lyricData = parseLyricsfile(lyricText);
					} else {
						const parsed = parseLyric(lyricText);
						lyricData = {
							metadata: parsed.metadata.map((meta) => ({ ...meta })),
							lyricLines: parsed.lyricLines.map((line) => ({
								...line,
								words: line.words.map((word) => ({
									...word,
									id: uid(),
									obscene: word.obscene ?? false,
									emptyBeat: word.emptyBeat ?? 0,
								})),
								ignoreSync: false,
								id: uid(),
							})),
							marks: parsed.marks,
							sections: parsed.sections,
							reversedSyncLineIds: parsed.reversedSyncLineIds,
						};
					}
					lyricFileName = lyricEntry.name;
				} catch (e) {
					logError(`Error when parsing lyric file: ${lyricEntry.name}`, e);
					toast.error(
						t("error.folderProjectLyricParse", "Failed to parse lyric file"),
					);
					return false;
				}
			}

			let audioFile: File | null = null;
			let audioFileName = "";
			if (audioEntry) {
				const audioPath = await join(dir, audioEntry.name);
				try {
					const audioBytes = await readFile(audioPath);
					const ext = getFileExtension(audioEntry.name);
					audioFile = new File([audioBytes as BlobPart], audioEntry.name, {
						type: AUDIO_MIME_BY_EXT[ext] ?? "",
					});
					audioFileName = audioEntry.name;
				} catch (e) {
					logError(`Failed to read audio file: ${audioEntry.name}`, e);
					toast.warning(
						t(
							"error.folderProjectAudioReadFailed",
							"Failed to read project audio file",
						),
					);
				}
			}

			store.set(projectIdAtom, uid());
			store.set(newLyricLinesAtom, lyricData);
			store.set(
				reverseSyncLineIdsAtom,
				new Set(lyricData.reversedSyncLineIds ?? []),
			);
			store.set(saveFileNameAtom, lyricFileName);
			store.set(
				activeFileKindAtom,
				isLyricsfile ? ActiveFileKind.Lyricsfile : ActiveFileKind.TTML,
			);

			if (audioFile) {
				try {
					await audioEngine.loadMusic(audioFile);
				} catch (e) {
					logError("Failed to load project audio", e);
					toast.error(
						t(
							"error.folderProjectAudioLoadFailed",
							"Failed to load project audio",
						),
					);
				}
			}

			const suggested = getSuggestedTtmlFileName(lyricData.metadata);
			const nextManifest: ProjectManifest = {
				version: 1,
				name: suggested?.baseName ?? getFileNameFromPath(dir),
				audioFile: audioFileName,
				lyricFile: lyricFileName,
				lyricsfileFile: lyricsfileFileName,
				ttmlFile: ttmlEntry?.name,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			try {
				const manifestPath = await join(dir, PROJECT_MANIFEST_FILENAME);
				await writeTextFile(
					manifestPath,
					JSON.stringify(nextManifest, null, 2),
				);
			} catch (e) {
				logError("Failed to write project manifest", e);
			}

			setActiveDir(dir);
			setManifest(nextManifest);

			log(`Imported folder project: ${nextManifest.name} (${dir})`);
			void upsertRecentProject({
				dir,
				name: nextManifest.name,
				audioFile: nextManifest.audioFile,
				lyricFile: nextManifest.lyricFile,
				lyricsfileFile: nextManifest.lyricsfileFile,
				ttmlFile: nextManifest.ttmlFile,
				updatedAt: nextManifest.updatedAt,
			});
			return true;
		},
		[store, t, setActiveDir, setManifest],
	);

	const openProject = useCallback(async () => {
		if (!requireTauri()) return;

		const runOpen = async () => {
			try {
				const dir = await open({
					directory: true,
					multiple: false,
					title: t("dialog.openProject.title", "Select project folder"),
				});
				if (!dir || typeof dir !== "string") {
					return;
				}

				const manifestPath = await join(dir, PROJECT_MANIFEST_FILENAME);
				let hasManifest = false;
				try {
					hasManifest = await exists(manifestPath);
				} catch (e) {
					logError("Failed to check project manifest", e);
					toast.error(
						t(
							"error.folderProjectUnavailable",
							"The project folder is not accessible",
						),
					);
					return;
				}
				if (!hasManifest) {
					toast.error(
						t(
							"error.folderProjectNotFound",
							"The selected folder is not a valid project folder (missing project.json)",
						),
					);
					return;
				}

				await loadProjectFromDir(dir);
			} catch (e) {
				logError("Failed to open folder project", e);
				toast.error(
					t(
						"error.folderProjectOpenFailed",
						"Failed to open project folder: {reason}",
						{ reason: String((e as Error)?.message ?? e) },
					),
				);
			}
		};

		if (isDirty) {
			store.set(confirmDialogAtom, {
				open: true,
				title: t("confirmDialog.openFile.title", "Confirm Open File"),
				description: t(
					"confirmDialog.openFile.description",
					"You have unsaved changes. If you proceed, these changes will be lost. Are you sure you want to open a new file?",
				),
				onConfirm: runOpen,
			});
		} else {
			await runOpen();
		}
	}, [requireTauri, isDirty, store, t, loadProjectFromDir]);

	const openProjectFromDir = useCallback(
		async (dir: string) => {
			if (!requireTauri()) return;

			const runOpen = async () => {
				try {
					const manifestPath = await join(dir, PROJECT_MANIFEST_FILENAME);
					let hasManifest = false;
					try {
						hasManifest = await exists(manifestPath);
					} catch (e) {
						logError(`Failed to check project manifest: ${dir}`, e);
						toast.error(
							t(
								"error.folderProjectUnavailable",
								"The project folder is not accessible",
							),
						);
						return;
					}
					if (hasManifest) {
						await loadProjectFromDir(dir);
						return;
					}

					let entries: Awaited<ReturnType<typeof readDir>> | null = null;
					try {
						entries = await readDir(dir);
					} catch (e) {
						logError(`Failed to list project folder: ${dir}`, e);
						toast.error(
							t(
								"error.folderProjectUnavailable",
								"The project folder is not accessible",
							),
						);
						await removeRecentProject(dir);
						return;
					}
					if (!entries) return;
					const hasAudio = entries.some(
						(e) => e.isFile && AUDIO_EXTS.has(getFileExtension(e.name)),
					);
					const hasLyric = entries.some(
						(e) =>
							e.isFile &&
							(getFileExtension(e.name) === "ttml" ||
								getFileExtension(e.name) === "yaml" ||
								getFileExtension(e.name) === "yml"),
					);
					if (hasAudio || hasLyric) {
						await importProjectDir(dir);
						return;
					}

					toast.error(
						t(
							"error.folderProjectNotFound",
							"The selected folder is not a valid project folder (no project.json, TTML, YAML, or audio files)",
						),
					);
					await removeRecentProject(dir);
				} catch (e) {
					logError("Failed to open folder project", e);
					toast.error(
						t(
							"error.folderProjectOpenFailed",
							"Failed to open project folder: {reason}",
							{ reason: String((e as Error)?.message ?? e) },
						),
					);
				}
			};

			if (isDirty) {
				store.set(confirmDialogAtom, {
					open: true,
					title: t("confirmDialog.openFile.title", "Confirm Open File"),
					description: t(
						"confirmDialog.openFile.description",
						"You have unsaved changes. If you proceed, these changes will be lost. Are you sure you want to open a new file?",
					),
					onConfirm: runOpen,
				});
			} else {
				await runOpen();
			}
		},
		[requireTauri, isDirty, store, t, loadProjectFromDir, importProjectDir],
	);

	const [workspaceProjects, setWorkspaceProjects] = useAtom(
		workspaceProjectsAtom,
	);
	const [workspaceDir, setWorkspaceDir] = useAtom(workspaceDirAtom);
	const [workspaceScanning, setWorkspaceScanning] = useAtom(
		workspaceScanningAtom,
	);

	const openWorkspace = useCallback(async () => {
		if (!requireTauri()) return;

		const runScan = async () => {
			try {
				const dir = await open({
					directory: true,
					multiple: false,
					title: t(
						"dialog.openWorkspace.title",
						"Select a workspace folder containing projects",
					),
				});
				if (!dir || typeof dir !== "string") return;

				setWorkspaceScanning(true);
				setWorkspaceDir(dir);
				try {
					const results = await scanProjectWorkspace(dir);
					setWorkspaceProjects(results);
					if (results.length === 0) {
						toast.info(
							t(
								"workspace.noProjectsFound",
								"No projects found in this folder",
							),
						);
					} else {
						toast.success(
							t("workspace.projectsFound", "Found {count} project(s)", {
								count: results.length,
							}),
						);
					}
				} finally {
					setWorkspaceScanning(false);
				}
			} catch (e) {
				logError("Failed to scan workspace", e);
				toast.error(
					t("workspace.scanFailed", "Failed to scan workspace folder"),
				);
				setWorkspaceScanning(false);
			}
		};

		if (isDirty) {
			store.set(confirmDialogAtom, {
				open: true,
				title: t("confirmDialog.openFile.title", "Confirm Open File"),
				description: t(
					"confirmDialog.openFile.description",
					"You have unsaved changes. If you proceed, these changes will be lost. Are you sure you want to open a new file?",
				),
				onConfirm: runScan,
			});
		} else {
			await runScan();
		}
	}, [
		requireTauri,
		isDirty,
		store,
		t,
		setWorkspaceDir,
		setWorkspaceProjects,
		setWorkspaceScanning,
	]);

	const rescanWorkspace = useCallback(async () => {
		if (!workspaceDir) return;
		setWorkspaceScanning(true);
		try {
			const results = await scanProjectWorkspace(workspaceDir);
			setWorkspaceProjects(results);
		} catch (e) {
			logError("Failed to rescan workspace", e);
		} finally {
			setWorkspaceScanning(false);
		}
	}, [workspaceDir, setWorkspaceProjects, setWorkspaceScanning]);

	const createProject = useCallback(async () => {
		if (!requireTauri()) return;

		const runCreate = async () => {
			try {
				audioEngine.unloadMusic();
				const dir = await open({
					directory: true,
					multiple: false,
					title: t(
						"dialog.createProject.title",
						"Select or create a folder for the new project",
					),
				});
				if (!dir || typeof dir !== "string") {
					return;
				}

				await mkdir(dir, { recursive: true });

				const manifestPath = await join(dir, PROJECT_MANIFEST_FILENAME);
				if (await exists(manifestPath)) {
					toast.info(
						t(
							"success.folderProjectAlreadyExists",
							"This folder is already a project, opening it instead",
						),
					);
					await loadProjectFromDir(dir);
					return;
				}

				const entries = await readDir(dir);
				const audioEntry = entries.find(
					(entry) =>
						entry.isFile && AUDIO_MIME_BY_EXT[getFileExtension(entry.name)],
				);
				const ttmlEntry = entries.find(
					(entry) => entry.isFile && getFileExtension(entry.name) === "ttml",
				);
				const yamlEntry = entries.find(
					(entry) =>
						entry.isFile &&
						(getFileExtension(entry.name) === "yaml" ||
							getFileExtension(entry.name) === "yml"),
				);
				const lyricEntry = ttmlEntry ?? yamlEntry;
				const lyricsfileFileName = yamlEntry?.name;

				let lyricData: TTMLLyric = { lyricLines: [], metadata: [] };
				let lyricFileName = "";
				let isLyricsfile = false;

				if (lyricEntry) {
					const lyricPath = await join(dir, lyricEntry.name);
					try {
						const lyricText = await readTextFile(lyricPath);
						const ext = getFileExtension(lyricEntry.name);
						isLyricsfile = ext === "yaml" || ext === "yml";
						if (isLyricsfile) {
							lyricData = parseLyricsfile(lyricText);
						} else {
							const parsed = parseLyric(lyricText);
							lyricData = {
								metadata: parsed.metadata.map((meta) => ({ ...meta })),
								lyricLines: parsed.lyricLines.map((line) => ({
									...line,
									words: line.words.map((word) => ({
										...word,
										id: uid(),
										obscene: word.obscene ?? false,
										emptyBeat: word.emptyBeat ?? 0,
									})),
									ignoreSync: false,
									id: uid(),
								})),
								marks: parsed.marks,
								sections: parsed.sections,
								reversedSyncLineIds: parsed.reversedSyncLineIds,
							};
						}
						lyricFileName = lyricEntry.name;
					} catch (e) {
						logError(`Error when parsing lyric file: ${lyricEntry.name}`, e);
						toast.error(
							t("error.folderProjectLyricParse", "Failed to parse lyric file"),
						);
						return;
					}
				}

				let audioFile: File | null = null;
				let audioFileName = "";
				if (audioEntry) {
					const audioPath = await join(dir, audioEntry.name);
					try {
						const audioBytes = await readFile(audioPath);
						const ext = getFileExtension(audioEntry.name);
						audioFile = new File([audioBytes as BlobPart], audioEntry.name, {
							type: AUDIO_MIME_BY_EXT[ext] ?? "",
						});
						audioFileName = audioEntry.name;
					} catch (e) {
						logError(`Failed to read audio file: ${audioEntry.name}`, e);
						toast.warning(
							t(
								"error.folderProjectAudioReadFailed",
								"Failed to read project audio file",
							),
						);
					}
				}

				store.set(projectIdAtom, uid());
				store.set(newLyricLinesAtom, lyricData);
				store.set(
					reverseSyncLineIdsAtom,
					new Set(lyricData.reversedSyncLineIds ?? []),
				);
				store.set(saveFileNameAtom, lyricFileName);
				store.set(
					activeFileKindAtom,
					isLyricsfile ? ActiveFileKind.Lyricsfile : ActiveFileKind.TTML,
				);

				if (audioFile) {
					try {
						await audioEngine.loadMusic(audioFile);
					} catch (e) {
						logError("Failed to load project audio", e);
						toast.error(
							t(
								"error.folderProjectAudioLoadFailed",
								"Failed to load project audio",
							),
						);
					}
				}

				const suggested = getSuggestedTtmlFileName(lyricData.metadata);
				const nextManifest: ProjectManifest = {
					version: 1,
					name: suggested?.baseName ?? getFileNameFromPath(dir),
					audioFile: audioFileName,
					lyricFile: lyricFileName,
					lyricsfileFile: lyricsfileFileName,
					ttmlFile: ttmlEntry?.name,
					createdAt: Date.now(),
					updatedAt: Date.now(),
				};
				await writeTextFile(
					manifestPath,
					JSON.stringify(nextManifest, null, 2),
				);

				setActiveDir(dir);
				setManifest(nextManifest);

				if (!audioEntry) {
					toast.info(
						t(
							"error.folderProjectNoAudio",
							"Load an audio file before saving the project",
						),
					);
				}

				toast.success(t("success.folderProjectCreated", "Project created"));
				log(`Created folder project: ${nextManifest.name} (${dir})`);
				void upsertRecentProject({
					dir,
					name: nextManifest.name,
					audioFile: nextManifest.audioFile,
					lyricFile: nextManifest.lyricFile,
					lyricsfileFile: nextManifest.lyricsfileFile,
					ttmlFile: nextManifest.ttmlFile,
					updatedAt: nextManifest.updatedAt,
				});
			} catch (e) {
				logError("Failed to create folder project", e);
				toast.error(
					t("error.folderProjectCreateFailed", "Failed to create project"),
				);
			}
		};

		if (isDirty) {
			store.set(confirmDialogAtom, {
				open: true,
				title: t("confirmDialog.newProject.title", "Confirm Create Project"),
				description: t(
					"confirmDialog.newProject.description",
					"You have unsaved changes. If you proceed, these changes will be lost. Are you sure you want to create a new project?",
				),
				onConfirm: runCreate,
			});
		} else {
			await runCreate();
		}
	}, [
		requireTauri,
		isDirty,
		store,
		t,
		setActiveDir,
		setManifest,
		loadProjectFromDir,
	]);

	const saveProject = useCallback(async () => {
		if (!requireTauri()) return;

		let dir = activeDir;
		if (!dir) {
			const picked = await open({
				directory: true,
				multiple: false,
				title: t(
					"dialog.saveProject.title",
					"Select or create a project folder",
				),
			});
			if (!picked || typeof picked !== "string") {
				return;
			}
			dir = picked;
		}

		const rawAudio = store.get(loadedAudioAtom);
		const audioFile = rawAudio instanceof File ? rawAudio : null;
		const lyric = store.get(lyricLinesAtom);
		const hasLyricContent = lyric.lyricLines.length > 0;
		const shouldWriteLyric = hasLyricContent;
		const fileKind = store.get(activeFileKindAtom);
		const isLyricsfile = fileKind === ActiveFileKind.Lyricsfile;
		const targetExt = isLyricsfile ? "lyricsfile.yaml" : "ttml";
		const suggested = getSuggestedTtmlFileName(lyric.metadata);
		const lyricFileName = shouldWriteLyric
			? ensureExtension(
					sanitizeFileName(
						store.get(saveFileNameAtom) || suggested?.baseName || "lyric",
					),
					targetExt,
				)
			: "";
		const lyricText = shouldWriteLyric ? generateLyricText() : null;
		if (shouldWriteLyric && lyricText == null) {
			return;
		}
		const audioFileName = audioFile
			? ensureExtension(
					sanitizeFileName(audioFile.name),
					getFileExtension(audioFile.name),
				)
			: "";

		// If the active format changed since the last save (ttml <-> yaml),
		// the old file is intentionally NOT deleted below (extension mismatch
		// skips the delete branch) so it survives as a companion file. Without
		// tracking it here as `ttmlFile`/`lyricsfileFile`, the manifest used to
		// forget it ever existed the moment `lyricFile` pointed at the new
		// format, so only one of the two files ever showed up anywhere in the
		// UI even though both were still on disk.
		const previousExt = manifest?.lyricFile
			? getFileExtension(manifest.lyricFile)
			: null;
		let nextTtmlFile = manifest?.ttmlFile;
		let nextLyricsfileFile = manifest?.lyricsfileFile;
		if (isLyricsfile) {
			nextLyricsfileFile = lyricFileName || nextLyricsfileFile;
			if (previousExt === "ttml") nextTtmlFile = manifest?.lyricFile;
		} else {
			nextTtmlFile = lyricFileName || nextTtmlFile;
			if (previousExt === "yaml" || previousExt === "yml")
				nextLyricsfileFile = manifest?.lyricFile;
		}

		try {
			await mkdir(dir, { recursive: true });

			if (
				manifest?.lyricFile &&
				manifest.lyricFile !== lyricFileName &&
				getFileExtension(manifest.lyricFile) === targetExt
			) {
				const oldLyricPath = await join(dir, manifest.lyricFile);
				if (await exists(oldLyricPath)) {
					await remove(oldLyricPath).catch(() => {});
				}
			}
			if (
				manifest?.audioFile &&
				audioFileName &&
				manifest.audioFile !== audioFileName
			) {
				const oldAudioPath = await join(dir, manifest.audioFile);
				if (await exists(oldAudioPath)) {
					await remove(oldAudioPath).catch(() => {});
				}
			}

			if (lyricFileName && lyricText != null) {
				const lyricPath = await join(dir, lyricFileName);
				await writeTextFile(lyricPath, lyricText);
			}

			if (audioFile && audioFileName) {
				const audioPath = await join(dir, audioFileName);
				let audioBytes: Uint8Array;
				try {
					audioBytes = new Uint8Array(await audioFile.arrayBuffer());
				} catch {
					const existingAudioPath = await join(dir, audioFileName);
					audioBytes = await readFile(existingAudioPath);
				}
				await writeFile(audioPath, audioBytes);
			}

			const nextManifest: ProjectManifest = {
				version: 1,
				name: suggested?.baseName ?? manifest?.name ?? "Untitled",
				audioFile: audioFileName,
				lyricFile: lyricFileName,
				lyricsfileFile: nextLyricsfileFile,
				ttmlFile: nextTtmlFile,
				createdAt: manifest?.createdAt ?? Date.now(),
				updatedAt: Date.now(),
			};

			const manifestPath = await join(dir, PROJECT_MANIFEST_FILENAME);
			await writeTextFile(manifestPath, JSON.stringify(nextManifest, null, 2));

			setActiveDir(dir);
			setManifest(nextManifest);
			store.set(saveFileNameAtom, lyricFileName);
			store.set(
				activeFileKindAtom,
				isLyricsfile ? ActiveFileKind.Lyricsfile : ActiveFileKind.TTML,
			);
			store.set(undoableLyricLinesAtom, RESET);

			toast.success(t("success.folderProjectSaved", "Project saved"));
			log(`Saved folder project: ${nextManifest.name} (${dir})`);
			void upsertRecentProject({
				dir,
				name: nextManifest.name,
				audioFile: nextManifest.audioFile,
				lyricFile: nextManifest.lyricFile,
				lyricsfileFile: nextManifest.lyricsfileFile,
				ttmlFile: nextManifest.ttmlFile,
				updatedAt: nextManifest.updatedAt,
			});
		} catch (e) {
			logError("Failed to save folder project", e);
			toast.error(t("error.folderProjectSaveFailed", "Failed to save project"));
		}
	}, [
		requireTauri,
		activeDir,
		manifest,
		generateLyricText,
		store,
		t,
		setActiveDir,
		setManifest,
	]);

	const saveLyricsOnly = useCallback(
		async (options?: { silent?: boolean }): Promise<boolean> => {
			if (!activeDir || !manifest) {
				return true;
			}
			if (!isTauri()) return true;

			const lyric = store.get(lyricLinesAtom);
			if (lyric.lyricLines.length === 0) {
				if (!options?.silent) {
					toast.info(
						t(
							"error.folderProjectNoLyric",
							"Add a lyric file before saving the project",
						),
					);
				}
				return false;
			}

			const lyricText = generateLyricText();
			if (lyricText == null) {
				return false;
			}

			try {
				const fileKind = store.get(activeFileKindAtom);
				const isLyricsfile = fileKind === ActiveFileKind.Lyricsfile;
				const targetExt = isLyricsfile ? "lyricsfile.yaml" : "ttml";
				const suggested = getSuggestedTtmlFileName(lyric.metadata);
				const lyricFileName = ensureExtension(
					sanitizeFileName(
						store.get(saveFileNameAtom) || suggested?.baseName || "lyric",
					),
					targetExt,
				);

				// Same dual-file preservation as saveProject: track the sibling
				// file's name instead of losing it when the active format changes.
				const previousExt = manifest.lyricFile
					? getFileExtension(manifest.lyricFile)
					: null;
				let nextTtmlFile = manifest.ttmlFile;
				let nextLyricsfileFile = manifest.lyricsfileFile;
				if (isLyricsfile) {
					nextLyricsfileFile = lyricFileName;
					if (previousExt === "ttml") nextTtmlFile = manifest.lyricFile;
				} else {
					nextTtmlFile = lyricFileName;
					if (previousExt === "yaml" || previousExt === "yml")
						nextLyricsfileFile = manifest.lyricFile;
				}

				if (
					manifest.lyricFile &&
					manifest.lyricFile !== lyricFileName &&
					getFileExtension(manifest.lyricFile) === targetExt
				) {
					const oldLyricPath = await join(activeDir, manifest.lyricFile);
					if (await exists(oldLyricPath)) {
						await remove(oldLyricPath).catch(() => {});
					}
				}

				const lyricPath = await join(activeDir, lyricFileName);
				await writeTextFile(lyricPath, lyricText);

				const nextManifest: ProjectManifest = {
					...manifest,
					lyricFile: lyricFileName,
					lyricsfileFile: nextLyricsfileFile,
					ttmlFile: nextTtmlFile,
					updatedAt: Date.now(),
				};
				const manifestPath = await join(activeDir, PROJECT_MANIFEST_FILENAME);
				await writeTextFile(
					manifestPath,
					JSON.stringify(nextManifest, null, 2),
				);
				setManifest(nextManifest);
				store.set(saveFileNameAtom, lyricFileName);
				store.set(
					activeFileKindAtom,
					isLyricsfile ? ActiveFileKind.Lyricsfile : ActiveFileKind.TTML,
				);
				store.set(undoableLyricLinesAtom, RESET);

				if (!options?.silent) {
					toast.success(
						t("success.lyricsSavedToProject", "Lyrics saved to project"),
					);
				}
				return false;
			} catch (e) {
				logError("Failed to save lyrics into project", e);
				if (!options?.silent) {
					toast.error(
						t("error.folderProjectSaveFailed", "Failed to save project"),
					);
				}
				return false;
			}
		},
		[activeDir, manifest, generateLyricText, setManifest, store, t],
	);

	return {
		openProject,
		openProjectFromDir,
		importProjectDir,
		createProject,
		saveProject,
		saveLyricsOnly,
		openWorkspace,
		rescanWorkspace,
		workspaceProjects,
		workspaceDir,
		workspaceScanning,
	};
};
