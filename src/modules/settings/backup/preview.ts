import type {
	ProjectInfo,
	ProjectVersion,
} from "$/modules/project/autosave/autosave";
import { formatKeybindingLabel, formatSettingLabel } from "./labels";
import { BACKUP_CATEGORY_IDS, type BackupCategoryId } from "./types";

export interface ExportPreviewItem {
	label: string;
	detail: string;
	bytes: number;
}

export interface ExportPreviewCategory {
	id: BackupCategoryId;
	items: ExportPreviewItem[];
	bytes: number;
}

export interface ExportPreview {
	categories: ExportPreviewCategory[];
	totalBytes: number;
}

export interface ExportPreviewParts {
	settings: Record<string, string>;
	keybindings: Record<string, string>;
	apiKeys?: Record<string, string>;
	background: { mime: string; bytes: number } | null;
	appearancePresets?: Array<{ id: string; name: string; bytes: number }>;
	customFont?: { name: string; bytes: number } | null;
	projects: ProjectInfo[];
	versions: ProjectVersion[];
	plugins: Array<{
		id: string;
		name: string;
		version: string;
		kind: string;
		bytes: number;
	}>;
}

export const EXPORT_PREVIEW_ITEM_LIMIT = 8;

export function formatPreviewBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function storageItems(
	record: Record<string, string>,
	isKeybindings = false,
): ExportPreviewItem[] {
	return Object.keys(record)
		.sort()
		.map((key) => ({
			label: isKeybindings
				? formatKeybindingLabel(key)
				: formatSettingLabel(key),
			detail: formatPreviewBytes(record[key].length),
			bytes: record[key].length,
		}));
}

export function summarizeExportParts(
	parts: ExportPreviewParts,
	selected: Set<BackupCategoryId>,
): ExportPreview {
	const categories: ExportPreviewCategory[] = [];

	for (const id of BACKUP_CATEGORY_IDS) {
		if (!selected.has(id)) continue;
		if (id === "settings") {
			const items = storageItems(parts.settings, false);
			categories.push({
				id,
				items,
				bytes: items.reduce((sum, item) => sum + item.bytes, 0),
			});
		} else if (id === "keybindings") {
			const items = storageItems(parts.keybindings, true);
			categories.push({
				id,
				items,
				bytes: items.reduce((sum, item) => sum + item.bytes, 0),
			});
		} else if (id === "assets") {
			const items: ExportPreviewItem[] = [];
			if (parts.appearancePresets && parts.appearancePresets.length > 0) {
				for (const preset of parts.appearancePresets) {
					items.push({
						label: `Preset: ${preset.name}`,
						detail: formatPreviewBytes(preset.bytes),
						bytes: preset.bytes,
					});
				}
			}
			if (parts.customFont) {
				items.push({
					label: `Custom Font: ${parts.customFont.name}`,
					detail: formatPreviewBytes(parts.customFont.bytes),
					bytes: parts.customFont.bytes,
				});
			}
			if (parts.background) {
				items.push({
					label: parts.background.mime,
					detail: formatPreviewBytes(parts.background.bytes),
					bytes: parts.background.bytes,
				});
			}
			categories.push({
				id,
				items,
				bytes: items.reduce((sum, item) => sum + item.bytes, 0),
			});
		} else if (id === "apiKeys") {
			const apiKeys = parts.apiKeys ?? {};
			const items = Object.keys(apiKeys)
				.sort()
				.map((key) => ({
					label: formatSettingLabel(key),
					detail: formatPreviewBytes(apiKeys[key].length),
					bytes: apiKeys[key].length,
				}));
			categories.push({
				id,
				items,
				bytes: items.reduce((sum, item) => sum + item.bytes, 0),
			});
		} else if (id === "projects") {
			const versionsByProject = new Map<string, number>();
			for (const version of parts.versions) {
				versionsByProject.set(
					version.projectId,
					(versionsByProject.get(version.projectId) ?? 0) + 1,
				);
			}
			const items = [...parts.projects]
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((project) => {
					const projectVersions = parts.versions.filter(
						(version) => version.projectId === project.id,
					);
					return {
						label: project.name,
						detail: `${versionsByProject.get(project.id) ?? 0} versions`,
						bytes:
							JSON.stringify(project).length +
							JSON.stringify(projectVersions).length,
					};
				});
			categories.push({
				id,
				items,
				bytes: items.reduce((sum, item) => sum + item.bytes, 0),
			});
		} else if (id === "plugins") {
			const items = [...parts.plugins]
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((plugin) => ({
					label: `${plugin.name} ${plugin.version}`,
					detail: plugin.kind,
					bytes: plugin.bytes,
				}));
			categories.push({
				id,
				items,
				bytes: items.reduce((sum, item) => sum + item.bytes, 0),
			});
		}
	}

	return {
		categories,
		totalBytes: categories.reduce((sum, category) => sum + category.bytes, 0),
	};
}

export async function previewExportBackup(
	selected: Set<BackupCategoryId>,
): Promise<ExportPreview> {
	const empty: ExportPreviewParts = {
		settings: {},
		keybindings: {},
		apiKeys: {},
		background: null,
		appearancePresets: [],
		customFont: null,
		projects: [],
		versions: [],
		plugins: [],
	};
	if (selected.size === 0) return summarizeExportParts(empty, selected);

	const parts: ExportPreviewParts = { ...empty };
	const jobs: Array<Promise<void>> = [];

	if (
		selected.has("settings") ||
		selected.has("keybindings") ||
		selected.has("apiKeys")
	) {
		const { partitionLocalStorage } = await import("./export");
		const { settings, keybindings, apiKeys } = partitionLocalStorage();
		parts.settings = settings;
		parts.keybindings = keybindings;
		parts.apiKeys = apiKeys;
	}
	if (selected.has("assets")) {
		try {
			const rawPresets = localStorage.getItem("appearancePresets");
			if (rawPresets) {
				const parsed = JSON.parse(rawPresets);
				if (Array.isArray(parsed)) {
					parts.appearancePresets = parsed.map(
						(p: { id?: unknown; name?: unknown }) => ({
							id: String(p.id ?? ""),
							name: String(p.name ?? "Theme"),
							bytes: JSON.stringify(p).length,
						}),
					);
				}
			}
		} catch {}

		try {
			const fontName = localStorage.getItem("customFontName");
			const fontData = localStorage.getItem("customFontData");
			if (fontName && fontData) {
				parts.customFont = {
					name: fontName,
					bytes: fontData.length,
				};
			}
		} catch {}

		jobs.push(
			import("$/modules/settings/modals/customBackground").then(
				async ({ readCustomBackgroundBlob }) => {
					const blob = await readCustomBackgroundBlob();
					parts.background = blob
						? { mime: blob.type || "image/png", bytes: blob.size }
						: null;
				},
			),
		);
	}
	if (selected.has("projects")) {
		jobs.push(
			import("$/modules/project/autosave/autosave").then(
				async ({ exportAllProjectsData }) => {
					const { projects, versions } = await exportAllProjectsData();
					parts.projects = projects;
					parts.versions = versions;
				},
			),
		);
	}
	if (selected.has("plugins")) {
		jobs.push(
			import("$/modules/plugins/plugin-store").then(
				async ({ getAllPlugins }) => {
					const plugins = await getAllPlugins();
					parts.plugins = plugins.map((plugin) => ({
						id: plugin.id,
						name: plugin.name,
						version: plugin.version,
						kind: plugin.type,
						bytes: plugin.blob.size,
					}));
				},
			),
		);
	}

	await Promise.all(jobs);
	return summarizeExportParts(parts, selected);
}
