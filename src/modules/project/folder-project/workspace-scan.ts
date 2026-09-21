import { isTauri } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { exists, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import {
	getFileExtension,
	isProjectManifest,
} from "$/modules/project/folder-project/manifest";
import { PROJECT_MANIFEST_FILENAME } from "$/modules/project/folder-project/types";

const AUDIO_EXTS = new Set(["flac", "wav", "mp3", "m4a", "aac", "ogg", "opus"]);
const MAX_WORKSPACE_PROJECTS = 100;

export interface ScannedProject {
	dir: string;
	name: string;
	audioFile: string;
	lyricFile: string;
	updatedAt: number;
	hasManifest: boolean;
}

export async function scanProjectWorkspace(
	rootDir: string,
): Promise<ScannedProject[]> {
	if (!isTauri() || !rootDir) return [];
	const results: ScannedProject[] = [];

	let entries: Awaited<ReturnType<typeof readDir>> = [];
	try {
		entries = await readDir(rootDir);
	} catch {
		return [];
	}

	for (const entry of entries) {
		if (!entry.isDirectory) continue;
		if (results.length >= MAX_WORKSPACE_PROJECTS) break;
		try {
			const subDir = await join(rootDir, entry.name);
			const scanned = await scanOneProjectDir(subDir, entry.name);
			if (scanned) {
				results.push(scanned);
			}
		} catch {}
	}

	results.sort((a, b) => b.updatedAt - a.updatedAt);
	return results;
}

async function scanOneProjectDir(
	dir: string,
	fallbackName: string,
): Promise<ScannedProject | null> {
	let subEntries: Awaited<ReturnType<typeof readDir>> = [];
	try {
		subEntries = await readDir(dir);
	} catch {
		return null;
	}

	const ttmlFiles = subEntries.filter(
		(e) => e.isFile && getFileExtension(e.name) === "ttml",
	);
	const audioFile = subEntries.find(
		(e) => e.isFile && AUDIO_EXTS.has(getFileExtension(e.name)),
	);

	let manifestPath: string;
	try {
		manifestPath = await join(dir, PROJECT_MANIFEST_FILENAME);
	} catch {
		return null;
	}

	let manifestExists = false;
	try {
		manifestExists = await exists(manifestPath);
	} catch {
		manifestExists = false;
	}

	if (manifestExists) {
		try {
			const text = await readTextFile(manifestPath);
			const parsed = JSON.parse(text) as unknown;
			if (isProjectManifest(parsed)) {
				const lyricStillExists = parsed.lyricFile
					? subEntries.some((e) => e.isFile && e.name === parsed.lyricFile)
					: false;
				const audioStillExists = parsed.audioFile
					? subEntries.some((e) => e.isFile && e.name === parsed.audioFile)
					: false;
				const activeLyric =
					(lyricStillExists ? parsed.lyricFile : ttmlFiles[0]?.name) ?? "";
				return {
					dir,
					name: parsed.name || fallbackName,
					audioFile: audioStillExists ? parsed.audioFile : "",
					lyricFile: activeLyric,
					updatedAt: parsed.updatedAt ?? 0,
					hasManifest: true,
				};
			}
		} catch {}
	}

	if (ttmlFiles.length > 0 || audioFile) {
		return {
			dir,
			name: fallbackName,
			audioFile: audioFile?.name ?? "",
			lyricFile: ttmlFiles[0]?.name ?? "",
			updatedAt: 0,
			hasManifest: false,
		};
	}

	return null;
}
