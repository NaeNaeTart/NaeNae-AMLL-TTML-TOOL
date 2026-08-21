import { describe, expect, it } from "vitest";
import { ToolMode } from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";
import {
	createDiscordTemplateContext,
	createInactiveDiscordActivity,
	createPresenceSnapshot,
	DEFAULT_DISCORD_DETAILS_TEMPLATE,
	DEFAULT_DISCORD_STATE_TEMPLATE,
	formatDiscordActivity,
	formatNativeDiscordActivity,
	renderDiscordTemplate,
	validateDiscordTemplate,
} from "./presence";

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
			showRepositoryButton: true,
			showStatusBadge: true,
		});
	});

	it("extracts cover art from metadata if present", () => {
		const lyricsWithCover = {
			...lyrics,
			metadata: [
				...lyrics.metadata,
				{ key: "cover_art", value: ["  https://example.com/cover.jpg  "] },
			],
		} as TTMLLyric;

		const snapshot = createPresenceSnapshot({
			lyrics: lyricsWithCover,
			fileName: "fallback.ttml",
			mode: ToolMode.Sync,
			selectedLineIds: new Set(),
			playing: false,
			positionSeconds: 0,
			durationSeconds: 4,
			playbackRate: 1,
		});

		expect(snapshot.coverUrl).toBe("https://example.com/cover.jpg");

		const payload = formatNativeDiscordActivity(
			snapshot,
			createDiscordTemplateContext({
				snapshot,
				lyrics: lyricsWithCover,
				fileName: "fallback.ttml",
				selectedLineIds: new Set(),
				selectedWordIds: new Set(),
			}),
			{
				detailsTemplate: "",
				stateTemplate: "",
				showPlaybackTimeline: false,
				showProjectElapsed: false,
				showRepositoryButton: false,
				showStatusBadge: false,
			},
		);

		expect(payload.largeImage).toBe("https://example.com/cover.jpg");
	});

	it("ignores cover art URLs that Discord cannot fetch", () => {
		const snapshot = createPresenceSnapshot({
			lyrics: {
				...lyrics,
				metadata: [
					...lyrics.metadata,
					{ key: "cover_art", value: ["blob:https://example.com/local"] },
				],
			} as TTMLLyric,
			fileName: "fallback.ttml",
			mode: ToolMode.Sync,
			selectedLineIds: new Set(),
			playing: false,
			positionSeconds: 0,
			durationSeconds: 4,
			playbackRate: 1,
		});

		expect(snapshot.coverUrl).toBeNull();
		expect(formatDiscordActivity(snapshot).largeImage).toBeUndefined();
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

	it("builds every native template variable with display-ready formatting", () => {
		const detailedLyrics = {
			...lyrics,
			metadata: [
				...lyrics.metadata,
				{ key: "album", value: ["Test Album"] },
				{ key: "songwriter", value: ["Writer One", "Writer Two"] },
			],
			lyricLines: lyrics.lyricLines.map((line, index) => ({
				...line,
				words: [{ id: `word-${index}`, word: index === 2 ? "Hello" : "Other" }],
			})),
			sections: [{ id: "section", label: "Verse", category: "verse" }],
		} as TTMLLyric;
		const snapshot = createPresenceSnapshot({
			lyrics: detailedLyrics,
			fileName: "project.ttml",
			mode: ToolMode.Sync,
			selectedLineIds: new Set(["second"]),
			playing: true,
			positionSeconds: 222,
			durationSeconds: 245,
			playbackRate: 1.25,
			projectElapsedSeconds: 8_040,
		});
		const context = createDiscordTemplateContext({
			snapshot,
			lyrics: detailedLyrics,
			fileName: "project.ttml",
			selectedLineIds: new Set(["second"]),
			selectedWordIds: new Set(["word-2"]),
		});

		expect(context).toEqual({
			title: "Test Song",
			fileName: "project.ttml",
			artist: "Test Artist",
			album: "Test Album",
			songwriters: "Writer One, Writer Two",
			mode: "Syncing",
			lineProgress: "Line 2 of 2",
			currentLine: "2",
			totalLines: "2",
			currentLineText: "Hello",
			selectedLines: "1",
			selectedWords: "1",
			totalWords: "3",
			sectionCount: "1",
			playbackStatus: "Playing",
			position: "3:42",
			duration: "4:05",
			remaining: "0:23",
			playbackRate: "1.25×",
			projectElapsed: "2h 14m",
			appName: "AMLL TTML Tool",
		});
	});

	it("renders optional segments only when all referenced values exist", () => {
		const context = Object.fromEntries(
			[
				"title",
				"fileName",
				"artist",
				"album",
				"songwriters",
				"mode",
				"lineProgress",
				"currentLine",
				"totalLines",
				"currentLineText",
				"selectedLines",
				"selectedWords",
				"totalWords",
				"sectionCount",
				"playbackStatus",
				"position",
				"duration",
				"remaining",
				"playbackRate",
				"projectElapsed",
				"appName",
			].map((key) => [key, key === "artist" ? "" : key]),
		) as ReturnType<typeof createDiscordTemplateContext>;

		expect(
			renderDiscordTemplate(
				"{{title}}[[ by {{artist}}]][[ • {{album}}]]",
				context,
			),
		).toBe("title • album");
	});

	it("rejects malformed, nested, and unknown template syntax", () => {
		expect(validateDiscordTemplate("{{unknown}}")).toBeTruthy();
		expect(validateDiscordTemplate("[[{{artist}}")).toBeTruthy();
		expect(validateDiscordTemplate("[[outer [[inner]]]]")).toBeTruthy();
		expect(validateDiscordTemplate("{{title}")).toBeTruthy();
		expect(validateDiscordTemplate("{{title}} [[{{artist}}]]")).toBeNull();
	});

	it("applies native visibility options and timeline precedence", () => {
		const snapshot = createPresenceSnapshot({
			lyrics,
			fileName: "fallback.ttml",
			mode: ToolMode.Preview,
			selectedLineIds: new Set(),
			playing: true,
			positionSeconds: 3,
			durationSeconds: 9,
			playbackRate: 1,
			projectElapsedSeconds: 125,
		});
		const context = createDiscordTemplateContext({
			snapshot,
			lyrics,
			fileName: "fallback.ttml",
			selectedLineIds: new Set(),
			selectedWordIds: new Set(),
		});
		const payload = formatNativeDiscordActivity(
			snapshot,
			context,
			{
				detailsTemplate: "",
				stateTemplate: "{{title}}",
				showPlaybackTimeline: true,
				showProjectElapsed: true,
				showRepositoryButton: false,
				showStatusBadge: false,
			},
			1_000,
		);

		expect(payload).toEqual({
			state: "Test Song",
			playing: true,
			showRepositoryButton: false,
			showStatusBadge: false,
			startTimestamp: 997,
			endTimestamp: 1_006,
		});

		expect(
			formatNativeDiscordActivity(
				{ ...snapshot, playing: false },
				{ ...context, playbackStatus: "Paused" },
				{
					detailsTemplate: DEFAULT_DISCORD_DETAILS_TEMPLATE,
					stateTemplate: DEFAULT_DISCORD_STATE_TEMPLATE,
					showPlaybackTimeline: false,
					showProjectElapsed: true,
					showRepositoryButton: true,
					showStatusBadge: true,
				},
				1_000,
			),
		).toMatchObject({
			details: "Previewing Test Song",
			state: "Test Artist • Line 2 of 2 • Paused",
			startTimestamp: 875,
		});
	});

	it("truncates rendered native fields by Unicode code point", () => {
		const snapshot = createPresenceSnapshot({
			lyrics,
			fileName: "fallback.ttml",
			mode: ToolMode.Edit,
			selectedLineIds: new Set(),
			playing: false,
			positionSeconds: 0,
			durationSeconds: 0,
			playbackRate: 1,
		});
		const context = createDiscordTemplateContext({
			snapshot,
			lyrics,
			fileName: "fallback.ttml",
			selectedLineIds: new Set(),
			selectedWordIds: new Set(),
		});
		const payload = formatNativeDiscordActivity(snapshot, context, {
			detailsTemplate: "😀".repeat(140),
			stateTemplate: "",
			showPlaybackTimeline: false,
			showProjectElapsed: false,
			showRepositoryButton: false,
			showStatusBadge: false,
		});

		expect(Array.from(payload.details ?? "")).toHaveLength(128);
		expect(payload.state).toBeUndefined();
		expect(payload.startTimestamp).toBeUndefined();
	});

	it("uses a generic private payload while inactive", () => {
		expect(createInactiveDiscordActivity()).toEqual({
			details: "AMLL TTML Tool",
			state: "Inactive",
			playing: false,
			showRepositoryButton: false,
			showStatusBadge: false,
		});
	});
});
