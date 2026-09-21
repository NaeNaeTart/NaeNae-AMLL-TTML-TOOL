import { isTauri } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { error as logError } from "$/utils/logging.ts";
import { isSafeProjectFileName } from "./manifest";
import type { RecentProjectEntry, RecentProjectFileStatus } from "./types";

export const RECENT_PROJECTS_STORAGE_KEY = "amll-ttml:recent-projects";
export const MAX_RECENT_PROJECTS = 50;

export type { RecentProjectEntry, RecentProjectFileStatus };

export function isRecentProjectEntry(
	value: unknown,
): value is RecentProjectEntry {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	if (
		typeof v.dir !== "string" ||
		v.dir.trim().length === 0 ||
		typeof v.name !== "string" ||
		typeof v.audioFile !== "string" ||
		typeof v.lyricFile !== "string" ||
		(typeof v.lastOpened !== "number" && typeof v.updatedAt !== "number")
	) {
		return false;
	}
	if (v.audioFile.length > 0 && !isSafeProjectFileName(v.audioFile)) {
		return false;
	}
	if (v.lyricFile.length > 0 && !isSafeProjectFileName(v.lyricFile)) {
		return false;
	}
	return true;
}

export async function getRecentProjectFileStatus(
	entry: RecentProjectEntry,
): Promise<RecentProjectFileStatus | null> {
	if (!isTauri()) {
		return {
			dirExists: true,
			audioFileExists: Boolean(entry.audioFile),
			lyricFileExists: Boolean(entry.lyricFile),
		};
	}
	const dirExists = await exists(entry.dir).catch(() => null);
	if (dirExists === null) {
		return null;
	}
	if (!dirExists) {
		return {
			dirExists: false,
			audioFileExists: false,
			lyricFileExists: false,
		};
	}
	const [audioFileExists, lyricFileExists] = await Promise.all([
		entry.audioFile
			? join(entry.dir, entry.audioFile)
					.then((p) => exists(p))
					.catch(() => null)
			: Promise.resolve(false),
		entry.lyricFile
			? join(entry.dir, entry.lyricFile)
					.then((p) => exists(p))
					.catch(() => null)
			: Promise.resolve(false),
	]);
	if (audioFileExists === null || lyricFileExists === null) {
		return null;
	}
	return {
		dirExists,
		audioFileExists,
		lyricFileExists,
	};
}

export function parseRecentProjectsRaw(
	raw: string | null,
): RecentProjectEntry[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isRecentProjectEntry).map((entry) => ({
			...entry,
			lastOpened: entry.lastOpened ?? entry.updatedAt ?? Date.now(),
			updatedAt: entry.updatedAt ?? entry.lastOpened ?? Date.now(),
		}));
	} catch {
		return [];
	}
}

export function saveRecentProjectsSync(entries: RecentProjectEntry[]): void {
	if (typeof localStorage === "undefined") return;
	try {
		const limited = entries.slice(0, MAX_RECENT_PROJECTS);
		localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(limited));
	} catch (e) {
		logError("Failed to save recent projects to storage", e);
	}
}

export async function getRecentProjects(): Promise<RecentProjectEntry[]> {
	try {
		const raw =
			typeof localStorage !== "undefined"
				? localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY)
				: null;
		return parseRecentProjectsRaw(raw);
	} catch (e) {
		logError("Failed to read recent projects from storage", e);
		return [];
	}
}

export async function upsertRecentProject(
	entry: RecentProjectEntry,
): Promise<void> {
	try {
		const list = await getRecentProjects();
		const normalized: RecentProjectEntry = {
			...entry,
			lastOpened: entry.lastOpened ?? entry.updatedAt ?? Date.now(),
			updatedAt: entry.updatedAt ?? entry.lastOpened ?? Date.now(),
		};
		const filtered = list.filter((p) => p.dir !== normalized.dir);
		const next = [normalized, ...filtered].slice(0, MAX_RECENT_PROJECTS);
		saveRecentProjectsSync(next);
	} catch (e) {
		logError("Failed to upsert recent project", e);
	}
}

export async function removeRecentProject(dir: string): Promise<void> {
	try {
		const list = await getRecentProjects();
		const next = list.filter((p) => p.dir !== dir);
		saveRecentProjectsSync(next);
	} catch (e) {
		logError("Failed to remove recent project", e);
	}
}
