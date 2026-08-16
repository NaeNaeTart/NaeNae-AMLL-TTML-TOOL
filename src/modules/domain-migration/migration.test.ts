import { describe, expect, it, vi } from "vitest";
import type { BackupFile } from "$/modules/settings/backup/types";
import {
	classifyMigrationOrigin,
	createMigrationNonce,
	LEGACY_TOOL_ORIGINS,
	OFFICIAL_TOOL_ORIGIN,
} from "./config";
import {
	getMigrationConflicts,
	hasMigrationConflicts,
	mergeMigrationBackup,
} from "./merge";
import {
	decodeMigrationPayload,
	encodeMigrationPayload,
	isMigrationMessage,
} from "./protocol";

const backup = (
	overrides: Partial<BackupFile["categories"]> = {},
): BackupFile => ({
	app: "amll-ttml-tool",
	formatVersion: 1,
	exportedAt: "2026-08-16T00:00:00.000Z",
	build: { commit: "test", time: "2026-08-16T00:00:00.000Z" },
	categories: overrides,
});

describe("domain migration hosts", () => {
	it("classifies only the official and explicitly allowed legacy origins", () => {
		expect(classifyMigrationOrigin(OFFICIAL_TOOL_ORIGIN)).toBe("official");
		for (const origin of LEGACY_TOOL_ORIGINS)
			expect(classifyMigrationOrigin(origin)).toBe("legacy");
		expect(classifyMigrationOrigin("https://preview.example.com")).toBe(
			"other",
		);
		expect(classifyMigrationOrigin(OFFICIAL_TOOL_ORIGIN, true)).toBe("other");
	});

	it("creates an unpredictable 128-bit nonce", () => {
		vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
			(array as Uint8Array).fill(0xab);
			return array;
		});
		expect(createMigrationNonce()).toBe("ab".repeat(16));
	});
});

describe("domain migration protocol", () => {
	it("round-trips payloads larger than one chunk", () => {
		const value = { text: "x".repeat(1_100_000) };
		const chunks = encodeMigrationPayload(value);
		expect(chunks.length).toBeGreaterThan(1);
		expect(decodeMigrationPayload(chunks)).toEqual(value);
	});

	it("rejects malformed, wrong-version, and incomplete messages", () => {
		expect(isMigrationMessage(null)).toBe(false);
		expect(
			isMigrationMessage({
				type: "receiver-ready",
				protocol: 2,
				nonce: "a".repeat(32),
			}),
		).toBe(false);
		expect(
			isMigrationMessage({
				type: "metadata",
				protocol: 1,
				nonce: "a".repeat(32),
				totalChunks: 1,
			}),
		).toBe(false);
		expect(
			isMigrationMessage({
				type: "chunk",
				protocol: 1,
				nonce: "a".repeat(32),
				index: 0,
				data: "bad",
			}),
		).toBe(false);
		expect(
			isMigrationMessage({
				type: "metadata",
				protocol: 1,
				nonce: "a".repeat(32),
				totalChunks: 2049,
				counts: {
					settings: 0,
					keybindings: 0,
					assets: false,
					projects: 0,
					plugins: 0,
				},
			}),
		).toBe(false);
		expect(
			isMigrationMessage({
				type: "receiver-ready",
				protocol: 1,
				nonce: "too-short",
			}),
		).toBe(false);
	});
});

describe("domain migration merge", () => {
	it("detects every supported conflict category", () => {
		const source = backup({
			settings: { localStorage: { theme: "dark" } },
			keybindings: { localStorage: { play: "space" } },
			assets: {
				backgroundImage: { mime: "image/png", dataBase64: "old", updatedAt: 1 },
			},
			projects: {
				projects: [
					{ id: "p", name: "Old", lastModified: 2, latestState: {} as never },
				],
				versions: [],
			},
			plugins: {
				plugins: [
					{
						id: "plugin",
						name: "Old",
						description: "",
						author: "",
						version: "1",
						type: "tool",
						isEnabled: true,
						createdAt: 1,
						blobBase64: "old",
						blobMime: "application/wasm",
					},
				],
			},
		});
		const destination = backup({
			settings: { localStorage: { theme: "light" } },
			keybindings: { localStorage: { play: "enter" } },
			assets: {
				backgroundImage: { mime: "image/png", dataBase64: "new", updatedAt: 2 },
			},
			projects: {
				projects: [
					{ id: "p", name: "New", lastModified: 3, latestState: {} as never },
				],
				versions: [],
			},
			plugins: {
				plugins: [
					{
						id: "plugin",
						name: "New",
						description: "",
						author: "",
						version: "2",
						type: "tool",
						isEnabled: true,
						createdAt: 2,
						blobBase64: "new",
						blobMime: "application/wasm",
					},
				],
			},
		});
		const conflicts = getMigrationConflicts(source, destination);
		expect(hasMigrationConflicts(conflicts)).toBe(true);
		expect(conflicts).toMatchObject({
			settings: ["theme"],
			keybindings: ["play"],
			projects: ["p"],
			plugins: ["plugin"],
			background: true,
		});
	});

	it("preserves destination-only data and keeps the newest matching project", () => {
		const source = backup({
			settings: { localStorage: { old: "yes", shared: "old" } },
			projects: {
				projects: [
					{ id: "p", name: "Old", lastModified: 2, latestState: {} as never },
				],
				versions: [],
			},
		});
		const destination = backup({
			settings: { localStorage: { new: "yes", shared: "new" } },
			projects: {
				projects: [
					{ id: "p", name: "New", lastModified: 3, latestState: {} as never },
				],
				versions: [],
			},
		});
		const merged = mergeMigrationBackup(source, destination, {
			replaceSettings: false,
			replaceKeybindings: false,
			replacePlugins: false,
			replaceBackground: false,
		});
		expect(merged.categories.settings?.localStorage).toEqual({
			old: "yes",
			new: "yes",
			shared: "new",
		});
		expect(merged.categories.projects?.projects[0]?.name).toBe("New");
	});

	it("applies an empty destination without creating conflicts", () => {
		const source = backup({
			settings: { localStorage: { geniusApiKey: "secret" } },
			projects: {
				projects: [
					{ id: "p", name: "Moved", lastModified: 1, latestState: {} as never },
				],
				versions: [],
			},
		});
		const destination = backup();
		const conflicts = getMigrationConflicts(source, destination);
		expect(hasMigrationConflicts(conflicts)).toBe(false);
		const merged = mergeMigrationBackup(source, destination, {
			replaceSettings: false,
			replaceKeybindings: false,
			replacePlugins: false,
			replaceBackground: false,
		});
		expect(merged.categories.settings?.localStorage.geniusApiKey).toBe(
			"secret",
		);
		expect(merged.categories.projects?.projects).toHaveLength(1);
	});
});
