import type { WASMPlugin } from "$/modules/plugins/types";
import type {
	ProjectInfo,
	ProjectVersion,
} from "$/modules/project/autosave/autosave";

export const BACKUP_APP_ID = "amll-ttml-tool";

export const BACKUP_FORMAT_VERSION = 1;

export type BackupCategoryId =
	| "settings"
	| "keybindings"
	| "assets"
	| "projects"
	| "plugins"
	| "apiKeys";

export const BACKUP_CATEGORY_IDS: BackupCategoryId[] = [
	"settings",
	"keybindings",
	"assets",
	"projects",
	"plugins",
	"apiKeys",
];

export interface BackupBackgroundImage {
	mime: string;
	dataBase64: string;
	updatedAt: number;
}

export type BackupPlugin = Omit<WASMPlugin, "blob"> & {
	blobBase64: string;
	blobMime: string;
};

export interface BackupCustomFont {
	name: string;
	data: string;
}

export interface BackupFile {
	app: typeof BACKUP_APP_ID;
	formatVersion: number;
	exportedAt: string;
	build: { commit: string; time: string };
	categories: {
		settings?: { localStorage: Record<string, string> };
		keybindings?: { localStorage: Record<string, string> };
		apiKeys?: { localStorage: Record<string, string> };
		assets?: {
			backgroundImage: BackupBackgroundImage | null;
			appearancePresets?: unknown[];
			customFont?: BackupCustomFont | null;
		};
		projects?: {
			projects: ProjectInfo[];
			versions: Omit<ProjectVersion, "id">[];
		};
		plugins?: { plugins: BackupPlugin[] };
	};
}

export type BackupValidationReason =
	| "notObject"
	| "notBackupFile"
	| "newerVersion"
	| "malformedCategories";

export class BackupValidationError extends Error {
	constructor(public reason: BackupValidationReason) {
		super(`Backup validation failed: ${reason}`);
		this.name = "BackupValidationError";
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
	if (!isPlainObject(value)) return false;
	return Object.values(value).every((v) => typeof v === "string");
}

export function validateBackupFile(data: unknown): asserts data is BackupFile {
	if (!isPlainObject(data)) {
		throw new BackupValidationError("notObject");
	}
	if (data.app !== BACKUP_APP_ID) {
		throw new BackupValidationError("notBackupFile");
	}
	if (typeof data.formatVersion !== "number") {
		throw new BackupValidationError("notBackupFile");
	}
	if (data.formatVersion > BACKUP_FORMAT_VERSION) {
		throw new BackupValidationError("newerVersion");
	}
	if (!isPlainObject(data.categories)) {
		throw new BackupValidationError("malformedCategories");
	}

	const categories = data.categories;

	if (categories.settings !== undefined) {
		if (
			!isPlainObject(categories.settings) ||
			!isStringRecord(categories.settings.localStorage)
		) {
			throw new BackupValidationError("malformedCategories");
		}
	}

	if (categories.keybindings !== undefined) {
		if (
			!isPlainObject(categories.keybindings) ||
			!isStringRecord(categories.keybindings.localStorage)
		) {
			throw new BackupValidationError("malformedCategories");
		}
	}

	if (categories.apiKeys !== undefined) {
		if (
			!isPlainObject(categories.apiKeys) ||
			!isStringRecord(categories.apiKeys.localStorage)
		) {
			throw new BackupValidationError("malformedCategories");
		}
	}

	if (categories.assets !== undefined) {
		if (!isPlainObject(categories.assets)) {
			throw new BackupValidationError("malformedCategories");
		}
		const bg = categories.assets.backgroundImage;
		if (bg !== null && bg !== undefined) {
			if (
				!isPlainObject(bg) ||
				typeof bg.mime !== "string" ||
				typeof bg.dataBase64 !== "string"
			) {
				throw new BackupValidationError("malformedCategories");
			}
		}
		const presets = categories.assets.appearancePresets;
		if (presets !== undefined && !Array.isArray(presets)) {
			throw new BackupValidationError("malformedCategories");
		}
		const font = categories.assets.customFont;
		if (font !== null && font !== undefined) {
			if (
				!isPlainObject(font) ||
				typeof font.name !== "string" ||
				typeof font.data !== "string"
			) {
				throw new BackupValidationError("malformedCategories");
			}
		}
	}

	if (categories.projects !== undefined) {
		const projects = categories.projects;
		if (
			!isPlainObject(projects) ||
			!Array.isArray(projects.projects) ||
			!Array.isArray(projects.versions)
		) {
			throw new BackupValidationError("malformedCategories");
		}
		for (const p of projects.projects) {
			if (
				!isPlainObject(p) ||
				typeof p.id !== "string" ||
				!isPlainObject(p.latestState)
			) {
				throw new BackupValidationError("malformedCategories");
			}
		}
		for (const v of projects.versions) {
			if (
				!isPlainObject(v) ||
				typeof v.projectId !== "string" ||
				!isPlainObject(v.data)
			) {
				throw new BackupValidationError("malformedCategories");
			}
		}
	}

	if (categories.plugins !== undefined) {
		const plugins = categories.plugins;
		if (!isPlainObject(plugins) || !Array.isArray(plugins.plugins)) {
			throw new BackupValidationError("malformedCategories");
		}
		for (const p of plugins.plugins) {
			if (
				!isPlainObject(p) ||
				typeof p.id !== "string" ||
				typeof p.blobBase64 !== "string"
			) {
				throw new BackupValidationError("malformedCategories");
			}
		}
	}
}
