import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const records = vi.hoisted(
	() => new Map<string, { key: string; blob: Blob; updatedAt: number }>(),
);
vi.mock("idb", () => ({
	openDB: vi.fn(async () => ({
		get: async (_store: string, key: string) => records.get(key),
		put: async (
			_store: string,
			record: { key: string; blob: Blob; updatedAt: number },
		) => records.set(record.key, record),
	})),
}));

// These tests exercise storage atoms; importing the entire icon/UI bundles adds no coverage.
vi.mock("@fluentui/react-icons", () => ({
	ArrowHookUpLeft24Regular: () => null,
	Blur24Regular: () => null,
	Dismiss24Regular: () => null,
	Eye24Regular: () => null,
	Image24Regular: () => null,
	Layer24Regular: () => null,
	WeatherSunny24Regular: () => null,
}));
vi.mock("@radix-ui/themes", () => ({
	Box: () => null,
	Button: () => null,
	Card: () => null,
	Flex: () => null,
	Heading: () => null,
	IconButton: () => null,
	Slider: () => null,
	Text: () => null,
}));

beforeEach(() => {
	vi.resetModules();
	records.clear();
	const values = new Map<string, string>();
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
	};
	vi.stubGlobal("localStorage", storage);
	vi.stubGlobal("window", { localStorage: storage });
});
afterEach(() => vi.unstubAllGlobals());

describe("preset background image references", () => {
	it("restores an older image after replacing or clearing the active image", async () => {
		const {
			customBackgroundImageAtom,
			customBackgroundImageKeyAtom,
			readCustomBackgroundBlob,
		} = await import("./customBackground");
		const store = createStore();
		await store.set(customBackgroundImageAtom, new Blob(["first"]));
		const firstKey = store.get(customBackgroundImageKeyAtom);
		expect(firstKey).toMatch(/^image:/);
		await store.set(customBackgroundImageAtom, new Blob(["second"]));
		expect(store.get(customBackgroundImageKeyAtom)).not.toBe(firstKey);
		await store.set(customBackgroundImageAtom, null);
		await store.set(customBackgroundImageAtom, firstKey);
		expect(store.get(customBackgroundImageKeyAtom)).toBe(firstKey);
		expect(await (await readCustomBackgroundBlob())?.text()).toBe("first");
		expect(localStorage.getItem("customBackgroundImageKey")).toBe(
			JSON.stringify(firstKey),
		);
	});
	it("stores identical uploads once", async () => {
		const { writeCustomBackgroundBlob } = await import("./customBackground");
		const first = await writeCustomBackgroundBlob(new Blob(["same"]));
		const second = await writeCustomBackgroundBlob(new Blob(["same"]));
		expect(second).toBe(first);
		expect(records.size).toBe(1);
	});
	it("preserves a legacy main image and a preset that references it", async () => {
		records.set("main", {
			key: "main",
			blob: new Blob(["legacy"]),
			updatedAt: 1,
		});
		const {
			customBackgroundImageInitAtom,
			customBackgroundImageAtom,
			customBackgroundImageKeyAtom,
		} = await import("./customBackground");
		const store = createStore();
		await store.set(customBackgroundImageInitAtom);
		expect(store.get(customBackgroundImageKeyAtom)).toBe("main");
		await store.set(customBackgroundImageAtom, new Blob(["new"]));
		await store.set(customBackgroundImageAtom, "main");
		expect(store.get(customBackgroundImageKeyAtom)).toBe("main");
		expect(await records.get("main")?.blob.text()).toBe("legacy");
	});
	it("keeps the current image if an imported preset references unavailable data", async () => {
		const { customBackgroundImageAtom, customBackgroundImageKeyAtom } =
			await import("./customBackground");
		const store = createStore();
		await store.set(customBackgroundImageAtom, new Blob(["current"]));
		const key = store.get(customBackgroundImageKeyAtom);
		const url = store.get(customBackgroundImageAtom);
		await store.set(customBackgroundImageAtom, "image:missing");
		expect(store.get(customBackgroundImageKeyAtom)).toBe(key);
		expect(store.get(customBackgroundImageAtom)).toBe(url);
	});
});
