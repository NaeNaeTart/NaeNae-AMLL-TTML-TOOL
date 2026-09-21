import { isTauri } from "@tauri-apps/api/core";
import { readDir, rename, stat, writeTextFile } from "@tauri-apps/plugin-fs";
import type { getDefaultStore } from "jotai";
import { lyricLinesAtom } from "$/states/main";
import { log, error as logError } from "$/utils/logging";
import { AUDIO_EXTS } from "./audio-io";
import {
	assertSafePath,
	getFileExtension,
	isSafeProjectFileName,
} from "./manifest";
import { pickFolderName, resolveProjectName } from "./project-naming";
import { removeRecentProject, upsertRecentProject } from "./recent-projects";
import { activeProjectDirAtom, activeProjectManifestAtom } from "./state";
import { PROJECT_MANIFEST_FILENAME, type ProjectManifest } from "./types";

type Store = ReturnType<typeof getDefaultStore>;

let renameInFlight = false;

export function splitDirPath(dir: string): { parent: string; base: string } {
	const normalized = dir.replace(/\\/g, "/").replace(/\/+$/, "");
	const idx = normalized.lastIndexOf("/");
	if (idx <= 0) return { parent: "", base: normalized };
	return { parent: normalized.slice(0, idx), base: normalized.slice(idx + 1) };
}

export async function resolveManifestFiles(
	dir: string,
	manifest: ProjectManifest,
): Promise<ProjectManifest> {
	let entries: Awaited<ReturnType<typeof readDir>>;
	try {
		entries = await readDir(dir);
	} catch {
		return manifest;
	}
	const files = entries
		.filter((e) => e.isFile && isSafeProjectFileName(e.name))
		.map((e) => e.name)
		.sort((a, b) => a.localeCompare(b));
	const present = new Set(files.map((n) => n.toLowerCase()));

	let { audioFile, lyricFile } = manifest;

	if (lyricFile && !present.has(lyricFile.toLowerCase())) {
		const ttmls = files.filter((n) => getFileExtension(n) === "ttml");
		if (ttmls.length > 0) lyricFile = ttmls[0];
	}

	if (audioFile && !present.has(audioFile.toLowerCase())) {
		const audios = files.filter((n) => AUDIO_EXTS.has(getFileExtension(n)));
		let match: string | undefined;
		const wantedSize = manifest.song?.audioSize;
		if (wantedSize !== undefined) {
			for (const name of audios) {
				const s = await stat(assertSafePath(dir, name)).catch(() => null);
				if (s?.size === wantedSize) {
					match = name;
					break;
				}
			}
		}
		if (!match && audios.length === 1) match = audios[0];
		if (match) audioFile = match;
	}

	if (audioFile === manifest.audioFile && lyricFile === manifest.lyricFile) {
		return manifest;
	}
	return { ...manifest, audioFile, lyricFile };
}

export async function syncProjectFolderName(store: Store): Promise<void> {
	if (!isTauri() || renameInFlight) return;
	const dir = store.get(activeProjectDirAtom);
	const manifest = store.get(activeProjectManifestAtom);
	if (!dir || !manifest?.folderName) return;

	const { parent, base } = splitDirPath(dir);
	if (!parent || base !== manifest.folderName) return;

	const lyric = store.get(lyricLinesAtom);
	const resolved = resolveProjectName({ metadata: lyric.metadata });
	if (resolved.isTemplate) return;

	renameInFlight = true;
	try {
		const siblings = await readDir(parent);
		const taken = new Set(
			siblings.map((e) => e.name).filter((n) => n !== base),
		);
		const target = pickFolderName(resolved, taken);
		if (target === base) return;

		const nextDir = assertSafePath(parent, target);
		await rename(dir, nextDir);

		const nextManifest: ProjectManifest = {
			...manifest,
			folderName: target,
			updatedAt: Date.now(),
		};
		await writeTextFile(
			assertSafePath(nextDir, PROJECT_MANIFEST_FILENAME),
			JSON.stringify(nextManifest, null, 2),
		);

		store.set(activeProjectDirAtom, nextDir);
		store.set(activeProjectManifestAtom, nextManifest);
		await removeRecentProject(dir);
		await upsertRecentProject({
			dir: nextDir,
			name: nextManifest.name,
			audioFile: nextManifest.audioFile,
			lyricFile: nextManifest.lyricFile,
			lastOpened: Date.now(),
			updatedAt: nextManifest.updatedAt,
		});
		log(`Renamed project folder: ${base} -> ${target}`);
	} catch (e) {
		logError("Project folder rename skipped", e);
	} finally {
		renameInFlight = false;
	}
}
