import { createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("showPreviewPanelAtom persistence", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("defaults to hidden, writes the toggle to storage, and hydrates new stores from it", async () => {
		const values = new Map<string, string>();
		vi.stubGlobal("window", {
			localStorage: {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) => values.set(key, value),
				removeItem: (key: string) => values.delete(key),
			},
		});

		const { showPreviewPanelAtom } = await import("./main");
		const store = createStore();
		expect(store.get(showPreviewPanelAtom)).toBe(false);

		store.set(showPreviewPanelAtom, true);
		expect(values.get("showPreviewPanel")).toBe("true");

		const nextSessionStore = createStore();
		nextSessionStore.sub(showPreviewPanelAtom, () => {});
		expect(nextSessionStore.get(showPreviewPanelAtom)).toBe(true);

		nextSessionStore.set(showPreviewPanelAtom, false);
		expect(values.get("showPreviewPanel")).toBe("false");
	});
});
