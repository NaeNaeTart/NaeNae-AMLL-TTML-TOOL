import { BUILD_TIME, GIT_COMMIT } from "virtual:buildmeta";
import { getAllPlugins } from "$/modules/plugins/plugin-store";
import { exportAllProjectsData } from "$/modules/project/autosave/autosave";
import { readCustomBackgroundBlob } from "$/modules/settings/modals/customBackground";
import { saveFile } from "$/utils/fileSystem";
import { blobToBase64 } from "./binary";
import { isExportDeniedKey, isSecretKey } from "./denylist";
import { type ExportPreviewParts, loadExportParts } from "./preview";
import {
	BACKUP_APP_ID,
	BACKUP_CATEGORY_IDS,
	BACKUP_FORMAT_VERSION,
	type BackupCategoryId,
	type BackupFile,
} from "./types";

const KEYBINDING_PREFIX = "keybindings:";

/**
 * @description 将 localStorage 按“键绑定”和“设置”两类进行划分（原始字符串，不做 JSON 解析）。
 */
export function partitionLocalStorage(): {
	settings: Record<string, string>;
	keybindings: Record<string, string>;
	apiKeys: Record<string, string>;
} {
	const settings: Record<string, string> = {};
	const keybindings: Record<string, string> = {};
	const apiKeys: Record<string, string> = {};

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key === null) continue;
		const value = localStorage.getItem(key);
		if (value === null) continue;

		if (key.startsWith(KEYBINDING_PREFIX)) {
			keybindings[key] = value;
		} else if (isSecretKey(key)) {
			if (value !== "" && value !== '""') apiKeys[key] = value;
		} else if (!isExportDeniedKey(key)) {
			settings[key] = value;
		}
	}

	return { settings, keybindings, apiKeys };
}

export interface BackupAssetsCounts {
	background: boolean;
	presets: number;
	font: boolean;
}

/**
 * @description 各分类当前的数量提示，用于备份界面显示。
 */
export interface BackupCounts {
	settings: number;
	keybindings: number;
	apiKeys: number;
	assets: BackupAssetsCounts;
	projects: number;
	plugins: number;
}

export function countsFromParts(parts: ExportPreviewParts): BackupCounts {
	return {
		settings: Object.keys(parts.settings).length,
		keybindings: Object.keys(parts.keybindings).length,
		apiKeys: Object.keys(parts.apiKeys ?? {}).length,
		assets: {
			background: parts.background !== null,
			presets: parts.appearancePresets?.length ?? 0,
			font: Boolean(parts.customFont),
		},
		projects: parts.projects.length,
		plugins: parts.plugins.length,
	};
}

export async function getBackupCounts(): Promise<BackupCounts> {
	return countsFromParts(await loadExportParts(new Set(BACKUP_CATEGORY_IDS)));
}

/**
 * @description 根据所选分类构建备份对象。
 */
export async function buildBackup(
	selected: Set<BackupCategoryId>,
): Promise<BackupFile> {
	const { settings, keybindings, apiKeys } = partitionLocalStorage();

	const backup: BackupFile = {
		app: BACKUP_APP_ID,
		formatVersion: BACKUP_FORMAT_VERSION,
		exportedAt: new Date().toISOString(),
		build: { commit: GIT_COMMIT, time: BUILD_TIME },
		categories: {},
	};

	if (selected.has("settings")) {
		backup.categories.settings = { localStorage: settings };
	}

	if (selected.has("keybindings")) {
		backup.categories.keybindings = { localStorage: keybindings };
	}

	if (selected.has("apiKeys")) {
		backup.categories.apiKeys = { localStorage: apiKeys };
	}

	if (selected.has("assets")) {
		const blob = await readCustomBackgroundBlob();
		let presets: unknown[] | undefined;
		try {
			const raw = localStorage.getItem("appearancePresets");
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed) && parsed.length > 0) presets = parsed;
			}
		} catch {}

		let customFont: { name: string; data: string } | null = null;
		const fontName = localStorage.getItem("customFontName");
		const fontData = localStorage.getItem("customFontData");
		if (fontName && fontData) {
			customFont = { name: fontName, data: fontData };
		}

		backup.categories.assets = {
			backgroundImage: blob
				? {
						mime: blob.type || "image/png",
						dataBase64: await blobToBase64(blob),
						updatedAt: Date.now(),
					}
				: null,
			...(presets ? { appearancePresets: presets } : {}),
			...(customFont ? { customFont } : {}),
		};
	}

	if (selected.has("projects")) {
		const { projects, versions } = await exportAllProjectsData();
		backup.categories.projects = {
			projects,
			versions: versions.map(({ id: _id, ...rest }) => rest),
		};
	}

	if (selected.has("plugins")) {
		const plugins = await getAllPlugins();
		backup.categories.plugins = {
			plugins: await Promise.all(
				plugins.map(async ({ blob, ...rest }) => ({
					...rest,
					blobMime: blob.type || "application/wasm",
					blobBase64: await blobToBase64(blob),
				})),
			),
		};
	}

	return backup;
}

/**
 * @description 构建备份并触发文件下载。返回保存的文件名（若用户取消则为 null）。
 */
export async function exportBackup(
	selected: Set<BackupCategoryId>,
): Promise<string | null> {
	const backup = await buildBackup(selected);
	return saveBackupFile(backup);
}

export async function saveBackupFile(
	backup: BackupFile,
): Promise<string | null> {
	const json = JSON.stringify(backup);
	const date = backup.exportedAt.slice(0, 10);
	const saved = await saveFile(new Blob([json], { type: "application/json" }), {
		suggestedName: `amll-ttml-tool-backup-${date}.json`,
		types: [
			{
				description: "AMLL TTML Tool Backup",
				accept: { "application/json": [".json"] },
			},
		],
	});
	return saved ?? null;
}
