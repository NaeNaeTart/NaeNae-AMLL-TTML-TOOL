import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import type { getDefaultStore } from "jotai";
import { RESET } from "jotai-history";
import { toast } from "react-toastify";
import { uid } from "uid";
import { audioEngine } from "$/modules/audio/audio-engine";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import {
	allowConsecutiveBackgroundLinesAtom,
	lyricTextNormalizationOptionsAtom,
} from "$/modules/settings/states";
import { confirmDialogAtom } from "$/states/dialogs";
import {
	isDirtyAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	undoableLyricLinesAtom,
} from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";
import { log, error as logError } from "$/utils/logging";
import { writeProjectAudioFile } from "./audio-io";
import { generateProjectTtmlText, writeProjectLyricFile } from "./lyric-io";
import {
	assertSafePath,
	ensureExtension,
	getFileExtension,
	getFileNameFromPath,
	sanitizeFileName,
} from "./manifest";
import { syncProjectFolderName } from "./project-folder-sync";
import { getSongInfo } from "./project-naming";
import { loadProjectFromDir } from "./project-open";
import { upsertRecentProject } from "./recent-projects";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
	projectAudioFileAtom,
} from "./state";
import {
	PROJECT_MANIFEST_APP_ID,
	PROJECT_MANIFEST_FILENAME,
	type ProjectManifest,
} from "./types";
import { rememberProjectWorkspace } from "./workspace";

type Store = ReturnType<typeof getDefaultStore>;
type TFunc = (
	key: string,
	fallback?: string,
	options?: Record<string, unknown>,
) => string;

export function generateLyricTextFromStore(
	store: Store,
	t: TFunc,
): string | null {
	const lyric = store.get(lyricLinesAtom);
	try {
		return generateProjectTtmlText(
			lyric,
			store.get(lyricTextNormalizationOptionsAtom),
			{
				allowConsecutiveBackgroundLines: store.get(
					allowConsecutiveBackgroundLinesAtom,
				),
			},
		);
	} catch (e) {
		logError("Error generating TTML from store", e);
		toast.error(t("error.ttmlGenerateFailed", "Failed to generate TTML"));
		return null;
	}
}

export async function createProject(store: Store, t: TFunc): Promise<void> {
	if (!isTauri()) {
		toast.error(
			t(
				"error.folderProjectRequiresDesktop",
				"The project folder feature is only available in the desktop app",
			),
		);
		return;
	}

	const executeCreate = async () => {
		try {
			audioEngine.pauseMusic();
			const pickedDir = await open({
				directory: true,
				multiple: false,
				recursive: true,
				title: t(
					"dialog.createProject.title",
					"Select or create a folder for the new project",
				),
			});
			if (!pickedDir || typeof pickedDir !== "string") {
				return;
			}

			try {
				await mkdir(pickedDir, { recursive: true });
			} catch (e) {
				logError(`Failed to create project directory: ${pickedDir}`, e);
				toast.error(
					t("error.folderProjectCreateFailed", "Failed to create project"),
				);
				return;
			}

			const manifestPath = assertSafePath(pickedDir, PROJECT_MANIFEST_FILENAME);
			const hasManifest = await exists(manifestPath).catch(() => false);
			if (hasManifest) {
				toast.info(
					t(
						"success.folderProjectAlreadyExists",
						"This folder is already a project, opening it instead",
					),
				);
				await loadProjectFromDir(pickedDir, store, t);
				return;
			}

			const emptyLyric: TTMLLyric = { lyricLines: [], metadata: [] };
			store.set(projectIdAtom, uid());
			store.set(newLyricLinesAtom, emptyLyric);
			store.set(undoableLyricLinesAtom, RESET);
			store.set(saveFileNameAtom, "");
			store.set(projectAudioFileAtom, null);
			audioEngine.unloadMusic();

			const nextManifest: ProjectManifest = {
				version: 1,
				name: getFileNameFromPath(pickedDir),
				audioFile: "",
				lyricFile: "",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			try {
				await writeTextFile(
					manifestPath,
					JSON.stringify(nextManifest, null, 2),
				);
			} catch (e) {
				logError("Failed to write project manifest for new project", e);
				toast.error(
					t("error.folderProjectCreateFailed", "Failed to create project"),
				);
				return;
			}

			store.set(activeProjectDirAtom, pickedDir);
			store.set(activeProjectManifestAtom, nextManifest);
			await rememberProjectWorkspace(store, pickedDir);

			toast.success(t("success.folderProjectCreated", "Project created"));
			log(`Created folder project: ${nextManifest.name} (${pickedDir})`);
			await upsertRecentProject({
				dir: pickedDir,
				name: nextManifest.name,
				audioFile: nextManifest.audioFile,
				lyricFile: nextManifest.lyricFile,
				lastOpened: Date.now(),
				updatedAt: nextManifest.updatedAt,
			});
		} catch (e) {
			logError("Failed to create folder project", e);
			toast.error(
				t("error.folderProjectCreateFailed", "Failed to create project"),
			);
		}
	};

	if (store.get(isDirtyAtom)) {
		store.set(confirmDialogAtom, {
			open: true,
			title: t("confirmDialog.newProject.title", "Confirm Create Project"),
			description: t(
				"confirmDialog.newProject.description",
				"You have unsaved changes. If you proceed, these changes will be lost. Are you sure you want to create a new project?",
			),
			onConfirm: executeCreate,
		});
	} else {
		await executeCreate();
	}
}

export async function saveProject(store: Store, t: TFunc): Promise<boolean> {
	if (!isTauri()) {
		toast.error(
			t(
				"error.folderProjectRequiresDesktop",
				"The project folder feature is only available in the desktop app",
			),
		);
		return false;
	}

	let dir = store.get(activeProjectDirAtom);
	if (!dir) {
		const picked = await open({
			directory: true,
			multiple: false,
			recursive: true,
			title: t("dialog.saveProject.title", "Select or create a project folder"),
		});
		if (!picked || typeof picked !== "string") {
			return false;
		}
		dir = picked;
	}

	const manifest = store.get(activeProjectManifestAtom);
	const audioFile = store.get(projectAudioFileAtom);
	const lyric = store.get(lyricLinesAtom);
	const hasLyricContent = lyric.lyricLines.length > 0;
	const shouldWriteLyric = hasLyricContent;
	const suggested = getSuggestedTtmlFileName(lyric.metadata);

	const lyricFileName = shouldWriteLyric
		? ensureExtension(
				sanitizeFileName(
					store.get(saveFileNameAtom) || suggested?.baseName || "lyric",
				),
				"ttml",
			)
		: "";

	const lyricText = shouldWriteLyric
		? generateLyricTextFromStore(store, t)
		: null;
	if (shouldWriteLyric && lyricText == null) {
		return false;
	}

	const audioFileName = audioFile
		? ensureExtension(
				sanitizeFileName(audioFile.name),
				getFileExtension(audioFile.name),
			)
		: (manifest?.audioFile ?? "");

	try {
		await mkdir(dir, { recursive: true });

		if (
			manifest?.lyricFile &&
			manifest.lyricFile !== lyricFileName &&
			manifest.lyricFile !== "" &&
			lyricFileName !== ""
		) {
			try {
				const oldLyricPath = assertSafePath(dir, manifest.lyricFile);
				if (await exists(oldLyricPath)) {
					await remove(oldLyricPath);
				}
			} catch (e) {
				logError(
					`Failed to remove renamed lyric file: ${manifest.lyricFile}`,
					e,
				);
				toast.warning(
					t(
						"error.folderProjectCleanupFailed",
						"Saved, but the previous lyric file could not be removed",
					),
				);
			}
		}

		if (
			manifest?.audioFile &&
			audioFileName &&
			manifest.audioFile !== audioFileName &&
			manifest.audioFile !== ""
		) {
			try {
				const oldAudioPath = assertSafePath(dir, manifest.audioFile);
				if (await exists(oldAudioPath)) {
					await remove(oldAudioPath);
				}
			} catch (e) {
				logError(
					`Failed to remove renamed audio file: ${manifest.audioFile}`,
					e,
				);
				toast.warning(
					t(
						"error.folderProjectCleanupFailed",
						"Saved, but the previous audio file could not be removed",
					),
				);
			}
		}

		if (lyricFileName && lyricText != null) {
			await writeProjectLyricFile(dir, lyricFileName, lyricText);
		}

		if (audioFile && audioFileName) {
			const arrayBuffer = await audioFile.arrayBuffer();
			await writeProjectAudioFile(
				dir,
				audioFileName,
				new Uint8Array(arrayBuffer),
			);
		}

		const nextManifest: ProjectManifest = {
			...manifest,
			version: 1,
			app: PROJECT_MANIFEST_APP_ID,
			projectId: manifest?.projectId ?? uid(),
			name: suggested?.baseName ?? manifest?.name ?? "Untitled",
			audioFile: audioFileName,
			lyricFile: lyricFileName,
			song: getSongInfo(
				lyric.metadata,
				audioFile?.size ?? manifest?.song?.audioSize,
			),
			createdAt: manifest?.createdAt ?? Date.now(),
			updatedAt: Date.now(),
		};

		const manifestPath = assertSafePath(dir, PROJECT_MANIFEST_FILENAME);
		await writeTextFile(manifestPath, JSON.stringify(nextManifest, null, 2));

		store.set(activeProjectDirAtom, dir);
		store.set(activeProjectManifestAtom, nextManifest);
		await rememberProjectWorkspace(store, dir);
		store.set(saveFileNameAtom, lyricFileName);
		store.set(undoableLyricLinesAtom, RESET);

		toast.success(t("success.folderProjectSaved", "Project saved"));
		log(`Saved folder project: ${nextManifest.name} (${dir})`);
		await upsertRecentProject({
			dir,
			name: nextManifest.name,
			audioFile: nextManifest.audioFile,
			lyricFile: nextManifest.lyricFile,
			lastOpened: Date.now(),
			updatedAt: nextManifest.updatedAt,
		});
		await syncProjectFolderName(store);
		return true;
	} catch (e) {
		logError("Failed to save folder project", e);
		toast.error(t("error.folderProjectSaveFailed", "Failed to save project"));
		return false;
	}
}

export async function saveLyricsOnly(
	store: Store,
	t: TFunc,
	options?: { silent?: boolean },
): Promise<boolean> {
	const activeDir = store.get(activeProjectDirAtom);
	const manifest = store.get(activeProjectManifestAtom);
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

	const lyricText = generateLyricTextFromStore(store, t);
	if (lyricText == null) {
		return false;
	}

	try {
		const suggested = getSuggestedTtmlFileName(lyric.metadata);
		const lyricFileName = ensureExtension(
			sanitizeFileName(
				store.get(saveFileNameAtom) || suggested?.baseName || "lyric",
			),
			"ttml",
		);

		if (
			manifest.lyricFile &&
			manifest.lyricFile !== lyricFileName &&
			manifest.lyricFile !== ""
		) {
			try {
				const oldLyricPath = assertSafePath(activeDir, manifest.lyricFile);
				if (await exists(oldLyricPath)) {
					await remove(oldLyricPath);
				}
			} catch (e) {
				logError(
					`Failed to remove renamed lyric file: ${manifest.lyricFile}`,
					e,
				);
				if (!options?.silent) {
					toast.warning(
						t(
							"error.folderProjectCleanupFailed",
							"Saved, but the previous lyric file could not be removed",
						),
					);
				}
			}
		}

		await writeProjectLyricFile(activeDir, lyricFileName, lyricText);

		const nextManifest: ProjectManifest = {
			...manifest,
			app: PROJECT_MANIFEST_APP_ID,
			projectId: manifest.projectId ?? uid(),
			lyricFile: lyricFileName,
			song: getSongInfo(lyric.metadata, manifest.song?.audioSize),
			updatedAt: Date.now(),
		};
		const manifestPath = assertSafePath(activeDir, PROJECT_MANIFEST_FILENAME);
		await writeTextFile(manifestPath, JSON.stringify(nextManifest, null, 2));

		store.set(activeProjectManifestAtom, nextManifest);
		store.set(saveFileNameAtom, lyricFileName);
		store.set(undoableLyricLinesAtom, RESET);
		await syncProjectFolderName(store);

		if (!options?.silent) {
			toast.success(
				t("success.lyricsSavedToProject", "Lyrics saved to project"),
			);
		}
		return false;
	} catch (e) {
		logError("Failed to save lyrics into project", e);
		if (!options?.silent) {
			toast.error(t("error.folderProjectSaveFailed", "Failed to save project"));
		}
		return false;
	}
}

export async function renameProject(
	store: Store,
	nextName: string,
	t: TFunc,
): Promise<boolean> {
	if (!isTauri()) return false;
	const activeDir = store.get(activeProjectDirAtom);
	const manifest = store.get(activeProjectManifestAtom);
	if (!activeDir || !manifest) return false;

	const cleaned = sanitizeFileName(nextName);
	if (!cleaned || cleaned === manifest.name) return false;

	const nextManifest: ProjectManifest = {
		...manifest,
		name: cleaned,
		updatedAt: Date.now(),
	};

	try {
		const manifestPath = assertSafePath(activeDir, PROJECT_MANIFEST_FILENAME);
		await writeTextFile(manifestPath, JSON.stringify(nextManifest, null, 2));
	} catch (e) {
		logError("Failed to rename project", e);
		toast.error(t("error.folderProjectSaveFailed", "Failed to save project"));
		return false;
	}

	store.set(activeProjectManifestAtom, nextManifest);
	await upsertRecentProject({
		dir: activeDir,
		name: nextManifest.name,
		audioFile: nextManifest.audioFile,
		lyricFile: nextManifest.lyricFile,
		lastOpened: Date.now(),
		updatedAt: nextManifest.updatedAt,
	});
	toast.success(t("success.folderProjectSaved", "Project saved"));
	return true;
}
