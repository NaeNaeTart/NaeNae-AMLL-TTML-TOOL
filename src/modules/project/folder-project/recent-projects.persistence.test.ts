import { afterEach, describe, expect, it, vi } from "vitest";

const { exists } = vi.hoisted(() => ({ exists: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/api/path", () => ({ join: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ exists }));
vi.mock("$/utils/logging.ts", () => ({ error: vi.fn() }));
vi.mock("./manifest", () => ({ isSafeProjectFileName: () => true }));

import {
	getRecentProjectFileStatus,
	getRecentProjects,
	RECENT_PROJECTS_STORAGE_KEY,
} from "./recent-projects";

const storage = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
	configurable: true,
	value: {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
	},
});

afterEach(() => {
	storage.clear();
	vi.clearAllMocks();
});

describe("getRecentProjects", () => {
	it("keeps a recent project when its status check is unavailable", async () => {
		storage.set(
			RECENT_PROJECTS_STORAGE_KEY,
			JSON.stringify([
				{
					dir: "C:/Projects/Song",
					name: "Song",
					audioFile: "audio.mp3",
					lyricFile: "lyric.ttml",
					lastOpened: 1,
				},
			]),
		);
		exists.mockResolvedValue(false);

		await expect(getRecentProjects()).resolves.toHaveLength(1);
	});

	it("reports an unknown status instead of missing when the check is denied", async () => {
		exists.mockRejectedValue(new Error("permission denied"));

		await expect(
			getRecentProjectFileStatus({
				dir: "C:/Projects/Song",
				name: "Song",
				audioFile: "audio.mp3",
				lyricFile: "lyric.ttml",
				lastOpened: 1,
			}),
		).resolves.toBeNull();
	});
});
