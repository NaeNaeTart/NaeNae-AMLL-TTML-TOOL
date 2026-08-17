import { invoke } from "@tauri-apps/api/core";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { audioPlayingAtom, playbackRateAtom } from "$/modules/audio/states";
import {
	discordDetailsTemplateAtom,
	discordIdleTimeoutMinutesAtom,
	discordPlaybackTimelineAtom,
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

export function DiscordPresence() {
	const lyrics = useAtomValue(lyricLinesAtom);
	const fileName = useAtomValue(saveFileNameAtom);
	const mode = useAtomValue(toolModeAtom);
	const selectedLineIds = useAtomValue(selectedLinesAtom);
	const selectedWordIds = useAtomValue(selectedWordsAtom);
	const playing = useAtomValue(audioPlayingAtom);
	const playbackRate = useAtomValue(playbackRateAtom);
	const enabled = useAtomValue(discordRichPresenceEnabledAtom);
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
			invoke("set_discord_activity", {
				payload: inactive
					? createInactiveDiscordActivity()
					: formatNativeDiscordActivity(snapshot, context, {
							detailsTemplate: safeDetailsTemplate,
							stateTemplate: safeStateTemplate,
							showPlaybackTimeline,
							showProjectElapsed,
							showRepositoryButton,
							showStatusBadge,
						}),
			}).catch((error) => log("Unable to update Discord presence", error));
		}
	}, [
		enabled,
		detailsTemplate,
		fileName,
		inactive,
		lyrics,
		mode,
		playbackRate,
		playing,
		projectId,
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
