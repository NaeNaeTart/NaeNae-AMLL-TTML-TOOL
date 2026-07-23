import { BUILD_TIME, GIT_COMMIT } from "virtual:buildmeta";
import { getAllPlugins } from "$/modules/plugins/plugin-store";
import { exportAllProjectsData } from "$/modules/project/autosave/autosave";
import { readCustomBackgroundBlob } from "$/modules/settings/modals/customBackground";
import { saveFile } from "$/utils/fileSystem";
import { blobToBase64 } from "./binary";
import {
	BACKUP_APP_ID,
	BACKUP_FORMAT_VERSION,
	type BackupCategoryId,
	type BackupFile,
} from "./types";

const KEYBINDING_PREFIX = "keybindings:";

/**
 * @description 会被排除在设置备份之外的本地存储键。
 * `customBackgroundImage` 为已迁移到 IndexedDB 的旧键，其余为第三方（Sentry、开发工具、Vercel Analytics、i18next）。
 */
const DENYLIST_EXACT = new Set<string>(["customBackgroundImage"]);
const DENYLIST_PREFIXES = ["sentry", "__", "va-", "i18next"];

function isDeniedKey(key: string): boolean {
	if (DENYLIST_EXACT.has(key)) return true;
	return DENYLIST_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * @description 将 localStorage 按“键绑定”和“设置”两类进行划分（原始字符串，不做 JSON 解析）。
 */
export function partitionLocalStorage(): {
	settings: Record<string, string>;
	keybindings: Record<string, string>;
} {
	const settings: Record<string, string> = {};
	const keybindings: Record<string, string> = {};

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key === null) continue;
		const value = localStorage.getItem(key);
		if (value === null) continue;

		if (key.startsWith(KEYBINDING_PREFIX)) {
			keybindings[key] = value;
		} else if (!isDeniedKey(key)) {
			settings[key] = value;
		}
	}

	return { settings, keybindings };
}

/**
 * @description 各分类当前的数量提示，用于备份界面显示。
 */
export interface BackupCounts {
	settings: number;
	keybindings: number;
	assets: boolean;
	projects: number;
	plugins: number;
}

export async function getBackupCounts(): Promise<BackupCounts> {
	const { settings, keybindings } = partitionLocalStorage();
	const [background, projectsData, plugins] = await Promise.all([
		readCustomBackgroundBlob(),
		exportAllProjectsData(),
		getAllPlugins(),
	]);
	return {
		settings: Object.keys(settings).length,
		keybindings: Object.keys(keybindings).length,
		assets: background !== null,
		projects: projectsData.projects.length,
		plugins: plugins.length,
	};
}

/**
 * @description 根据所选分类构建备份对象。
 */
export async function buildBackup(
	selected: Set<BackupCategoryId>,
): Promise<BackupFile> {
	const { settings, keybindings } = partitionLocalStorage();

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

	if (selected.has("assets")) {
		const blob = await readCustomBackgroundBlob();
		backup.categories.assets = {
			backgroundImage: blob
				? {
						mime: blob.type || "image/png",
						dataBase64: await blobToBase64(blob),
						updatedAt: Date.now(),
					}
				: null,
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
	const json = JSON.stringify(backup);
	const date = new Date().toISOString().slice(0, 10);
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
