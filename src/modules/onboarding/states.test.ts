import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
	exitBeginnerGuideAtom,
	guideCompletionAtom,
	guidePanelOpenAtom,
	guideWelcomeOpenAtom,
} from "./states";

describe("exit beginner guide", () => {
	it("closes the guide and any welcome dialog and records dismissal", () => {
		const store = createStore();
		store.set(guidePanelOpenAtom, true);
		store.set(guideWelcomeOpenAtom, true);
		store.set(exitBeginnerGuideAtom);
		expect(store.get(guidePanelOpenAtom)).toBe(false);
		expect(store.get(guideWelcomeOpenAtom)).toBe(false);
		expect(store.get(guideCompletionAtom)).toBe("dismissed");
	});
});
