import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let values: Map<string, string>;
beforeEach(() => {
	vi.resetModules();
	values = new Map();
	vi.stubGlobal("window", {
		localStorage: {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key),
		},
	});
});
afterEach(() => vi.unstubAllGlobals());

describe("per-mode settings migration", () => {
	it("copies existing choices before subscriptions and keeps each mode independent", async () => {
		values.set("syncAutoScroll", "false");
		values.set("editActiveLineHighlight", "true");
		values.set("syncTabPosition", "false");
		const atoms = await import("./sync");
		const store = createStore();
		expect(store.get(atoms.editAutoScrollAtom)).toBe(false);
		expect(store.get(atoms.syncAutoScrollAtom)).toBe(false);
		expect(store.get(atoms.syncActiveLineHighlightAtom)).toBe(true);
		expect(store.get(atoms.editActiveLineHighlightAtom)).toBe(true);
		expect(store.get(atoms.editTabPositionAtom)).toBe(false);
		expect(store.get(atoms.syncTabPositionAtom)).toBe(false);
		store.set(atoms.editAutoScrollAtom, true);
		store.set(atoms.syncActiveLineHighlightAtom, false);
		store.set(atoms.editTabPositionAtom, true);
		expect(store.get(atoms.syncAutoScrollAtom)).toBe(false);
		expect(store.get(atoms.editActiveLineHighlightAtom)).toBe(true);
		expect(store.get(atoms.syncTabPositionAtom)).toBe(false);
		vi.resetModules();
		const reloaded = await import("./sync");
		expect(createStore().get(reloaded.editAutoScrollAtom)).toBe(true);
		expect(createStore().get(reloaded.syncActiveLineHighlightAtom)).toBe(false);
	});
	it("freezes unsaved defaults too, and preserves an already split choice", async () => {
		values.set("editTabPosition", "false");
		const atoms = await import("./sync");
		const store = createStore();
		expect(store.get(atoms.editTabPositionAtom)).toBe(false);
		expect(store.get(atoms.editAutoScrollAtom)).toBe(true);
		store.set(atoms.syncAutoScrollAtom, false);
		vi.resetModules();
		expect(createStore().get((await import("./sync")).editAutoScrollAtom)).toBe(
			true,
		);
	});
});

describe("obsolete preference migration", () => {
	it("uses the canonical blur value and removes the duplicate saved setting", async () => {
		values.set("glassmorphismBlur", "30");
		values.set("advBackdropBlur", "16");
		const { glassmorphismBlurAtom } = await import("./index");
		expect(createStore().get(glassmorphismBlurAtom)).toBe(30);
		expect(values.has("advBackdropBlur")).toBe(false);
	});
	it("migrates advanced-only blur and clamps its old range", async () => {
		values.set("advBackdropBlur", "100");
		const { glassmorphismBlurAtom } = await import("./index");
		expect(createStore().get(glassmorphismBlurAtom)).toBe(64);
		expect(values.get("glassmorphismBlur")).toBe("64");
	});
	it("clears the dead MP3 flag while retaining the actual saved conversion preference", async () => {
		values.set("hideMp3ConversionWarning", "true");
		values.set("mp3ConversionMode", '"never"');
		const { mp3ConversionModeAtom, Mp3ConversionMode } = await import(
			"./index"
		);
		expect(createStore().get(mp3ConversionModeAtom)).toBe(
			Mp3ConversionMode.Never,
		);
		expect(values.has("hideMp3ConversionWarning")).toBe(false);
	});
});
