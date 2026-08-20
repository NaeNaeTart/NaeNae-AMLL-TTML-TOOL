import { isTauri } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { error as logError } from "$/utils/logging.ts";

export interface RecentProjectEntry {
	dir: string;
	name: string;
	audioFile: string;
	lyricFile: string;
	lyricsfileFile?: string;
	ttmlFile?: string;
	updatedAt: number;
}

const RECENT_PROJECTS_FILE = "recent-projects.json";
const MAX_RECENT_PROJECTS = 50;

export interface RecentProjectFileStatus {
	dirExists: boolean;
	audioFileExists: boolean;
	lyricFileExists: boolean;
	lyricsfileFileExists: boolean;
	ttmlFileExists: boolean;
}

export async function getRecentProjectFileStatus(
	entry: RecentProjectEntry,
): Promise<RecentProjectFileStatus> {
	const dirExists = await exists(entry.dir).catch(() => false);
	if (!dirExists) {
		return {
			dirExists: false,
			audioFileExists: false,
			lyricFileExists: false,
			lyricsfileFileExists: false,
			ttmlFileExists: false,
		};
	}
	const [audioFileExists, lyricFileExists, lyricsfileFileExists, ttmlFileExists] =
		await Promise.all([
			entry.audioFile
				? exists(await join(entry.dir, entry.audioFile)).catch(() => false)
				: Promise.resolve(false),
			entry.lyricFile
				? exists(await join(entry.dir, entry.lyricFile)).catch(() => false)
				: Promise.resolve(false),
			entry.lyricsfileFile
				? exists(await join(entry.dir, entry.lyricsfileFile)).catch(
						() => false,
					)
				: Promise.resolve(false),
			entry.ttmlFile
				? exists(await join(entry.dir, entry.ttmlFile)).catch(() => false)
				: Promise.resolve(false),
		]);
	return {
		dirExists,
		audioFileExists,
		lyricFileExists,
		lyricsfileFileExists,
		ttmlFileExists,
	};
}

function isRecentProjectEntry(value: unknown): value is RecentProjectEntry {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.dir === "string" &&
		typeof v.name === "string" &&
		typeof v.audioFile === "string" &&
		typeof v.lyricFile === "string" &&
		typeof v.updatedAt === "number"
	);
}

async function getRecentProjectsPath(): Promise<string> {
	const dir = await appDataDir();
	await mkdir(dir, { recursive: true }).catch(() => {});
	return join(dir, RECENT_PROJECTS_FILE);
}

export async function getRecentProjects(): Promise<RecentProjectEntry[]> {
	if (!isTauri()) return [];
	try {
		const path = await getRecentProjectsPath();
		if (!(await exists(path))) return [];
		const text = await readTextFile(path);
		const parsed = JSON.parse(text) as unknown;
		if (!Array.isArray(parsed)) return [];
		const entries = parsed.filter(isRecentProjectEntry);
		const dirChecks = await Promise.all(
			entries.map((entry) => exists(entry.dir).catch(() => false)),
		);
		const live = entries.filter((_, i) => dirChecks[i]);
		if (live.length !== entries.length) {
			await writeTextFile(path, JSON.stringify(live, null, 2)).catch(
				(e) => logError("Failed to prune stale recent project entries", e),
			);
		}
		return live;
	} catch (e) {
		logError("Failed to read recent projects list", e);
		return [];
	}
}

export async function upsertRecentProject(
	entry: RecentProjectEntry,
): Promise<void> {
	if (!isTauri()) return;
	try {
		const list = await getRecentProjects();
		const next = [
			entry,
			...list.filter((p) => p.dir !== entry.dir),
		].slice(0, MAX_RECENT_PROJECTS);
		const path = await getRecentProjectsPath();
		await writeTextFile(path, JSON.stringify(next, null, 2));
	} catch (e) {
		logError("Failed to update recent projects list", e);
	}
}

export async function removeRecentProject(dir: string): Promise<void> {
	if (!isTauri()) return;
	try {
		const list = await getRecentProjects();
		const next = list.filter((p) => p.dir !== dir);
		const path = await getRecentProjectsPath();
		await writeTextFile(path, JSON.stringify(next, null, 2));
	} catch (e) {
		logError("Failed to remove recent project entry", e);
	}
}
