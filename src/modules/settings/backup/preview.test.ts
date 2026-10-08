import { describe, expect, it } from "vitest";
import {
	type ExportPreviewParts,
	formatPreviewBytes,
	summarizeExportParts,
} from "./preview";
import type { BackupCategoryId } from "./types";

const ALL: Set<BackupCategoryId> = new Set([
	"settings",
	"keybindings",
	"assets",
	"projects",
	"plugins",
]);

function makeParts(): ExportPreviewParts {
	return {
		settings: { bKey: "22", aKey: "1" },
		keybindings: { "keybindings:play": "Space" },
		background: { mime: "image/png", bytes: 2048 },
		projects: [
			{
				id: "p2",
				name: "Beta",
				lastModified: 2,
				latestState: {} as never,
			},
			{
				id: "p1",
				name: "Alpha",
				lastModified: 1,
				latestState: {} as never,
			},
		],
		versions: [
			{ projectId: "p1", timestamp: 1, data: {} as never },
			{ projectId: "p1", timestamp: 2, data: {} as never },
		],
		plugins: [
			{
				id: "pl2",
				name: "Zeta",
				version: "2.0.0",
				kind: "tool",
				bytes: 100,
			},
			{
				id: "pl1",
				name: "Alpha",
				version: "1.0.0",
				kind: "importer",
				bytes: 10,
			},
		],
	};
}

describe("formatPreviewBytes", () => {
	it("formats bytes, kilobytes, and megabytes", () => {
		expect(formatPreviewBytes(0)).toBe("0 B");
		expect(formatPreviewBytes(512)).toBe("512 B");
		expect(formatPreviewBytes(1536)).toBe("1.5 KB");
		expect(formatPreviewBytes(2 * 1024 * 1024)).toBe("2.0 MB");
	});

	it("treats invalid input as empty", () => {
		expect(formatPreviewBytes(Number.NaN)).toBe("0 B");
		expect(formatPreviewBytes(-5)).toBe("0 B");
	});
});

describe("summarizeExportParts", () => {
	it("summarizes every selected category with sorted items", () => {
		const preview = summarizeExportParts(makeParts(), ALL);

		expect(preview.categories.map((category) => category.id)).toEqual([
			"settings",
			"keybindings",
			"assets",
			"projects",
			"plugins",
		]);
		expect(preview.categories[0].items.map((item) => item.label)).toEqual([
			"A Key",
			"B Key",
		]);
		expect(preview.categories[1].items.map((item) => item.label)).toEqual([
			"Play",
		]);
		expect(preview.categories[2].items).toEqual([
			{ key: "background", label: "image/png", detail: "2.0 KB", bytes: 2048 },
		]);
		expect(preview.categories[3].items.map((item) => item.label)).toEqual([
			"Alpha",
			"Beta",
		]);
		expect(preview.categories[3].items[0].detail).toBe("2 versions");
		expect(preview.categories[3].items[1].detail).toBe("0 versions");
		expect(preview.categories[4].items.map((item) => item.label)).toEqual([
			"Alpha 1.0.0",
			"Zeta 2.0.0",
		]);
		expect(preview.totalBytes).toBe(
			preview.categories.reduce((sum, category) => sum + category.bytes, 0),
		);
	});

	it("skips unselected categories and reports an empty selection", () => {
		const preview = summarizeExportParts(
			makeParts(),
			new Set<BackupCategoryId>(["assets"]),
		);

		expect(preview.categories.map((category) => category.id)).toEqual([
			"assets",
		]);
		expect(summarizeExportParts(makeParts(), new Set())).toEqual({
			categories: [],
			totalBytes: 0,
		});
	});

	it("previews presets and custom fonts in assets category", () => {
		const parts = makeParts();
		parts.appearancePresets = [{ id: "1", name: "Neon Dark", bytes: 512 }];
		parts.customFont = { name: "Custom Sans", bytes: 1024 };
		const preview = summarizeExportParts(
			parts,
			new Set<BackupCategoryId>(["assets"]),
		);

		expect(preview.categories[0].items).toEqual([
			{
				key: "preset:1",
				label: "Preset: Neon Dark",
				detail: "512 B",
				bytes: 512,
			},
			{
				key: "customFont",
				label: "Custom Font: Custom Sans",
				detail: "1.0 KB",
				bytes: 1024,
			},
			{ key: "background", label: "image/png", detail: "2.0 KB", bytes: 2048 },
		]);
		expect(preview.categories[0].bytes).toBe(512 + 1024 + 2048);
	});

	it("reports an empty assets category when no assets are configured", () => {
		const parts = makeParts();
		parts.background = null;
		parts.appearancePresets = [];
		parts.customFont = null;
		const preview = summarizeExportParts(
			parts,
			new Set<BackupCategoryId>(["assets"]),
		);

		expect(preview.categories[0].items).toEqual([]);
		expect(preview.categories[0].bytes).toBe(0);
	});
});
