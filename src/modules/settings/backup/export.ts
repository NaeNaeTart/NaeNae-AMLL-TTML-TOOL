import { BUILD_TIME, GIT_COMMIT } from "virtual:buildmeta";
import { getAllPlugins } from "$/modules/plugins/plugin-store";
import { exportAllProjectsData } from "$/modules/project/autosave/autosave";
import { readCustomBackgroundBlob } from "$/modules/settings/modals/customBackground";
import { saveFile } from "$/utils/fileSystem";
import { blobToBase64 } from "./binary";
import { isExportDeniedKey, isSecretKey } from "./denylist";
import {
	BACKUP_APP_ID,
	BACKUP_FORMAT_VERSION,
	type BackupCategoryId,
	type BackupFile,
} from "./types";

const KEYBINDING_PREFIX = "keybindings:";

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

export interface BackupCounts {
	settings: number;
	keybindings: number;
	apiKeys: number;
	assets: BackupAssetsCounts;
	projects: number;
	plugins: number;
}

export async function getBackupCounts(): Promise<BackupCounts> {
	const { settings, keybindings, apiKeys } = partitionLocalStorage();
	const [background, projectsData, plugins] = await Promise.all([
		readCustomBackgroundBlob(),
		exportAllProjectsData(),
		getAllPlugins(),
	]);

	let presetsCount = 0;
	try {
		const raw = localStorage.getItem("appearancePresets");
		if (raw) {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) presetsCount = parsed.length;
		}
	} catch {}

	const hasFont =
		typeof localStorage !== "undefined" &&
		Boolean(
			localStorage.getItem("customFontName") &&
				localStorage.getItem("customFontData"),
		);

	return {
		settings: Object.keys(settings).length,
		keybindings: Object.keys(keybindings).length,
		apiKeys: Object.keys(apiKeys).length,
		assets: {
			background: background !== null,
			presets: presetsCount,
			font: hasFont,
		},
		projects: projectsData.projects.length,
		plugins: plugins.length,
	};
}

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
