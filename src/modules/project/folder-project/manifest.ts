import {
	PROJECT_MANIFEST_APP_ID,
	PROJECT_MANIFEST_FILENAME,
	type ProjectManifest,
} from "./types";

const DOS_DEVICE_NAMES_REGEX = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;

export function sanitizeFileName(name: string): string {
	const cleaned = name
		.replace(/[\\/:*?"<>|]/g, "_")
		.replace(/\s+/g, " ")
		.trim();
	return cleaned.length > 0 ? cleaned : "Untitled";
}

function stripFileExtension(fileName: string): string {
	const idx = fileName.lastIndexOf(".");
	if (idx <= 0) return fileName;
	return fileName.slice(0, idx);
}

export function ensureExtension(fileName: string, ext: string): string {
	const dotExt = ext.startsWith(".") ? ext : `.${ext}`;
	const lower = fileName.toLowerCase();
	if (lower.endsWith(dotExt.toLowerCase())) return fileName;
	const base = stripFileExtension(fileName);
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

export function isSafeProjectFileName(name: string): boolean {
	if (!name || name.length === 0 || name.length > 255) return false;
	if (name.startsWith(".")) return false;
	if (name.endsWith(".") || name.endsWith(" ")) return false;
	if (name.toLowerCase() === PROJECT_MANIFEST_FILENAME.toLowerCase())
		return false;
	if (DOS_DEVICE_NAMES_REGEX.test(name)) return false;
	if (name.includes("/") || name.includes("\\")) return false;
	if (name.includes("..")) return false;
	if (/^[a-zA-Z]:/.test(name) || name.startsWith("/")) return false;
	if (/[<>:"|?*]/.test(name)) return false;
	for (let i = 0; i < name.length; i++) {
		const code = name.charCodeAt(i);
		if (code < 32 || code === 127) return false;
	}
	return true;
}

export function assertSafePath(baseDir: string, relativePath: string): string {
	if (!relativePath || typeof relativePath !== "string") {
		throw new Error("Invalid relative path: path cannot be empty");
	}
	let decoded = relativePath;
	try {
		decoded = decodeURIComponent(relativePath);
	} catch {
		throw new Error("Invalid relative path: malformed URI encoding");
	}
	for (const candidate of [relativePath, decoded]) {
		if (
			candidate.startsWith("/") ||
			candidate.startsWith("\\") ||
			/^[a-zA-Z]:/.test(candidate) ||
			candidate.startsWith("//") ||
			candidate.startsWith("\\\\")
		) {
			throw new Error(
				`Path traversal attempt: absolute path not allowed (${relativePath})`,
			);
		}
		for (let i = 0; i < candidate.length; i++) {
			const code = candidate.charCodeAt(i);
			if (code < 32 || code === 127) {
				throw new Error("Invalid relative path: contains control characters");
			}
		}
		const normalized = candidate.replace(/\\/g, "/");
		const segments = normalized.split("/").filter(Boolean);
		for (const seg of segments) {
			if (
				seg === "." ||
				seg === ".." ||
				seg.includes("..") ||
				seg.startsWith(".")
			) {
				throw new Error(
					`Path traversal attempt: invalid directory traversal segment (${seg})`,
				);
			}
			if (DOS_DEVICE_NAMES_REGEX.test(seg)) {
				throw new Error(
					`Invalid path: contains Windows reserved device name (${seg})`,
				);
			}
			if (seg.endsWith(".") || seg.endsWith(" ")) {
				throw new Error(
					`Invalid path: segment ends with trailing period or space (${seg})`,
				);
			}
		}
	}
	const normalizedRel = relativePath.replace(/\\/g, "/");
	const segments = normalizedRel.split("/").filter(Boolean);
	const normalizedBase = baseDir.replace(/\\/g, "/").replace(/\/+$/, "");
	const targetPath = `${normalizedBase}/${segments.join("/")}`;
	if (!targetPath.startsWith(`${normalizedBase}/`)) {
		throw new Error(
			`Path traversal attempt: path escapes base directory (${relativePath})`,
		);
	}
	return targetPath;
}

export function isProjectManifest(value: unknown): value is ProjectManifest {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	if (v.version !== 1) return false;
	if (typeof v.name !== "string" || v.name.trim().length === 0) return false;
	if (typeof v.audioFile !== "string") return false;
	if (typeof v.lyricFile !== "string") return false;
	if (v.audioFile.length > 0 && !isSafeProjectFileName(v.audioFile))
		return false;
	if (v.lyricFile.length > 0 && !isSafeProjectFileName(v.lyricFile))
		return false;
	if (v.coverFile !== undefined) {
		if (typeof v.coverFile !== "string") return false;
		if (v.coverFile.length > 0 && !isSafeProjectFileName(v.coverFile))
			return false;
	}
	if (
		v.createdAt !== undefined &&
		(typeof v.createdAt !== "number" || Number.isNaN(v.createdAt))
	) {
		return false;
	}
	if (
		v.updatedAt !== undefined &&
		(typeof v.updatedAt !== "number" || Number.isNaN(v.updatedAt))
	) {
		return false;
	}
	if (v.app !== undefined && v.app !== PROJECT_MANIFEST_APP_ID) return false;
	if (
		v.projectId !== undefined &&
		(typeof v.projectId !== "string" || v.projectId.length > 128)
	) {
		return false;
	}
	if (
		v.folderName !== undefined &&
		(typeof v.folderName !== "string" ||
			(v.folderName.length > 0 && !isSafeProjectFileName(v.folderName)))
	) {
		return false;
	}
	if (v.song !== undefined) {
		if (!v.song || typeof v.song !== "object") return false;
		const s = v.song as Record<string, unknown>;
		if (s.title !== undefined && typeof s.title !== "string") return false;
		if (s.artists !== undefined && typeof s.artists !== "string") return false;
		if (
			s.audioSize !== undefined &&
			(typeof s.audioSize !== "number" || Number.isNaN(s.audioSize))
		) {
			return false;
		}
	}
	return true;
}
