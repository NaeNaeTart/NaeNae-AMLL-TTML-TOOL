import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("preview renderer persistence", () => {
	beforeEach(() => {
		// Vite's Jotai refresh plugin caches atoms across vi.resetModules().
		vi.stubGlobal("jotaiAtomCache", undefined);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it.each([
		"amll",
		"unknown",
	])("falls back to Spicy for the saved renderer %s before mounting", async (saved) => {
		const values = new Map([["previewModeType", JSON.stringify(saved)]]);
		vi.stubGlobal("window", {
			localStorage: {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) => values.set(key, value),
				removeItem: (key: string) => values.delete(key),
			},
		});
		const { previewModeTypeAtom, PreviewModeType } = await import("./preview");
		const store = createStore();
		expect(store.get(previewModeTypeAtom)).toBe(PreviewModeType.Spicy);

		const unsubscribe = store.sub(previewModeTypeAtom, () => {});
		expect(store.get(previewModeTypeAtom)).toBe(PreviewModeType.Spicy);
		store.set(previewModeTypeAtom, PreviewModeType.Toxi);
		expect(store.get(previewModeTypeAtom)).toBe(PreviewModeType.Toxi);
		expect(values.get("previewModeType")).toBe(JSON.stringify("toxi"));
		unsubscribe();
	});

	it("keeps each remaining renderer and the existing default", async () => {
		vi.stubGlobal("window", {
			localStorage: {
				getItem: () => null,
				setItem: vi.fn(),
				removeItem: vi.fn(),
			},
		});
		const { previewModeTypeAtom, PreviewModeType, normalizePreviewMode } =
			await import("./preview");
		for (const renderer of Object.values(PreviewModeType)) {
			expect(normalizePreviewMode(renderer)).toBe(renderer);
		}
		expect(createStore().get(previewModeTypeAtom)).toBe(
			PreviewModeType.Standard,
		);
	});
});
