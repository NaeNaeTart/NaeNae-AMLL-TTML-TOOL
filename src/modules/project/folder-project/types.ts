export interface ProjectManifest {
	version: 1;
	name: string;
	audioFile: string;
	lyricFile: string;
	lyricsfileFile?: string;
	// Filename of a .ttml file kept alongside an active .yaml file (or vice
	// versa) when the format was switched and the previous file was
	// preserved on disk instead of deleted. Independent of `lyricFile`,
	// which always tracks the currently active/edited file.
	ttmlFile?: string;
	createdAt: number;
	updatedAt: number;
}

export const PROJECT_MANIFEST_FILENAME = "project.json";

export function isProjectManifest(value: unknown): value is ProjectManifest {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.name === "string" &&
		typeof v.audioFile === "string" &&
		typeof v.lyricFile === "string"
	);
}
