import { createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("$/states/main.ts", async () => ({
	lyricLinesAtom: (await import("jotai")).atom({ lyricLines: [] }),
}));
afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("shared playback-rate atom", () => {
	it("hydrates old speeds in range and bounds direct and functional updates", async () => {
		const values = new Map([["playbackRate", "4"]]);
		vi.stubGlobal("window", {
			localStorage: {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) => values.set(key, value),
				removeItem: (key: string) => values.delete(key),
			},
		});
		const { playbackRateAtom } = await import("./index");
		const store = createStore();
		expect(store.get(playbackRateAtom)).toBe(2);
		expect(values.get("playbackRate")).toBe("2");
		store.set(playbackRateAtom, 0);
		expect(store.get(playbackRateAtom)).toBe(0.1);
		store.set(playbackRateAtom, (speed) => speed + 4);
		expect(store.get(playbackRateAtom)).toBe(2);
		expect(values.get("playbackRate")).toBe("2");
	});
});
