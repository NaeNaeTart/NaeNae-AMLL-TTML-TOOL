import type {
	ProjectInfo,
	ProjectVersion,
} from "$/modules/project/autosave/autosave";
import type { WASMPlugin } from "$/modules/plugins/types";

/**
 * @description 备份文件的应用标识，用于拒绝非本应用的文件
 */
export const BACKUP_APP_ID = "amll-ttml-tool";

/**
 * @description 备份文件格式版本。导入比此版本更新的文件时会拒绝并提示。
 */
export const BACKUP_FORMAT_VERSION = 1;

/**
 * @description 可选的备份分类
 */
export type BackupCategoryId =
	| "settings"
	| "keybindings"
	| "assets"
	| "projects"
	| "plugins";

export const BACKUP_CATEGORY_IDS: BackupCategoryId[] = [
	"settings",
	"keybindings",
	"assets",
	"projects",
	"plugins",
];

/**
 * @description 序列化后的自定义背景图片资源
 */
export interface BackupBackgroundImage {
	mime: string;
	dataBase64: string;
	updatedAt: number;
}

/**
 * @description 序列化后的 WASM 插件（二进制以 base64 存储）
 */
export type BackupPlugin = Omit<WASMPlugin, "blob"> & {
	blobBase64: string;
	blobMime: string;
};

/**
 * @description 备份文件的完整结构
 */
export interface BackupFile {
	app: typeof BACKUP_APP_ID;
	formatVersion: number;
	exportedAt: string;
	build: { commit: string; time: string };
	categories: {
		settings?: { localStorage: Record<string, string> };
		keybindings?: { localStorage: Record<string, string> };
		assets?: { backgroundImage: BackupBackgroundImage | null };
		projects?: {
			projects: ProjectInfo[];
			versions: Omit<ProjectVersion, "id">[];
		};
		plugins?: { plugins: BackupPlugin[] };
	};
}

/**
 * @description 校验失败的原因代码，用于映射到 i18n 文案
 */
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

/**
 * @description 校验任意解析出的数据是否为合法的备份文件，非法时抛出 {@link BackupValidationError}
 */
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

	if (categories.assets !== undefined) {
		if (!isPlainObject(categories.assets)) {
			throw new BackupValidationError("malformedCategories");
		}
		const bg = categories.assets.backgroundImage;
		if (bg !== null) {
			if (
				!isPlainObject(bg) ||
				typeof bg.mime !== "string" ||
				typeof bg.dataBase64 !== "string"
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
