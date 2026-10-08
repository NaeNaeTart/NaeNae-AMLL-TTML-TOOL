export const PROJECT_MANIFEST_APP_ID = "naenae-ttml-tool";

export interface ProjectSongInfo {
	title?: string;
	artists?: string;
	audioSize?: number;
}

export interface LinkedProjectFiles {
	lyricPath: string;
	audioPath: string;
}

export interface ProjectManifest {
	version: 1;
	app?: typeof PROJECT_MANIFEST_APP_ID;
	projectId?: string;
	name: string;
	/** True once the user renamed the project; saves then stop deriving the name from metadata. */
	nameEdited?: boolean;
	audioFile: string;
	lyricFile: string;
	coverFile?: string;
	song?: ProjectSongInfo;
	folderName?: string;
	linked?: LinkedProjectFiles;
	createdAt?: number;
	updatedAt?: number;
}

export interface RecentProjectEntry {
	dir: string;
	name: string;
	audioFile: string;
	lyricFile: string;
	lastOpened: number;
	updatedAt?: number;
	linked?: LinkedProjectFiles;
}

export interface RecentProjectFileStatus {
	dirExists: boolean;
	audioFileExists: boolean;
	lyricFileExists: boolean;
}

export const PROJECT_MANIFEST_FILENAME = "project.json";

export const LINKED_PROJECTS_DIRNAME = "projects";

/** One-time copy of a linked TTML, kept in the project's app-data folder before the first overwrite. */
export const LINKED_LYRIC_BACKUP_FILENAME = "original.ttml.bak";
