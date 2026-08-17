import { describe, expect, it } from "vitest";
import { PROJECT_TIME_STORAGE_KEY, ProjectTimeTracker } from "./project-time";

class MemoryStorage {
	data = new Map<string, string>();
	getItem(key: string) {
		return this.data.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		this.data.set(key, value);
	}
}

describe("ProjectTimeTracker", () => {
	it("accumulates, persists, and restores independent project totals", () => {
		const storage = new MemoryStorage();
		let now = 1_000;
		const tracker = new ProjectTimeTracker(storage, () => now);

		tracker.switchProject("one");
		now = 6_000;
		expect(tracker.getElapsedSeconds()).toBe(5);
		tracker.switchProject("two");
		now = 9_000;
		tracker.flush();

		const restored = new ProjectTimeTracker(storage, () => now);
		restored.switchProject("one");
		expect(restored.getElapsedSeconds()).toBe(5);
		restored.switchProject("two");
		expect(restored.getElapsedSeconds()).toBe(3);
	});

	it("starts new projects at zero", () => {
		const storage = new MemoryStorage();
		const tracker = new ProjectTimeTracker(storage, () => 1_000);
		tracker.switchProject("new");
		expect(tracker.getElapsedSeconds()).toBe(0);
	});

	it("ignores malformed and invalid stored values", () => {
		const storage = new MemoryStorage();
		storage.setItem(PROJECT_TIME_STORAGE_KEY, "not json");
		const malformed = new ProjectTimeTracker(storage, () => 1_000);
		malformed.switchProject("one");
		expect(malformed.getElapsedSeconds()).toBe(0);

		storage.setItem(
			PROJECT_TIME_STORAGE_KEY,
			JSON.stringify({ valid: 4, negative: -2, text: "3" }),
		);
		const filtered = new ProjectTimeTracker(storage, () => 1_000);
		filtered.switchProject("valid");
		expect(filtered.getElapsedSeconds()).toBe(4);
		filtered.switchProject("negative");
		expect(filtered.getElapsedSeconds()).toBe(0);
	});

	it("keeps tracking when persistence is unavailable", () => {
		let now = 0;
		const tracker = new ProjectTimeTracker(
			{
				getItem: () => {
					throw new Error("blocked");
				},
				setItem: () => {
					throw new Error("blocked");
				},
			},
			() => now,
		);
		tracker.switchProject("one");
		now = 2_000;
		expect(() => tracker.flush()).not.toThrow();
		expect(tracker.getElapsedSeconds()).toBe(2);
	});

	it("freezes while inactive and resumes without resetting", () => {
		const storage = new MemoryStorage();
		let now = 0;
		const tracker = new ProjectTimeTracker(storage, () => now);
		tracker.switchProject("one");
		now = 5_000;
		tracker.setPaused(true);
		now = 20_000;
		expect(tracker.getElapsedSeconds()).toBe(5);
		tracker.setPaused(false);
		now = 23_000;
		expect(tracker.getElapsedSeconds()).toBe(8);
	});
});
