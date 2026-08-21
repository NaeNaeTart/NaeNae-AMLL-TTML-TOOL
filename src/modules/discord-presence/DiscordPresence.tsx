import { invoke } from "@tauri-apps/api/core";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { audioCoverArtAtom, audioPlayingAtom, playbackRateAtom } from "$/modules/audio/states";
import {
	discordDetailsTemplateAtom,
	discordIdleTimeoutMinutesAtom,
	discordPlaybackTimelineAtom,
	discordPresenceImageSourceAtom,
	DiscordPresenceImageSource,
	discordProjectElapsedAtom,
	discordRepositoryButtonAtom,
	discordRichPresenceEnabledAtom,
	discordStateTemplateAtom,
	discordStatusBadgeAtom,
} from "$/modules/settings/states";
import {
	lyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	toolModeAtom,
} from "$/states/main";
import { findMetadataCoverArt, resolveOnlineCoverArt } from "$/utils/color-extract";
import { log } from "$/utils/logging";
import { InactivityTimer, shouldResetInactivity } from "./inactivity";
import {
	createDiscordTemplateContext,
	createInactiveDiscordActivity,
	createPresenceSnapshot,
	DEFAULT_DISCORD_DETAILS_TEMPLATE,
	DEFAULT_DISCORD_STATE_TEMPLATE,
	formatNativeDiscordActivity,
	PRESENCE_META_NAME,
	validateDiscordTemplate,
} from "./presence";
import { ProjectTimeTracker } from "./project-time";

const isTauri = Boolean(import.meta.env.TAURI_ENV_PLATFORM);

const remoteCoverArtCache = new Map<string, string>();

function coverArtContentHash(bytes: Uint8Array): string {
	let hash = 0;
	const step = Math.max(1, Math.floor(bytes.length / 4096));
	for (let i = 0; i < bytes.length; i += step) {
		hash = (hash * 31 + bytes[i]) | 0;
	}
	return hash.toString(36);
}

async function publishCoverArtToRemoteHost(bytes: Uint8Array): Promise<string | null> {
	const hash = coverArtContentHash(bytes);
	const cached = remoteCoverArtCache.get(hash);
	if (cached) return cached;

	// 1. Try tmpfiles.org (direct static CDN link)
	try {
		const form = new FormData();
		form.append("input_file", new Blob([bytes.buffer as ArrayBuffer], { type: "image/png" }), "cover.png");
		const response = await fetch("https://tmpfiles.org/api/v1/upload", {
			method: "POST",
			body: form,
		});
		if (response.ok) {
			const json = (await response.json()) as { data?: { url?: string } };
			const rawUrl = json.data?.url;
			if (rawUrl) {
				const directUrl = rawUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
				remoteCoverArtCache.set(hash, directUrl);
				return directUrl;
			}
		}
	} catch {}

	// 2. Try catbox.moe
	try {
		const form = new FormData();
		form.append("reqtype", "fileupload");
		form.append("fileToUpload", new Blob([bytes.buffer as ArrayBuffer], { type: "image/png" }), "cover.png");
		const response = await fetch("https://catbox.moe/user/api.php", {
			method: "POST",
			body: form,
		});
		const text = (await response.text()).trim();
		const url = /^https?:\/\//i.test(text) ? text : null;
		if (url) {
			remoteCoverArtCache.set(hash, url);
			return url;
		}
	} catch {}

	// 3. Try litterbox
	try {
		const form = new FormData();
		form.append("reqtype", "fileupload");
		form.append("time", "24h");
		form.append("fileToUpload", new Blob([bytes.buffer as ArrayBuffer], { type: "image/png" }), "cover.png");
		const response = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
			method: "POST",
			body: form,
		});
		const text = (await response.text()).trim();
		const url = /^https?:\/\//i.test(text) ? text : null;
		if (url) {
			remoteCoverArtCache.set(hash, url);
			return url;
		}
	} catch {}

	return null;
}

export function DiscordPresence() {
	const lyrics = useAtomValue(lyricLinesAtom);
	const fileName = useAtomValue(saveFileNameAtom);
	const mode = useAtomValue(toolModeAtom);
	const selectedLineIds = useAtomValue(selectedLinesAtom);
	const selectedWordIds = useAtomValue(selectedWordsAtom);
	const playing = useAtomValue(audioPlayingAtom);
	const playbackRate = useAtomValue(playbackRateAtom);
	const enabled = useAtomValue(discordRichPresenceEnabledAtom);
	const imageSource = useAtomValue(discordPresenceImageSourceAtom);
	const embeddedCoverArt = useAtomValue(audioCoverArtAtom);
	const detailsTemplate = useAtomValue(discordDetailsTemplateAtom);
	const stateTemplate = useAtomValue(discordStateTemplateAtom);
	const showPlaybackTimeline = useAtomValue(discordPlaybackTimelineAtom);
	const showProjectElapsed = useAtomValue(discordProjectElapsedAtom);
	const showRepositoryButton = useAtomValue(discordRepositoryButtonAtom);
	const showStatusBadge = useAtomValue(discordStatusBadgeAtom);
	const idleTimeoutMinutes = useAtomValue(discordIdleTimeoutMinutesAtom);
	const projectId = useAtomValue(projectIdAtom);
	const [inactive, setInactive] = useState(false);
	const trackerRef = useRef<ProjectTimeTracker | null>(null);
	if (!trackerRef.current) {
		trackerRef.current = new ProjectTimeTracker(window.localStorage);
	}
	const tracker = trackerRef.current;

	useEffect(() => {
		if (!isTauri) return;
		const timeoutMinutes = Math.min(60, Math.max(1, idleTimeoutMinutes));
		const timer = new InactivityTimer(
			timeoutMinutes * 60_000,
			(nextInactive) => {
				tracker.setPaused(nextInactive);
				setInactive(nextInactive);
			},
		);
		const markActivity = (event: Event) => {
			if (!shouldResetInactivity(event.isTrusted, document.visibilityState))
				return;
			timer.activity();
		};
		const markFocused = (event: Event) => markActivity(event);
		const eventOptions = { passive: true } as const;
		window.addEventListener("keydown", markActivity);
		window.addEventListener("pointerdown", markActivity, eventOptions);
		window.addEventListener("touchstart", markActivity, eventOptions);
		window.addEventListener("wheel", markActivity, eventOptions);
		window.addEventListener("focus", markFocused);
		timer.start();
		return () => {
			timer.stop();
			window.removeEventListener("keydown", markActivity);
			window.removeEventListener("pointerdown", markActivity);
			window.removeEventListener("touchstart", markActivity);
			window.removeEventListener("wheel", markActivity);
			window.removeEventListener("focus", markFocused);
		};
	}, [idleTimeoutMinutes, tracker]);

	useEffect(() => {
		tracker.switchProject(projectId);
		const flush = () => tracker.flush();
		const timer = window.setInterval(flush, 10_000);
		window.addEventListener("pagehide", flush);
		return () => {
			window.clearInterval(timer);
			window.removeEventListener("pagehide", flush);
			flush();
		};
	}, [projectId, tracker]);

	const metadataCoverArtUrl = useMemo(() => {
		const found = findMetadataCoverArt(lyrics.metadata);
		return found && /^https?:\/\//i.test(found) ? found : null;
	}, [lyrics.metadata]);

	const title = useMemo(
		() =>
			lyrics.metadata.find((m) =>
				["musicname", "title"].includes(m.key.toLowerCase()),
			)?.value[0] || fileName.replace(/\.[^.]*$/, ""),
		[lyrics.metadata, fileName],
	);
	const artist = useMemo(
		() =>
			lyrics.metadata.find((m) =>
				["artists", "artist"].includes(m.key.toLowerCase()),
			)?.value[0] || "",
		[lyrics.metadata],
	);
	const album = useMemo(
		() =>
			lyrics.metadata.find((m) =>
				["album", "albumname"].includes(m.key.toLowerCase()),
			)?.value[0] || "",
		[lyrics.metadata],
	);
	const ncmMusicId = useMemo(
		() =>
			lyrics.metadata.find((m) =>
				["ncmmusicid", "musicid"].includes(m.key.toLowerCase()),
			)?.value[0] || "",
		[lyrics.metadata],
	);
	const appleMusicId = useMemo(
		() =>
			lyrics.metadata.find((m) =>
				["applemusicid", "itunesid"].includes(m.key.toLowerCase()),
			)?.value[0] || "",
		[lyrics.metadata],
	);

	const [remoteCoverArt, setRemoteCoverArt] = useState<string | null>(null);
	const [onlineCoverArt, setOnlineCoverArt] = useState<string | null>(null);

	useEffect(() => {
		if (!isTauri || !embeddedCoverArt) {
			setRemoteCoverArt(null);
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				const response = await fetch(embeddedCoverArt);
				const bytes = new Uint8Array(await response.arrayBuffer());
				const remoteUrl = await publishCoverArtToRemoteHost(bytes);
				if (!cancelled) setRemoteCoverArt(remoteUrl);
			} catch (error) {
				log("Unable to publish remote cover art for Discord", error);
				if (!cancelled) setRemoteCoverArt(null);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [embeddedCoverArt]);

	useEffect(() => {
		const isDefaultState = title.toLowerCase() === "lyric" && !artist && !album && lyrics.lyricLines.length === 0;
		if (
			!enabled ||
			imageSource !== DiscordPresenceImageSource.SongCoverArt ||
			!title ||
			isDefaultState
		) {
			setOnlineCoverArt(null);
			return;
		}
		let cancelled = false;
		resolveOnlineCoverArt(title, artist, {
			album: album || undefined,
			ncmMusicId: ncmMusicId || undefined,
			appleMusicId: appleMusicId || undefined,
		}).then((url) => {
			if (!cancelled) setOnlineCoverArt(url);
		});
		return () => {
			cancelled = true;
		};
	}, [
		enabled,
		imageSource,
		title,
		artist,
		album,
		ncmMusicId,
		appleMusicId,
	]);

	const publish = useCallback(() => {
		const snapshot = createPresenceSnapshot({
			lyrics,
			fileName,
			mode,
			selectedLineIds,
			playing,
			positionSeconds: audioEngine.musicCurrentTime,
			durationSeconds: audioEngine.musicDuration,
			playbackRate,
			projectElapsedSeconds: tracker.getElapsedSeconds(projectId),
		});

		const coverArtUrl =
			imageSource === DiscordPresenceImageSource.SongCoverArt
				? (metadataCoverArtUrl ?? remoteCoverArt ?? onlineCoverArt)
				: null;

		let meta = document.head.querySelector<HTMLMetaElement>(
			`meta[name="${PRESENCE_META_NAME}"]`,
		);
		if (!meta) {
			meta = document.createElement("meta");
			meta.name = PRESENCE_META_NAME;
			document.head.append(meta);
		}
		meta.content = JSON.stringify(snapshot);

		if (isTauri && enabled) {
			const safeDetailsTemplate = validateDiscordTemplate(detailsTemplate)
				? DEFAULT_DISCORD_DETAILS_TEMPLATE
				: detailsTemplate;
			const safeStateTemplate = validateDiscordTemplate(stateTemplate)
				? DEFAULT_DISCORD_STATE_TEMPLATE
				: stateTemplate;
			const context = createDiscordTemplateContext({
				snapshot,
				lyrics,
				fileName,
				selectedLineIds,
				selectedWordIds,
			});
			const payload = inactive
				? createInactiveDiscordActivity()
				: formatNativeDiscordActivity(snapshot, context, {
						detailsTemplate: safeDetailsTemplate,
						stateTemplate: safeStateTemplate,
						showPlaybackTimeline,
						showProjectElapsed,
						showRepositoryButton,
						showStatusBadge,
					});
			if (
				coverArtUrl &&
				/^https?:\/\//i.test(coverArtUrl) &&
				!coverArtUrl.includes("data:")
			) {
				payload.largeImage = coverArtUrl;
			}

			invoke("set_discord_activity", {
				payload,
			}).catch((error) => log("Unable to update Discord presence", error));
		}
	}, [
		enabled,
		detailsTemplate,
		fileName,
		imageSource,
		inactive,
		lyrics,
		metadataCoverArtUrl,
		mode,
		onlineCoverArt,
		playbackRate,
		playing,
		projectId,
		remoteCoverArt,
		selectedLineIds,
		selectedWordIds,
		showPlaybackTimeline,
		showProjectElapsed,
		showRepositoryButton,
		showStatusBadge,
		stateTemplate,
		tracker,
	]);

	useEffect(() => {
		publish();
		if (!playing) return;
		const timer = window.setInterval(publish, 1000);
		return () => window.clearInterval(timer);
	}, [playing, publish]);

	useEffect(() => {
		if (!isTauri || enabled) return;
		invoke("clear_discord_activity").catch((error) =>
			log("Unable to clear Discord presence", error),
		);
	}, [enabled]);

	useEffect(
		() => () => {
			if (isTauri) void invoke("clear_discord_activity");
		},
		[],
	);

	return null;
}
