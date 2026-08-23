import { createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("allowConsecutiveBackgroundLinesAtom", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("loads the persisted export setting before any component subscribes", async () => {
		const values = new Map([
			["allowConsecutiveBackgroundLines", JSON.stringify(true)],
		]);
		vi.stubGlobal("window", {
			localStorage: {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) => values.set(key, value),
				removeItem: (key: string) => values.delete(key),
			},
		});

		const { allowConsecutiveBackgroundLinesAtom } = await import("./index");
		const store = createStore();

		expect(store.get(allowConsecutiveBackgroundLinesAtom)).toBe(true);
	});
});
