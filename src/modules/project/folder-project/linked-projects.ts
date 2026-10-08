import { isTauri } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { readDir, readTextFile, remove } from "@tauri-apps/plugin-fs";
import { error as logError } from "$/utils/logging";
import { assertSafePath, isProjectManifest } from "./manifest";
import { removeRecentProject } from "./recent-projects";
import {
	LINKED_PROJECTS_DIRNAME,
	type LinkedProjectFiles,
	PROJECT_MANIFEST_FILENAME,
	type ProjectManifest,
} from "./types";

export interface LinkedProjectEntry {
	dir: string;
	manifest: ProjectManifest & { linked: LinkedProjectFiles };
}

export async function getLinkedProjectsRoot(): Promise<string> {
	return join(await appDataDir(), LINKED_PROJECTS_DIRNAME);
}

export async function getLinkedProjectDir(projectId: string): Promise<string> {
	return assertSafePath(await getLinkedProjectsRoot(), projectId);
}

export async function listLinkedProjects(): Promise<LinkedProjectEntry[]> {
	if (!isTauri()) return [];
	const root = await getLinkedProjectsRoot();
	let entries: Awaited<ReturnType<typeof readDir>>;
	try {
		entries = await readDir(root);
	} catch {
		return [];
	}
	const results: LinkedProjectEntry[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory) continue;
		try {
			const dir = assertSafePath(root, entry.name);
			const parsed: unknown = JSON.parse(
				await readTextFile(assertSafePath(dir, PROJECT_MANIFEST_FILENAME)),
			);
			if (isProjectManifest(parsed) && parsed.linked) {
				results.push({ dir, manifest: { ...parsed, linked: parsed.linked } });
			}
		} catch (e) {
			logError(`Skipped unreadable linked project: ${entry.name}`, e);
		}
	}
	return results.sort(
		(a, b) => (b.manifest.updatedAt ?? 0) - (a.manifest.updatedAt ?? 0),
	);
}

export async function removeLinkedProject(dir: string): Promise<void> {
	const root = await getLinkedProjectsRoot();
	const normalized = dir.replace(/\\/g, "/").replace(/\/+$/, "");
	const name = normalized.slice(normalized.lastIndexOf("/") + 1);
	if (assertSafePath(root, name) !== normalized) {
		throw new Error(`Not a linked project folder: ${dir}`);
	}
	await remove(normalized, { recursive: true });
	await removeRecentProject(dir);
}
