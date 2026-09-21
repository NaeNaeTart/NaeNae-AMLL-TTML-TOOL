export const PROJECT_MANIFEST_APP_ID = "naenae-ttml-tool";

export interface ProjectSongInfo {
	title?: string;
	artists?: string;
	audioSize?: number;
}

export interface ProjectManifest {
	version: 1;
	app?: typeof PROJECT_MANIFEST_APP_ID;
	projectId?: string;
	name: string;
	audioFile: string;
	lyricFile: string;
	coverFile?: string;
	song?: ProjectSongInfo;
	folderName?: string;
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
}

export interface RecentProjectFileStatus {
	dirExists: boolean;
	audioFileExists: boolean;
	lyricFileExists: boolean;
}

export const PROJECT_MANIFEST_FILENAME = "project.json";
