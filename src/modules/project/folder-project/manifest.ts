import { stripKnownFileExtension } from "$/states/main.ts";

export function sanitizeFileName(name: string): string {
	const cleaned = name
		.replace(/[\\/:*?"<>|]/g, "_")
		.replace(/\s+/g, " ")
		.trim();
	return cleaned.length > 0 ? cleaned : "Untitled";
}

export function ensureExtension(fileName: string, ext: string): string {
	const dotExt = ext.startsWith(".") ? ext : `.${ext}`;
	const lower = fileName.toLowerCase();
	if (lower.endsWith(dotExt.toLowerCase())) return fileName;
	const base = stripKnownFileExtension(fileName);
	return `${base}${dotExt}`;
}

export function getFileNameFromPath(path: string): string {
	const normalized = path.replace(/\\/g, "/");
	const parts = normalized.split("/").filter(Boolean);
	return parts[parts.length - 1] ?? path;
}

export function getFileExtension(fileName: string): string {
	const idx = fileName.lastIndexOf(".");
	if (idx === -1) return "";
	return fileName.slice(idx + 1).toLowerCase();
}
