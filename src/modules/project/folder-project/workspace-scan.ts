import { join } from "@tauri-apps/api/path";
import { exists, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { getFileExtension } from "$/modules/project/folder-project/manifest";
import { isProjectManifest, PROJECT_MANIFEST_FILENAME } from "$/modules/project/folder-project/types";

import { stripKnownFileExtension } from "$/states/main";

const AUDIO_EXTS = new Set(["flac", "wav", "mp3", "m4a", "aac", "ogg", "opus"]);

export interface ScannedProject {
	dir: string;
	name: string;
	audioFile: string;
	lyricFile: string;
	lyricsfileFile?: string;
	updatedAt: number;
	hasManifest: boolean;
}

export async function scanProjectWorkspace(
	rootDir: string,
): Promise<ScannedProject[]> {
	const results: ScannedProject[] = [];
	const entries = await readDir(rootDir);

	for (const entry of entries) {
		if (!entry.isDirectory) continue;
		const subDir = await join(rootDir, entry.name);
		const scanned = await scanOneProjectDir(subDir, entry.name);
		if (scanned) results.push(scanned);
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
	const yamlFiles = subEntries.filter((e) => {
		if (!e.isFile) return false;
		const ext = getFileExtension(e.name);
		return ext === "yaml" || ext === "yml";
	});
	const audioFile = subEntries.find(
		(e) => e.isFile && AUDIO_EXTS.has(getFileExtension(e.name)),
	);

	const manifestPath = await join(dir, PROJECT_MANIFEST_FILENAME);
	if (await exists(manifestPath)) {
		try {
			const text = await readTextFile(manifestPath);
			const parsed = JSON.parse(text) as unknown;
			if (isProjectManifest(parsed)) {
				let matchedYaml = parsed.lyricsfileFile;
				if (!matchedYaml && parsed.lyricFile) {
					const lyricBase = stripKnownFileExtension(parsed.lyricFile).toLowerCase();
					const found = yamlFiles.find(
						(y) => stripKnownFileExtension(y.name).toLowerCase() === lyricBase,
					);
					if (found) matchedYaml = found.name;
				}
				const audioStillExists = parsed.audioFile
					? subEntries.some((e) => e.isFile && e.name === parsed.audioFile)
					: false;
				const lyricStillExists = parsed.lyricFile
					? subEntries.some((e) => e.isFile && e.name === parsed.lyricFile)
					: false;
				const yamlStillExists = matchedYaml
					? subEntries.some((e) => e.isFile && e.name === matchedYaml)
					: false;
				return {
					dir,
					name: parsed.name || fallbackName,
					audioFile: audioStillExists ? parsed.audioFile : "",
					lyricFile: lyricStillExists ? parsed.lyricFile : "",
					lyricsfileFile: yamlStillExists ? matchedYaml : undefined,
					updatedAt: parsed.updatedAt ?? 0,
					hasManifest: true,
				};
			}
		} catch {}
	}

	if (ttmlFiles.length > 0 || yamlFiles.length > 0 || audioFile) {
		const primaryTtml = ttmlFiles[0];
		let matchedYaml = yamlFiles[0];

		if (primaryTtml && yamlFiles.length > 0) {
			const ttmlBase = stripKnownFileExtension(primaryTtml.name).toLowerCase();
			const sameSongYaml = yamlFiles.find(
				(y) => stripKnownFileExtension(y.name).toLowerCase() === ttmlBase,
			);
			if (sameSongYaml) {
				matchedYaml = sameSongYaml;
			}
		}

		const lyricFile = primaryTtml?.name ?? (matchedYaml?.name ?? "");
		const lyricsfileFile = matchedYaml ? matchedYaml.name : undefined;

		return {
			dir,
			name: fallbackName,
			audioFile: audioFile?.name ?? "",
			lyricFile,
			lyricsfileFile,
			updatedAt: 0,
			hasManifest: false,
		};
	}

	return null;
}