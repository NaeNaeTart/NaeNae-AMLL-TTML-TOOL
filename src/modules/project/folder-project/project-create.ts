import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { mkdir, readDir } from "@tauri-apps/plugin-fs";
import type { getDefaultStore } from "jotai";
import { toast } from "react-toastify";
import { uid } from "uid";
import { folderProjectsEnabledAtom } from "$/modules/settings/states";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main";
import { log, error as logError } from "$/utils/logging";
import { assertSafePath } from "./manifest";
import { pickFolderName, resolveProjectName } from "./project-naming";
import { saveProject } from "./project-save";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
	createProjectPromptAtom,
	dismissedProjectPromptKeyAtom,
	pendingAudioFileAtom,
	projectAudioFileAtom,
} from "./state";
import { PROJECT_MANIFEST_APP_ID, type ProjectManifest } from "./types";

type Store = ReturnType<typeof getDefaultStore>;
type TFunc = (
	key: string,
	fallback?: string,
	options?: Record<string, unknown>,
) => string;

function getPromptKey(store: Store, audio: File): string {
	const lyric = store.get(lyricLinesAtom);
	const first = lyric.lyricLines[0]?.id ?? "";
	return `${audio.name}:${audio.size}:${lyric.lyricLines.length}:${first}`;
}

export function maybePromptCreateProject(store: Store): void {
	if (!isTauri()) return;
	if (!store.get(folderProjectsEnabledAtom)) return;
	if (store.get(activeProjectDirAtom)) return;
	if (store.get(createProjectPromptAtom)) return;

	const audio = store.get(pendingAudioFileAtom);
	if (!audio) return;
	if (store.get(lyricLinesAtom).lyricLines.length === 0) return;
	if (store.get(dismissedProjectPromptKeyAtom) === getPromptKey(store, audio)) {
		return;
	}
	store.set(createProjectPromptAtom, true);
}

export function dismissCreateProjectPrompt(store: Store): void {
	const audio = store.get(pendingAudioFileAtom);
	if (audio) {
		store.set(dismissedProjectPromptKeyAtom, getPromptKey(store, audio));
	}
	store.set(createProjectPromptAtom, false);
}

export async function createProjectFromCurrent(
	store: Store,
	t: TFunc,
): Promise<boolean> {
	store.set(createProjectPromptAtom, false);
	if (!isTauri()) {
		toast.error(
			t(
				"error.folderProjectRequiresDesktop",
				"The project folder feature is only available in the desktop app",
			),
		);
		return false;
	}

	const audio = store.get(pendingAudioFileAtom);
	const lyric = store.get(lyricLinesAtom);
	if (!audio && lyric.lyricLines.length === 0) return false;

	try {
		const parent = await open({
			directory: true,
			multiple: false,
			recursive: true,
			title: t(
				"dialog.createProject.parentTitle",
				"Select where to create the project folder",
			),
		});
		if (!parent || typeof parent !== "string") return false;

		const entries = await readDir(parent);
		const resolved = resolveProjectName({
			metadata: lyric.metadata,
			lyricFileName: store.get(saveFileNameAtom),
			audioFileName: audio?.name,
		});
		const folderName = pickFolderName(
			resolved,
			new Set(entries.map((e) => e.name)),
		);
		const dir = assertSafePath(parent, folderName);
		await mkdir(dir, { recursive: false });

		const manifest: ProjectManifest = {
			version: 1,
			app: PROJECT_MANIFEST_APP_ID,
			projectId: uid(),
			name: resolved.name,
			audioFile: "",
			lyricFile: "",
			folderName,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		store.set(activeProjectDirAtom, dir);
		store.set(activeProjectManifestAtom, manifest);
		store.set(projectAudioFileAtom, audio);

		const saved = await saveProject(store, t);
		if (!saved) {
			store.set(activeProjectDirAtom, null);
			store.set(activeProjectManifestAtom, null);
			return false;
		}
		log(`Created project folder from import: ${folderName}`);
		return true;
	} catch (e) {
		logError("Failed to create project from imported files", e);
		toast.error(
			t("error.folderProjectCreateFailed", "Failed to create project"),
		);
		return false;
	}
}
