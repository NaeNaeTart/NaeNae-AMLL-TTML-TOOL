import { ToolMode } from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";

export const PRESENCE_BRIDGE_VERSION = 1;
export const PRESENCE_META_NAME = "amll-discord-presence";
export const DISCORD_LOGO_URL = "https://i.imgur.com/78zp1Xo.png";
export const REPOSITORY_URL =
	"https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL";

export interface PresenceSnapshot {
	version: typeof PRESENCE_BRIDGE_VERSION;
	mode: ToolMode;
	title: string;
	artist: string;
	currentLine: number | null;
	totalLines: number;
	playing: boolean;
	positionSeconds: number;
	durationSeconds: number;
	playbackRate: number;
}

export interface DiscordActivityPayload {
	details: string;
	state: string;
	playing: boolean;
	startTimestamp?: number;
	endTimestamp?: number;
}

const firstMetadataValue = (lyrics: TTMLLyric, key: string) =>
	lyrics.metadata
		.find((entry) => entry.key.toLowerCase() === key.toLowerCase())
		?.value.find((value) => value.trim())
		?.trim() ?? "";

export function createPresenceSnapshot({
	lyrics,
	fileName,
	mode,
	selectedLineIds,
	playing,
	positionSeconds,
	durationSeconds,
	playbackRate,
}: {
	lyrics: TTMLLyric;
	fileName: string;
	mode: ToolMode;
	selectedLineIds: Set<string>;
	playing: boolean;
	positionSeconds: number;
	durationSeconds: number;
	playbackRate: number;
}): PresenceSnapshot {
	const primaryLines = lyrics.lyricLines.filter((line) => !line.isBG);
	let currentIndex = -1;

	if (mode === ToolMode.Preview) {
		const positionMs = positionSeconds * 1000;
		currentIndex = primaryLines.findIndex(
			(line) => positionMs >= line.startTime && positionMs <= line.endTime,
		);
	} else {
		currentIndex = primaryLines.findIndex((line) =>
			selectedLineIds.has(line.id),
		);
	}

	return {
		version: PRESENCE_BRIDGE_VERSION,
		mode,
		title:
			firstMetadataValue(lyrics, "musicName") ||
			fileName.replace(/\.(?:ttml|lrc|txt)$/i, "").trim(),
		artist: firstMetadataValue(lyrics, "artists"),
		currentLine: currentIndex >= 0 ? currentIndex + 1 : null,
		totalLines: primaryLines.length,
		playing,
		positionSeconds: Math.max(0, positionSeconds),
		durationSeconds: Math.max(0, durationSeconds),
		playbackRate: Math.max(0.01, playbackRate),
	};
}

const modeLabels: Record<ToolMode, string> = {
	[ToolMode.Edit]: "Editing",
	[ToolMode.Sync]: "Syncing",
	[ToolMode.Preview]: "Previewing",
};

const truncateDiscordText = (value: string) =>
	Array.from(value).slice(0, 128).join("");

export function formatDiscordActivity(
	snapshot: PresenceSnapshot,
	nowSeconds = Math.floor(Date.now() / 1000),
): DiscordActivityPayload {
	const subject = snapshot.title || "Untitled lyrics";
	const progress = snapshot.currentLine
		? `Line ${snapshot.currentLine} of ${snapshot.totalLines}`
		: snapshot.totalLines > 0
			? `${snapshot.totalLines} lines`
			: "No lyrics yet";
	const playbackStatus = snapshot.playing
		? "Playing"
		: snapshot.durationSeconds > 0
			? "Paused"
			: "No audio loaded";
	const stateBase = snapshot.artist
		? `${snapshot.artist} • ${progress}`
		: progress;
	const state = `${stateBase} • ${playbackStatus}`;
	const payload: DiscordActivityPayload = {
		details: truncateDiscordText(`${modeLabels[snapshot.mode]} ${subject}`),
		state: truncateDiscordText(state),
		playing: snapshot.playing,
	};

	if (snapshot.playing && snapshot.durationSeconds > snapshot.positionSeconds) {
		const elapsed = snapshot.positionSeconds / snapshot.playbackRate;
		const remaining =
			(snapshot.durationSeconds - snapshot.positionSeconds) /
			snapshot.playbackRate;
		payload.startTimestamp = Math.floor(nowSeconds - elapsed);
		payload.endTimestamp = Math.ceil(nowSeconds + remaining);
	}

	return payload;
}
