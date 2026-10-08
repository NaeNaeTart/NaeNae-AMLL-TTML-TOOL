import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("virtual:buildmeta", () => ({
	BUILD_TIME: "2026-01-01T00:00:00.000Z",
	GIT_COMMIT: "test",
}));
vi.mock("$/utils/fileSystem", () => ({ saveFile: vi.fn() }));
vi.mock("$/modules/project/autosave/autosave", () => ({
	exportAllProjectsData: vi.fn(async () => ({ projects: [], versions: [] })),
	restoreProjectsData: vi.fn(),
}));
vi.mock("$/modules/settings/modals/customBackground", () => ({
	readCustomBackgroundBlob: vi.fn(async () => null),
	writeCustomBackgroundBlob: vi.fn(),
}));

import { buildBackup, partitionLocalStorage } from "./export";
import { applyBackup, getPresentCategories, parseBackupFile } from "./import";
import type { BackupCategoryId, BackupFile } from "./types";

class MemoryStorage {
	private data = new Map<string, string>();
	get length() {
		return this.data.size;
	}
	key(index: number) {
		return [...this.data.keys()][index] ?? null;
	}
	getItem(key: string) {
		return this.data.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		this.data.set(key, String(value));
	}
	removeItem(key: string) {
		this.data.delete(key);
	}
	clear() {
		this.data.clear();
	}
}

const ALL: Set<BackupCategoryId> = new Set([
	"settings",
	"keybindings",
	"assets",
	"projects",
]);

const PRESETS = [{ id: "1", name: "Neon", settings: { accentColor: "pink" } }];

beforeEach(() => {
	vi.stubGlobal("localStorage", new MemoryStorage());
	localStorage.setItem("accentColor", JSON.stringify("iris"));
	localStorage.setItem("keybindings:play", "Space");
	localStorage.setItem("appearancePresets", JSON.stringify(PRESETS));
	localStorage.setItem("customFontName", "Custom Sans");
	localStorage.setItem("customFontData", "data:font/woff2;base64,AAAA");
	localStorage.setItem("geniusApiKey", JSON.stringify("secret-genius"));
	localStorage.setItem("aiSidebarApiKey", JSON.stringify("secret-ai"));
	localStorage.setItem("lastWorkspaceDir", JSON.stringify("C:\\Users\\me"));
	localStorage.setItem("amll-ttml:recent-projects", "[]");
	localStorage.setItem("sentry-foo", "x");
});

describe("backup export", () => {
	it("keeps secrets and machine-specific keys out of the settings category", () => {
		const { settings, keybindings, apiKeys } = partitionLocalStorage();

		expect(Object.keys(settings)).toEqual(["accentColor"]);
		expect(Object.keys(keybindings)).toEqual(["keybindings:play"]);
		expect(Object.keys(apiKeys).sort()).toEqual(["geniusApiKey"]);
	});

	it("exports presets and custom font only through the assets category", async () => {
		const backup = await buildBackup(ALL);

		expect(backup.categories.settings?.localStorage).toEqual({
			accentColor: JSON.stringify("iris"),
		});
		expect(backup.categories.assets).toEqual({
			backgroundImage: null,
			appearancePresets: PRESETS,
			customFont: { name: "Custom Sans", data: "data:font/woff2;base64,AAAA" },
		});
		expect(JSON.stringify(backup)).not.toContain("secret-genius");
		expect(JSON.stringify(backup)).not.toContain("secret-ai");
		expect(JSON.stringify(backup)).not.toContain("C:\\\\Users");
	});

	it("round-trips through JSON into a clean storage", async () => {
		const backup = JSON.parse(JSON.stringify(await buildBackup(ALL)));
		localStorage.clear();

		await applyBackup(backup as BackupFile, ALL);

		expect(localStorage.getItem("accentColor")).toBe(JSON.stringify("iris"));
		expect(localStorage.getItem("keybindings:play")).toBe("Space");
		expect(
			JSON.parse(localStorage.getItem("appearancePresets") ?? "[]"),
		).toEqual(PRESETS);
		expect(localStorage.getItem("customFontName")).toBe("Custom Sans");
		expect(localStorage.getItem("customFontData")).toBe(
			"data:font/woff2;base64,AAAA",
		);
	});
});

describe("backup import", () => {
	it("ignores retired plugin categories in old backups", async () => {
		const backup = parseBackupFile(
			JSON.stringify({
				app: "amll-ttml-tool",
				formatVersion: 1,
				categories: {
					settings: { localStorage: { accentColor: JSON.stringify("ruby") } },
					plugins: { plugins: [{ id: "old", blobBase64: "AA==" }] },
				},
			}),
		);
		expect(getPresentCategories(backup)).toEqual(["settings"]);
		await applyBackup(backup, new Set(getPresentCategories(backup)));
		expect(localStorage.getItem("accentColor")).toBe(JSON.stringify("ruby"));
	});

	it("does not export or restore retired settings, commands, or AI keys", async () => {
		const retired = {
			importAddSpaces: "true",
			importSplitHyphens: "true",
			vRibbonPosition: JSON.stringify("left"),
			aiSidebarEnabled: "true",
			aiSidebarApiKey: JSON.stringify("retired-secret"),
			"keybindings:selectInverted": "KeyI",
			"keybindings:selectWordsOfMatchedSelection": "F2",
		};
		for (const [key, value] of Object.entries(retired)) {
			localStorage.setItem(key, value);
		}
		const exported = await buildBackup(new Set([...ALL, "apiKeys"]));
		for (const key of Object.keys(retired)) {
			expect(JSON.stringify(exported)).not.toContain(key);
		}
		localStorage.clear();
		await applyBackup(
			{
				...craft(retired),
				categories: {
					settings: { localStorage: retired },
					keybindings: { localStorage: retired },
					apiKeys: { localStorage: retired },
				},
			},
			new Set([...ALL, "apiKeys"]),
		);
		for (const key of Object.keys(retired)) {
			expect(localStorage.getItem(key)).toBeNull();
		}
	});

	function craft(settings: Record<string, string>): BackupFile {
		return {
			app: "amll-ttml-tool",
			formatVersion: 1,
			exportedAt: "2026-01-01T00:00:00.000Z",
			build: { commit: "x", time: "x" },
			categories: { settings: { localStorage: settings } },
		} as BackupFile;
	}

	it("never writes secrets or machine-specific keys from a backup file", async () => {
		localStorage.clear();
		await applyBackup(
			craft({
				accentColor: JSON.stringify("ruby"),
				geniusApiKey: JSON.stringify("injected"),
				aiSidebarApiKey: JSON.stringify("injected"),
				lastWorkspaceDir: JSON.stringify("D:\\x"),
			}),
			new Set<BackupCategoryId>(["settings"]),
		);

		expect(localStorage.getItem("accentColor")).toBe(JSON.stringify("ruby"));
		expect(localStorage.getItem("geniusApiKey")).toBeNull();
		expect(localStorage.getItem("aiSidebarApiKey")).toBeNull();
		expect(localStorage.getItem("lastWorkspaceDir")).toBeNull();
	});

	it("still restores presets and font stored in settings by older backups", async () => {
		localStorage.clear();
		await applyBackup(
			craft({
				appearancePresets: JSON.stringify(PRESETS),
				customFontName: "Old Font",
				customFontData: "data:font/woff2;base64,BBBB",
			}),
			new Set<BackupCategoryId>(["settings"]),
		);

		expect(localStorage.getItem("customFontName")).toBe("Old Font");
		expect(localStorage.getItem("appearancePresets")).toBe(
			JSON.stringify(PRESETS),
		);
	});
});

describe("backup api keys category", () => {
	const KEYS = new Set<BackupCategoryId>(["apiKeys"]);

	it("is exported only when selected", async () => {
		expect((await buildBackup(ALL)).categories.apiKeys).toBeUndefined();

		const backup = await buildBackup(KEYS);

		expect(backup.categories.apiKeys?.localStorage).toEqual({
			geniusApiKey: JSON.stringify("secret-genius"),
		});
	});

	it("skips empty keys", async () => {
		localStorage.setItem("geniusApiKey", JSON.stringify(""));

		const backup = await buildBackup(KEYS);

		expect(Object.keys(backup.categories.apiKeys?.localStorage ?? {})).toEqual(
			[],
		);
	});

	it("restores keys and ignores anything else in the category", async () => {
		const backup = JSON.parse(JSON.stringify(await buildBackup(KEYS)));
		backup.categories.apiKeys.localStorage.accentColor = JSON.stringify("x");
		localStorage.clear();

		await applyBackup(backup as BackupFile, KEYS);

		expect(localStorage.getItem("geniusApiKey")).toBe(
			JSON.stringify("secret-genius"),
		);
		expect(localStorage.getItem("aiSidebarApiKey")).toBeNull();
		expect(localStorage.getItem("accentColor")).toBeNull();
	});

	it("is not applied unless selected", async () => {
		const backup = JSON.parse(JSON.stringify(await buildBackup(KEYS)));
		localStorage.clear();

		await applyBackup(backup as BackupFile, ALL);

		expect(localStorage.getItem("geniusApiKey")).toBeNull();
	});
});
