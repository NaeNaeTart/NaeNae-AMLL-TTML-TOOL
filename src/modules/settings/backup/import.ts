import { savePlugin } from "$/modules/plugins/plugin-store";
import { restoreProjectsData } from "$/modules/project/autosave/autosave";
import { writeCustomBackgroundBlob } from "$/modules/settings/modals/customBackground";
import { base64ToBlob } from "./binary";
import { isDeniedKey, isSecretKey } from "./denylist";
import type { BackupAssetsCounts } from "./export";
import {
	type BackupCategoryId,
	type BackupFile,
	validateBackupFile,
} from "./types";

/**
 * @description 解析并校验备份文件文本，非法时抛出 {@link BackupValidationError}。
 */
export function parseBackupFile(text: string): BackupFile {
	const data = JSON.parse(text);
	validateBackupFile(data);
	return data;
}

/**
 * @description 备份文件中实际包含的分类，用于导入确认界面。
 */
export function getPresentCategories(file: BackupFile): BackupCategoryId[] {
	return (Object.keys(file.categories) as BackupCategoryId[]).filter(
		(key) => file.categories[key] !== undefined,
	);
}

/**
 * @description 各分类的内容描述（数量/是否存在），用于导入确认界面。
 */
export function describeBackup(
	file: BackupFile,
): Partial<Record<BackupCategoryId, number | boolean | BackupAssetsCounts>> {
	const result: Partial<
		Record<BackupCategoryId, number | boolean | BackupAssetsCounts>
	> = {};
	const c = file.categories;
	if (c.settings) result.settings = Object.keys(c.settings.localStorage).length;
	if (c.keybindings)
		result.keybindings = Object.keys(c.keybindings.localStorage).length;
	if (c.apiKeys)
		result.apiKeys = Object.keys(c.apiKeys.localStorage).filter(
			isSecretKey,
		).length;
	if (c.assets) {
		result.assets = {
			background:
				c.assets.backgroundImage !== null &&
				c.assets.backgroundImage !== undefined,
			presets: Array.isArray(c.assets.appearancePresets)
				? c.assets.appearancePresets.length
				: 0,
			font: Boolean(c.assets.customFont),
		};
	}
	if (c.projects) result.projects = c.projects.projects.length;
	if (c.plugins) result.plugins = c.plugins.plugins.length;
	return result;
}

function applyLocalStorage(entries: Record<string, string>) {
	for (const [key, value] of Object.entries(entries)) {
		if (isDeniedKey(key)) continue;
		localStorage.setItem(key, value);
	}
}

/**
 * @description 将所选分类应用到当前环境。调用方应在成功后重新加载页面。
 * 出错时抛出异常（部分数据可能已被写入）。
 */
export async function applyBackup(
	file: BackupFile,
	selected: Set<BackupCategoryId>,
): Promise<void> {
	const c = file.categories;

	if (selected.has("settings") && c.settings) {
		applyLocalStorage(c.settings.localStorage);
	}

	if (selected.has("keybindings") && c.keybindings) {
		applyLocalStorage(c.keybindings.localStorage);
	}

	if (selected.has("apiKeys") && c.apiKeys) {
		for (const [key, value] of Object.entries(c.apiKeys.localStorage)) {
			if (isSecretKey(key)) localStorage.setItem(key, value);
		}
	}

	if (selected.has("assets") && c.assets) {
		const bg = c.assets.backgroundImage;
		if (bg) {
			await writeCustomBackgroundBlob(base64ToBlob(bg.dataBase64, bg.mime));
		} else if (bg === null) {
			await writeCustomBackgroundBlob(null);
		}

		if (
			c.assets.appearancePresets &&
			Array.isArray(c.assets.appearancePresets)
		) {
			localStorage.setItem(
				"appearancePresets",
				JSON.stringify(c.assets.appearancePresets),
			);
		}

		if (c.assets.customFont) {
			localStorage.setItem("customFontName", c.assets.customFont.name);
			localStorage.setItem("customFontData", c.assets.customFont.data);
		}
	}

	if (selected.has("projects") && c.projects) {
		await restoreProjectsData(c.projects.projects, c.projects.versions);
	}

	if (selected.has("plugins") && c.plugins) {
		for (const plugin of c.plugins.plugins) {
			const { blobBase64, blobMime, ...rest } = plugin;
			await savePlugin({
				...rest,
				blob: base64ToBlob(blobBase64, blobMime),
			});
		}
	}
}
