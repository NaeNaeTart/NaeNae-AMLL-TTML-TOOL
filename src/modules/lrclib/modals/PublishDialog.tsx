import { stringifyLrc } from "@applemusic-like-lyrics/lyric";
import {
	CheckmarkCircle16Filled,
	DismissCircle16Filled,
	Info16Regular,
	Warning16Filled,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Callout,
	Checkbox,
	Dialog,
	Flex,
	Tabs,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { currentDurationAtom } from "$/modules/audio/states";
import { exportLyricsfileText } from "$/modules/lyricsfile-processor/writer";
import { publishToLRCLIBDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";
import { LrcLibApi } from "../api/client";
import { solveChallenge } from "../utils/challenge-solver";

type PublishState =
	| { status: "idle" }
	| { status: "requesting_challenge" }
	| {
			status: "solving_challenge";
			attempts: number;
			elapsedMs: number;
	  }
	| { status: "publishing" }
	| { status: "success"; trackName: string; artistName: string }
	| { status: "error"; message: string };

function extractMetadataValue(
	metadata: TTMLLyric["metadata"],
	keys: string[],
): string {
	for (const key of keys) {
		const found = metadata.find((m) => m.key.toLowerCase() === key.toLowerCase());
		if (found?.value && found.value.length > 0) {
			return found.value.join(", ").trim();
		}
	}
	return "";
}

function generatePlainLyrics(ttml: TTMLLyric): string {
	return ttml.lyricLines
		.map((line) => line.words.map((w) => w.word).join("").trim())
		.filter((text) => text.length > 0)
		.join("\n");
}

function generateSyncedLyrics(ttml: TTMLLyric): string {
	try {
		return stringifyLrc(ttml.lyricLines) || "";
	} catch {
		return "";
	}
}

export function PublishDialog() {
	const [open, setOpen] = useAtom(publishToLRCLIBDialogAtom);
	const ttml = useAtomValue(lyricLinesAtom);
	const currentAudioDurationMs = useAtomValue(currentDurationAtom);
	const { t } = useTranslation();

	const [trackName, setTrackName] = useState("");
	const [artistName, setArtistName] = useState("");
	const [albumName, setAlbumName] = useState("");
	const [durationSeconds, setDurationSeconds] = useState<number | "">("");

	const [includeLyricsfile, setIncludeLyricsfile] = useState(true);
	const [includeSyncedLyrics, setIncludeSyncedLyrics] = useState(true);
	const [includePlainLyrics, setIncludePlainLyrics] = useState(true);

	const [publishState, setPublishState] = useState<PublishState>({
		status: "idle",
	});

	const abortControllerRef = useRef<AbortController | null>(null);

	// Pre-fill form values when opening dialog
	useEffect(() => {
		if (open) {
			const initTrack = extractMetadataValue(ttml.metadata, [
				"musicName",
				"title",
				"trackName",
			]);
			const initArtist = extractMetadataValue(ttml.metadata, [
				"artists",
				"artist",
				"singer",
			]);
			const initAlbum = extractMetadataValue(ttml.metadata, [
				"album",
				"albumName",
			]);

			setTrackName(initTrack);
			setArtistName(initArtist);
			setAlbumName(initAlbum);

			let durSec = 0;
			if (currentAudioDurationMs > 0) {
				durSec = Math.round(currentAudioDurationMs / 1000);
			} else if (ttml.lyricLines.length > 0) {
				const lastLine = ttml.lyricLines[ttml.lyricLines.length - 1];
				durSec = Math.ceil(lastLine.endTime / 1000);
			}
			setDurationSeconds(durSec > 0 ? durSec : "");
			setPublishState({ status: "idle" });
		}
	}, [open, ttml, currentAudioDurationMs]);

	// Clean up abort controller on unmount or close
	useEffect(() => {
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, []);

	// Generated formats for preview
	const generatedLyricsfile = useMemo(() => {
		try {
			return exportLyricsfileText(ttml);
		} catch (e) {
			return `# Error generating Lyricsfile: ${e}`;
		}
	}, [ttml]);

	const generatedSyncedLyrics = useMemo(() => {
		return generateSyncedLyrics(ttml);
	}, [ttml]);

	const generatedPlainLyrics = useMemo(() => {
		return generatePlainLyrics(ttml);
	}, [ttml]);

	const hasAnyPayload =
		(includeLyricsfile && generatedLyricsfile.trim().length > 0) ||
		(includeSyncedLyrics && generatedSyncedLyrics.trim().length > 0) ||
		(includePlainLyrics && generatedPlainLyrics.trim().length > 0);

	const isFormValid =
		trackName.trim().length > 0 &&
		artistName.trim().length > 0 &&
		hasAnyPayload;

	const isBusy =
		publishState.status === "requesting_challenge" ||
		publishState.status === "solving_challenge" ||
		publishState.status === "publishing";

	const handleCancelSolving = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		setPublishState({ status: "idle" });
	};

	const handlePublish = async () => {
		if (!isFormValid || isBusy) return;

		const controller = new AbortController();
		abortControllerRef.current = controller;

		try {
			// Step 1: Request Challenge
			setPublishState({ status: "requesting_challenge" });
			const challenge = await LrcLibApi.requestChallenge();

			if (controller.signal.aborted) return;

			// Step 2: Solve Challenge
			setPublishState({
				status: "solving_challenge",
				attempts: 0,
				elapsedMs: 0,
			});

			const token = await solveChallenge(challenge.prefix, challenge.target, {
				batchSize: 250,
				signal: controller.signal,
				onProgress: (stats) => {
					setPublishState({
						status: "solving_challenge",
						attempts: stats.attempts,
						elapsedMs: stats.elapsedMs,
					});
				},
			});

			if (controller.signal.aborted) return;

			// Step 3: Publish to LRCLIB
			setPublishState({ status: "publishing" });

			await LrcLibApi.publish(
				{
					trackName: trackName.trim(),
					artistName: artistName.trim(),
					albumName: albumName.trim() || undefined,
					duration:
						typeof durationSeconds === "number" && durationSeconds > 0
							? durationSeconds
							: undefined,
					lyricsfile: includeLyricsfile ? generatedLyricsfile : undefined,
					syncedLyrics: includeSyncedLyrics ? generatedSyncedLyrics : undefined,
					plainLyrics: includePlainLyrics ? generatedPlainLyrics : undefined,
				},
				token,
			);

			setPublishState({
				status: "success",
				trackName: trackName.trim(),
				artistName: artistName.trim(),
			});

			toast.success(
				t(
					"publishToLRCLIB.successToast",
					"Successfully published lyrics to LRCLIB!",
				),
			);
		} catch (err: unknown) {
			if (controller.signal.aborted) {
				setPublishState({ status: "idle" });
				return;
			}
			const errMsg =
				err instanceof Error ? err.message : String(err);
			console.error("LRCLIB publish error:", err);
			setPublishState({
				status: "error",
				message: errMsg,
			});
			toast.error(
				t(
					"publishToLRCLIB.errorToast",
					"Failed to publish to LRCLIB: {{error}}",
					{ error: errMsg },
				),
			);
		} finally {
			abortControllerRef.current = null;
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={(val) => !isBusy && setOpen(val)}>
			<Dialog.Content style={{ maxWidth: 680, maxHeight: "90vh" }}>
				<Dialog.Title>
					{t("publishToLRCLIB.title", "Publish to LRCLIB")}
				</Dialog.Title>
				<Dialog.Description size="2" color="gray" mb="3">
					{t(
						"publishToLRCLIB.description",
						"Publish your lyrics (Lyricsfile YAML, Synced LRC, and Plain text) to the public LRCLIB database.",
					)}
				</Dialog.Description>

				<Callout.Root color="amber" size="1" mb="3">
					<Callout.Icon>
						<Warning16Filled />
					</Callout.Icon>
					<Callout.Text>
						{t(
							"publishToLRCLIB.permanentWarning",
							"LRCLIB does not allow editing or deleting published lyrics. Please make sure track metadata and timing are accurate before submitting.",
						)}
					</Callout.Text>
				</Callout.Root>

				<Flex direction="column" gap="3">
					{/* Track & Artist fields */}
					<Flex gap="3">
						<Box flexGrow="1">
							<Text as="label" size="2" weight="bold">
								{t("publishToLRCLIB.trackName", "Track Name")} *
							</Text>
							<TextField.Root
								value={trackName}
								placeholder="e.g. Bohemian Rhapsody"
								disabled={isBusy}
								onChange={(e) => setTrackName(e.target.value)}
							/>
						</Box>
						<Box flexGrow="1">
							<Text as="label" size="2" weight="bold">
								{t("publishToLRCLIB.artistName", "Artist Name")} *
							</Text>
							<TextField.Root
								value={artistName}
								placeholder="e.g. Queen"
								disabled={isBusy}
								onChange={(e) => setArtistName(e.target.value)}
							/>
						</Box>
					</Flex>

					{/* Album & Duration fields */}
					<Flex gap="3">
						<Box flexGrow="1">
							<Text as="label" size="2" weight="bold">
								{t("publishToLRCLIB.albumName", "Album Name (Optional)")}
							</Text>
							<TextField.Root
								value={albumName}
								placeholder="e.g. A Night at the Opera"
								disabled={isBusy}
								onChange={(e) => setAlbumName(e.target.value)}
							/>
						</Box>
						<Box style={{ width: 140 }}>
							<Text as="label" size="2" weight="bold">
								{t("publishToLRCLIB.duration", "Duration (s)")}
							</Text>
							<TextField.Root
								type="number"
								min="0"
								value={durationSeconds}
								placeholder="e.g. 354"
								disabled={isBusy}
								onChange={(e) => {
									const val = e.target.value;
									setDurationSeconds(
										val === "" ? "" : Math.max(0, Number.parseInt(val, 10)),
									);
								}}
							/>
						</Box>
					</Flex>

					{/* Inclusion Options */}
					<Box>
						<Text size="2" weight="bold" mb="1" as="div">
							{t("publishToLRCLIB.formatsToInclude", "Formats to Include")}
						</Text>
						<Flex gap="4" wrap="wrap">
							<Text as="label" size="2">
								<Flex gap="2" align="center">
									<Checkbox
										checked={includeLyricsfile}
										disabled={isBusy}
										onCheckedChange={(checked) =>
											setIncludeLyricsfile(checked === true)
										}
									/>
									{t("publishToLRCLIB.includeLyricsfile", "Lyricsfile (YAML)")}
									<Badge color="green" size="1">
										Recommended
									</Badge>
								</Flex>
							</Text>
							<Text as="label" size="2">
								<Flex gap="2" align="center">
									<Checkbox
										checked={includeSyncedLyrics}
										disabled={isBusy}
										onCheckedChange={(checked) =>
											setIncludeSyncedLyrics(checked === true)
										}
									/>
									{t("publishToLRCLIB.includeSynced", "Synced LRC")}
								</Flex>
							</Text>
							<Text as="label" size="2">
								<Flex gap="2" align="center">
									<Checkbox
										checked={includePlainLyrics}
										disabled={isBusy}
										onCheckedChange={(checked) =>
											setIncludePlainLyrics(checked === true)
										}
									/>
									{t("publishToLRCLIB.includePlain", "Plain Text")}
								</Flex>
							</Text>
						</Flex>
					</Box>

					{/* Payload Preview */}
					<Box>
						<Text size="2" weight="bold" mb="1" as="div">
							{t("publishToLRCLIB.preview", "Payload Preview")}
						</Text>
						<Tabs.Root defaultValue="lyricsfile">
							<Tabs.List size="1">
								<Tabs.Trigger value="lyricsfile">
									Lyricsfile (YAML)
								</Tabs.Trigger>
								<Tabs.Trigger value="synced">Synced LRC</Tabs.Trigger>
								<Tabs.Trigger value="plain">Plain Text</Tabs.Trigger>
							</Tabs.List>
							<Box pt="2">
								<Tabs.Content value="lyricsfile">
									<TextArea
										readOnly
										value={generatedLyricsfile}
										rows={6}
										style={{ fontFamily: "monospace", fontSize: 11 }}
									/>
								</Tabs.Content>
								<Tabs.Content value="synced">
									<TextArea
										readOnly
										value={generatedSyncedLyrics}
										rows={6}
										style={{ fontFamily: "monospace", fontSize: 11 }}
									/>
								</Tabs.Content>
								<Tabs.Content value="plain">
									<TextArea
										readOnly
										value={generatedPlainLyrics}
										rows={6}
										style={{ fontFamily: "monospace", fontSize: 11 }}
									/>
								</Tabs.Content>
							</Box>
						</Tabs.Root>
					</Box>

					{/* Progress / Status banner */}
					{publishState.status === "requesting_challenge" && (
						<Callout.Root color="blue" size="1">
							<Callout.Icon>
								<Info16Regular />
							</Callout.Icon>
							<Callout.Text>
								{t(
									"publishToLRCLIB.statusRequestingChallenge",
									"Requesting challenge from LRCLIB...",
								)}
							</Callout.Text>
						</Callout.Root>
					)}

					{publishState.status === "solving_challenge" && (
						<Callout.Root color="purple" size="1">
							<Callout.Icon>
								<Info16Regular />
							</Callout.Icon>
							<Flex justify="between" align="center" style={{ width: "100%" }}>
								<Callout.Text>
									{t(
										"publishToLRCLIB.statusSolvingChallenge",
										"Solving proof-of-work challenge... Nonces tested: {{attempts}} ({{elapsed}}s)",
										{
											attempts: publishState.attempts.toLocaleString(),
											elapsed: (publishState.elapsedMs / 1000).toFixed(1),
										},
									)}
								</Callout.Text>
								<Button
									size="1"
									variant="soft"
									color="red"
									onClick={handleCancelSolving}
								>
									{t("common.cancel", "Cancel")}
								</Button>
							</Flex>
						</Callout.Root>
					)}

					{publishState.status === "publishing" && (
						<Callout.Root color="blue" size="1">
							<Callout.Icon>
								<Info16Regular />
							</Callout.Icon>
							<Callout.Text>
								{t(
									"publishToLRCLIB.statusPublishing",
									"Submitting lyrics to LRCLIB...",
								)}
							</Callout.Text>
						</Callout.Root>
					)}

					{publishState.status === "success" && (
						<Callout.Root color="green" size="1">
							<Callout.Icon>
								<CheckmarkCircle16Filled />
							</Callout.Icon>
							<Callout.Text>
								{t(
									"publishToLRCLIB.statusSuccess",
									"Successfully published \"{{track}}\" by \"{{artist}}\" to LRCLIB!",
									{
										track: publishState.trackName,
										artist: publishState.artistName,
									},
								)}
							</Callout.Text>
						</Callout.Root>
					)}

					{publishState.status === "error" && (
						<Callout.Root color="red" size="1">
							<Callout.Icon>
								<DismissCircle16Filled />
							</Callout.Icon>
							<Callout.Text>
								{t("publishToLRCLIB.statusError", "Publish failed: {{error}}", {
									error: publishState.message,
								})}
							</Callout.Text>
						</Callout.Root>
					)}
				</Flex>

				<Flex gap="3" mt="4" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray" disabled={isBusy}>
							{publishState.status === "success"
								? t("common.close", "Close")
								: t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
					{publishState.status !== "success" && (
						<Button
							color="iris"
							disabled={!isFormValid || isBusy}
							onClick={handlePublish}
						>
							{isBusy
								? t("publishToLRCLIB.publishingBtn", "Publishing...")
								: t("publishToLRCLIB.publishBtn", "Publish to LRCLIB")}
						</Button>
					)}
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
