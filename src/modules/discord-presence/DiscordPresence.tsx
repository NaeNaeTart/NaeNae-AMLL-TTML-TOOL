import { invoke } from "@tauri-apps/api/core";
import { useAtomValue } from "jotai";
import { useCallback, useEffect } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { audioPlayingAtom, playbackRateAtom } from "$/modules/audio/states";
import { discordRichPresenceEnabledAtom } from "$/modules/settings/states";
import {
	lyricLinesAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	toolModeAtom,
} from "$/states/main";
import { log } from "$/utils/logging";
import {
	createPresenceSnapshot,
	formatDiscordActivity,
	PRESENCE_META_NAME,
} from "./presence";

const isTauri = Boolean(import.meta.env.TAURI_ENV_PLATFORM);

export function DiscordPresence() {
	const lyrics = useAtomValue(lyricLinesAtom);
	const fileName = useAtomValue(saveFileNameAtom);
	const mode = useAtomValue(toolModeAtom);
	const selectedLineIds = useAtomValue(selectedLinesAtom);
	const playing = useAtomValue(audioPlayingAtom);
	const playbackRate = useAtomValue(playbackRateAtom);
	const enabled = useAtomValue(discordRichPresenceEnabledAtom);

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
			invoke("set_discord_activity", {
				payload: formatDiscordActivity(snapshot),
			}).catch((error) => log("Unable to update Discord presence", error));
		}
	}, [enabled, fileName, lyrics, mode, playbackRate, playing, selectedLineIds]);

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
