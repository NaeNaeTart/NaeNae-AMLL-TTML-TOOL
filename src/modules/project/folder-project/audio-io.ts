import { isTauri } from "@tauri-apps/api/core";
import { exists, readFile, stat, writeFile } from "@tauri-apps/plugin-fs";
import {
	assertSafePath,
	getFileExtension,
} from "$/modules/project/folder-project/manifest";

export const AUDIO_MIME_BY_EXT: Record<string, string> = {
	flac: "audio/flac",
	wav: "audio/wav",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
	aac: "audio/aac",
	ogg: "audio/ogg",
	opus: "audio/opus",
};

export const AUDIO_EXTS = new Set(Object.keys(AUDIO_MIME_BY_EXT));
export const MAX_AUDIO_BYTES = 150 * 1024 * 1024;

export async function checkAudioFileSize(safePath: string): Promise<number> {
	if (!isTauri()) {
		throw new Error("Filesystem operations are only available on desktop");
	}
	const fileStat = await stat(safePath);
	if (!fileStat.isFile) {
		throw new Error(`Audio path is not a regular file: ${safePath}`);
	}
	if (fileStat.size > MAX_AUDIO_BYTES) {
		throw new Error(
			`Audio file size (${Math.round(fileStat.size / (1024 * 1024))}MB) exceeds 150MB safety limit`,
		);
	}
	return fileStat.size;
}

export async function loadProjectAudioFile(
	baseDir: string,
	relativeFileName: string,
): Promise<File | null> {
	if (!isTauri()) {
		throw new Error("Filesystem operations are only available on desktop");
	}
	const safePath = assertSafePath(baseDir, relativeFileName);
	const fileExists = await exists(safePath);
	if (!fileExists) {
		return null;
	}

	await checkAudioFileSize(safePath);

	const audioBytes = await readFile(safePath);
	if (audioBytes.byteLength > MAX_AUDIO_BYTES) {
		throw new Error(
			`Audio buffer size (${Math.round(audioBytes.byteLength / (1024 * 1024))}MB) exceeds 150MB safety limit`,
		);
	}

	const ext = getFileExtension(relativeFileName);
	return new File([audioBytes as BlobPart], relativeFileName, {
		type: AUDIO_MIME_BY_EXT[ext] ?? "",
	});
}

export async function writeProjectAudioFile(
	baseDir: string,
	relativeFileName: string,
	audioBytes: Uint8Array,
): Promise<string> {
	if (!isTauri()) {
		throw new Error("Filesystem operations are only available on desktop");
	}
	if (audioBytes.byteLength > MAX_AUDIO_BYTES) {
		throw new Error(
			`Cannot write audio file: size (${Math.round(audioBytes.byteLength / (1024 * 1024))}MB) exceeds 150MB safety limit`,
		);
	}
	const safePath = assertSafePath(baseDir, relativeFileName);
	await writeFile(safePath, audioBytes);
	return safePath;
}
