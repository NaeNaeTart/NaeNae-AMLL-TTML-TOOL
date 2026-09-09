import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { spectrogramHoverSyncEnabledAtom } from "$/modules/settings/states/sync";
import {
	spectrogramContainerWidthAtom,
	spectrogramHoverPxAtom,
	spectrogramHoverTimeMsAtom,
	spectrogramIsHoveringAtom,
	spectrogramScrollLeftAtom,
	spectrogramZoomAtom,
} from "./index";

describe("Spectrogram Hover Syncing", () => {
	it("defaults spectrogramHoverSyncEnabled to false (opt-in)", () => {
		const store = createStore();
		expect(store.get(spectrogramHoverSyncEnabledAtom)).toBe(false);
	});

	it("defaults spectrogramIsHovering to false", () => {
		const store = createStore();
		expect(store.get(spectrogramIsHoveringAtom)).toBe(false);
	});

	it("accurately calculates hover time in milliseconds based on zoom and scrollLeft", () => {
		const store = createStore();
		store.set(spectrogramZoomAtom, 100);
		store.set(spectrogramContainerWidthAtom, 1000);
		store.set(spectrogramScrollLeftAtom, 500);
		store.set(spectrogramHoverPxAtom, 250);

		const hoverTimeMs = store.get(spectrogramHoverTimeMsAtom);
		expect(hoverTimeMs).toBe(7500);
	});

	it("clamps hover coordinate within container bounds", () => {
		const store = createStore();
		store.set(spectrogramZoomAtom, 200);
		store.set(spectrogramContainerWidthAtom, 800);
		store.set(spectrogramScrollLeftAtom, 0);
		store.set(spectrogramHoverPxAtom, 1000);

		const hoverTimeMs = store.get(spectrogramHoverTimeMsAtom);
		expect(hoverTimeMs).toBe(4000);
	});
});
