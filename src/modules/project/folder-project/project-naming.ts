import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import type { TTMLMetadata } from "$/types/ttml";
import { isSafeProjectFileName, sanitizeFileName } from "./manifest";
import type { ProjectSongInfo } from "./types";

export const DEFAULT_PROJECT_NAME = "Untitled Song";
const MAX_FOLDER_NAME_LENGTH = 120;

export interface ProjectNameSource {
	metadata?: TTMLMetadata[];
	lyricFileName?: string;
	audioFileName?: string;
}

export interface ResolvedProjectName {
	name: string;
	isTemplate: boolean;
}

function stripExtension(fileName: string): string {
	const idx = fileName.lastIndexOf(".");
	return idx > 0 ? fileName.slice(0, idx) : fileName;
}

function firstMetadataValue(
	metadata: TTMLMetadata[] | undefined,
	key: string,
): string {
	const values = metadata?.find((m) => m.key === key)?.value ?? [];
	for (const v of values) {
		const trimmed = v.trim();
		if (trimmed) return trimmed;
	}
	return "";
}

export function toSafeFolderName(raw: string): string {
	if (!raw.trim()) return "";
	const cleaned = sanitizeFileName(raw)
		.replace(/\.{2,}/g, ".")
		.replace(/^[.\s]+/, "")
		.replace(/[.\s]+$/, "")
		.slice(0, MAX_FOLDER_NAME_LENGTH)
		.replace(/[.\s]+$/, "");
	return cleaned && isSafeProjectFileName(cleaned) ? cleaned : "";
}

export function getSongInfo(
	metadata: TTMLMetadata[] | undefined,
	audioSize?: number,
): ProjectSongInfo {
	const title = firstMetadataValue(metadata, "musicName");
	const artists = firstMetadataValue(metadata, "artists");
	return {
		...(title ? { title } : {}),
		...(artists ? { artists } : {}),
		...(audioSize !== undefined ? { audioSize } : {}),
	};
}

export function resolveProjectName(
	source: ProjectNameSource,
): ResolvedProjectName {
	const suggested = source.metadata
		? getSuggestedTtmlFileName(source.metadata)
		: null;
	const candidates = [
		suggested?.baseName ?? "",
		firstMetadataValue(source.metadata, "musicName"),
		source.lyricFileName ? stripExtension(source.lyricFileName) : "",
		source.audioFileName ? stripExtension(source.audioFileName) : "",
	];
	for (const candidate of candidates) {
		const safe = toSafeFolderName(candidate);
		if (safe) return { name: safe, isTemplate: false };
	}
	return { name: DEFAULT_PROJECT_NAME, isTemplate: true };
}

export function pickFolderName(
	resolved: ResolvedProjectName,
	taken: ReadonlySet<string>,
): string {
	const lowerTaken = new Set([...taken].map((n) => n.toLowerCase()));
	if (!resolved.isTemplate && !lowerTaken.has(resolved.name.toLowerCase())) {
		return resolved.name;
	}
	let n = resolved.isTemplate ? 1 : 2;
	while (lowerTaken.has(`${resolved.name}-${n}`.toLowerCase())) n++;
	return `${resolved.name}-${n}`;
}
