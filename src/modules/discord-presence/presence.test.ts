import { describe, expect, it } from "vitest";
import { ToolMode } from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";
import { createPresenceSnapshot, formatDiscordActivity } from "./presence";

const lyrics = {
	metadata: [
		{ key: "musicName", value: ["Test Song"] },
		{ key: "artists", value: ["Test Artist"] },
	],
	lyricLines: [
		{ id: "first", startTime: 0, endTime: 2_000, isBG: false },
		{ id: "background", startTime: 0, endTime: 2_000, isBG: true },
		{ id: "second", startTime: 2_001, endTime: 4_000, isBG: false },
	],
} as TTMLLyric;

describe("Discord presence", () => {
	it("uses metadata and selected foreground-line progress", () => {
		const snapshot = createPresenceSnapshot({
			lyrics,
			fileName: "fallback.ttml",
			mode: ToolMode.Sync,
			selectedLineIds: new Set(["second"]),
			playing: false,
			positionSeconds: 0,
			durationSeconds: 4,
			playbackRate: 1,
		});

		expect(snapshot).toMatchObject({
			title: "Test Song",
			artist: "Test Artist",
			currentLine: 2,
			totalLines: 2,
		});
		expect(formatDiscordActivity(snapshot, 1_000)).toEqual({
			details: "Syncing Test Song",
			state: "Test Artist • Line 2 of 2 • Paused",
			playing: false,
		});
	});

	it("finds the timed preview line and corrects timestamps for playback rate", () => {
		const snapshot = createPresenceSnapshot({
			lyrics,
			fileName: "fallback.ttml",
			mode: ToolMode.Preview,
			selectedLineIds: new Set(),
			playing: true,
			positionSeconds: 3,
			durationSeconds: 9,
			playbackRate: 2,
		});

		expect(snapshot.currentLine).toBe(2);
		expect(formatDiscordActivity(snapshot, 1_000)).toMatchObject({
			startTimestamp: 998,
			endTimestamp: 1_003,
		});
	});

	it("shows accumulated project time while playback is paused", () => {
		const snapshot = createPresenceSnapshot({
			lyrics,
			fileName: "fallback.ttml",
			mode: ToolMode.Sync,
			selectedLineIds: new Set(["first"]),
			playing: false,
			positionSeconds: 3,
			durationSeconds: 9,
			playbackRate: 1,
			projectElapsedSeconds: 125,
		});

		expect(formatDiscordActivity(snapshot, 1_000)).toMatchObject({
			startTimestamp: 875,
		});
	});

	it("falls back safely for an empty untitled project", () => {
		const snapshot = createPresenceSnapshot({
			lyrics: { metadata: [], lyricLines: [] },
			fileName: "lyric.ttml",
			mode: ToolMode.Edit,
			selectedLineIds: new Set(),
			playing: false,
			positionSeconds: 0,
			durationSeconds: 0,
			playbackRate: 1,
		});

		expect(formatDiscordActivity(snapshot, 1_000)).toMatchObject({
			details: "Editing lyric",
			state: "No lyrics yet • No audio loaded",
		});
	});

	it("keeps Discord text within its field limit", () => {
		const snapshot = createPresenceSnapshot({
			lyrics: {
				metadata: [{ key: "musicName", value: ["x".repeat(200)] }],
				lyricLines: [],
			},
			fileName: "fallback.ttml",
			mode: ToolMode.Edit,
			selectedLineIds: new Set(),
			playing: false,
			positionSeconds: 0,
			durationSeconds: 0,
			playbackRate: 1,
		});

		expect(formatDiscordActivity(snapshot).details).toHaveLength(128);
	});
});
