import { stringifyLrc } from "@applemusic-like-lyrics/lyric";
import {
	CheckmarkCircle16Filled,
	DismissCircle16Filled,
	Info16Regular,
	Key16Regular,
	Sparkle16Filled,
	Warning16Filled,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Callout,
	Dialog,
	Flex,
	RadioGroup,
	Tabs,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { currentDurationAtom } from "$/modules/audio/states";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import { publishToUnisonDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";
import { UnisonApi } from "../api/client";
import type { UnisonIdentityKeyPair, UnisonLyricFormat } from "../types";
import {
	generateUnisonKeypair,
	getOrCreateUnisonIdentity,
	saveUnisonIdentity,
} from "../utils/crypto";

type PublishState =
	| { status: "idle" }
	| { status: "publishing" }
	| { status: "success"; id?: number; song: string; artist: string }
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

function extractYouTubeVideoId(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) return "";
	// If it's already an 11-char ID
	if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
		return trimmed;
	}
	// Try URL matching
	const urlMatch = trimmed.match(
		/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
	);
	if (urlMatch && urlMatch[1]) {
		return urlMatch[1];
	}
	return trimmed;
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

export function UnisonPublishDialog() {
	const [open, setOpen] = useAtom(publishToUnisonDialogAtom);
	const ttml = useAtomValue(lyricLinesAtom);
	const currentAudioDurationMs = useAtomValue(currentDurationAtom);
	const { t } = useTranslation();

	const [song, setSong] = useState("");
	const [artist, setArtist] = useState("");
	const [album, setAlbum] = useState("");
	const [durationSeconds, setDurationSeconds] = useState<number | "">("");
	const [videoId, setVideoId] = useState("");
	const [isrc, setIsrc] = useState("");
	const [language, setLanguage] = useState("");
	const [format, setFormat] = useState<UnisonLyricFormat>("ttml");

	const [identity, setIdentity] = useState<UnisonIdentityKeyPair | null>(null);
	const [publishState, setPublishState] = useState<PublishState>({
		status: "idle",
	});

	// Load identity and pre-fill form
	useEffect(() => {
		if (open) {
			getOrCreateUnisonIdentity().then(setIdentity);

			const initTrack = extractMetadataValue(ttml.metadata, [
				"musicName",
				"title",
				"trackName",
				"song",
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
			const initIsrc = extractMetadataValue(ttml.metadata, ["isrc"]);

			setSong(initTrack);
			setArtist(initArtist);
			setAlbum(initAlbum);
			setIsrc(initIsrc);

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

	// Generated formats for preview
	const generatedTtml = useMemo(() => {
		try {
			return exportTTMLText(ttml);
		} catch (e) {
			return `<!-- Error generating TTML: ${e} -->`;
		}
	}, [ttml]);

	const generatedSyncedLrc = useMemo(() => {
		return generateSyncedLyrics(ttml);
	}, [ttml]);

	const generatedPlainText = useMemo(() => {
		return generatePlainLyrics(ttml);
	}, [ttml]);

	const activeLyricsContent = useMemo(() => {
		if (format === "ttml") return generatedTtml;
		if (format === "lrc") return generatedSyncedLrc;
		return generatedPlainText;
	}, [format, generatedTtml, generatedSyncedLrc, generatedPlainText]);

	const handlePublish = async () => {
		if (!song.trim() || !artist.trim()) {
			toast.error(
				t("unison.errors.missingMetadata", {
					defaultValue: "Song title and artist name are required.",
				}),
			);
			return;
		}

		const dur = typeof durationSeconds === "number" ? durationSeconds : 0;
		if (dur <= 0) {
			toast.error(
				t("unison.errors.missingDuration", {
					defaultValue: "Please specify a valid track duration.",
				}),
			);
			return;
		}

		if (!activeLyricsContent.trim()) {
			toast.error(
				t("unison.errors.missingLyrics", {
					defaultValue: "Lyrics content cannot be empty.",
				}),
			);
			return;
		}

		setPublishState({ status: "publishing" });

		try {
			const cleanVideoId = extractYouTubeVideoId(videoId);

			const result = await UnisonApi.publish(
				{
					song: song.trim(),
					artist: artist.trim(),
					album: album.trim() || undefined,
					duration: dur,
					lyrics: activeLyricsContent,
					format,
					videoId: cleanVideoId || undefined,
					isrc: isrc.trim() || undefined,
					language: language.trim() || undefined,
				},
				identity ?? undefined,
			);

			setPublishState({
				status: "success",
				id: result.data?.id,
				song: song.trim(),
				artist: artist.trim(),
			});

			toast.success(
				t("unison.successToast", {
					defaultValue: "Lyrics published to Unison successfully!",
				}),
			);
		} catch (error) {
			const msg =
				error instanceof Error ? error.message : "Failed to publish lyrics.";
			setPublishState({ status: "error", message: msg });
			toast.error(msg);
		}
	};

	const handleExportIdentity = () => {
		if (!identity) return;
		const blob = new Blob([JSON.stringify(identity, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `unison-identity-${identity.keyId.substring(0, 8)}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success(
			t("unison.identityExported", {
				defaultValue: "Unison identity key exported successfully!",
			}),
		);
	};

	const handleImportIdentity = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json,application/json";
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				const parsed = JSON.parse(text) as UnisonIdentityKeyPair;
				if (parsed.keyId && parsed.publicKey && parsed.privateKey) {
					saveUnisonIdentity(parsed);
					setIdentity(parsed);
					toast.success(
						t("unison.identityImported", {
							defaultValue: "Unison identity key imported successfully!",
						}),
					);
				} else {
					toast.error(
						t("unison.invalidIdentityFile", {
							defaultValue: "Invalid Unison identity key file.",
						}),
					);
				}
			} catch {
				toast.error(
					t("unison.invalidIdentityFile", {
						defaultValue: "Invalid Unison identity key file.",
					}),
				);
			}
		};
		input.click();
	};

	const handleGenerateNewIdentity = async () => {
		if (
			window.confirm(
				t("unison.confirmNewIdentity", {
					defaultValue:
						"Generate a new identity keypair? Your existing key ID and reputation on Unison will be replaced locally unless backed up.",
				}),
			)
		) {
			const newId = await generateUnisonKeypair();
			saveUnisonIdentity(newId);
			setIdentity(newId);
			toast.info(
				t("unison.identityGenerated", {
					defaultValue: "New Unison identity key generated.",
				}),
			);
		}
	};

	const isPublishing = publishState.status === "publishing";

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content style={{ maxWidth: 850, maxHeight: "90vh" }}>
				<Dialog.Title>
					<Flex align="center" gap="2">
						<Sparkle16Filled style={{ color: "var(--accent-9)" }} />
						<Text>
							{t("unison.dialogTitle", {
								defaultValue: "Publish to Unison (Better Lyrics)",
							})}
						</Text>
						<Badge color="violet" variant="soft" size="1">
							ECDSA P-256
						</Badge>
					</Flex>
				</Dialog.Title>
				<Dialog.Description size="2" mb="3">
					{t("unison.dialogDescription", {
						defaultValue:
							"Submit synchronized lyrics directly to the crowdsourced Unison database used by Better Lyrics and open media players.",
					})}
				</Dialog.Description>

				{/* Cryptographic Identity Card */}
				<Box
					p="2"
					mb="3"
					style={{
						backgroundColor: "var(--gray-a2)",
						borderRadius: "var(--radius-3)",
						border: "1px solid var(--gray-a4)",
					}}
				>
					<Flex justify="between" align="center" wrap="wrap" gap="2">
						<Flex align="center" gap="2">
							<Key16Regular style={{ color: "var(--accent-11)" }} />
							<Text size="2" weight="medium">
								{t("unison.identityKey", { defaultValue: "Your Key ID:" })}
							</Text>
							<Text
								size="1"
								style={{
									fontFamily: "monospace",
									color: "var(--gray-11)",
								}}
							>
								{identity?.keyId ? `${identity.keyId.substring(0, 16)}...` : "Loading..."}
							</Text>
						</Flex>
						<Flex gap="1">
							<Button
								size="1"
								variant="soft"
								color="gray"
								onClick={handleExportIdentity}
							>
								{t("unison.exportKey", { defaultValue: "Export Key" })}
							</Button>
							<Button
								size="1"
								variant="soft"
								color="gray"
								onClick={handleImportIdentity}
							>
								{t("unison.importKey", { defaultValue: "Import Key" })}
							</Button>
							<Button
								size="1"
								variant="ghost"
								color="gray"
								onClick={handleGenerateNewIdentity}
							>
								{t("unison.newKey", { defaultValue: "New" })}
							</Button>
						</Flex>
					</Flex>
				</Box>

				{/* Track Metadata Fields */}
				<Flex direction="column" gap="3" mb="3">
					<Flex gap="3" wrap="wrap">
						<Box style={{ flex: "1 1 240px" }}>
							<Text as="label" size="2" weight="bold">
								{t("unison.fields.song", { defaultValue: "Song Title" })} *
							</Text>
							<TextField.Root
								value={song}
								onChange={(e) => setSong(e.target.value)}
								placeholder="e.g. Never Gonna Give You Up"
								disabled={isPublishing}
							/>
						</Box>

						<Box style={{ flex: "1 1 240px" }}>
							<Text as="label" size="2" weight="bold">
								{t("unison.fields.artist", { defaultValue: "Artist" })} *
							</Text>
							<TextField.Root
								value={artist}
								onChange={(e) => setArtist(e.target.value)}
								placeholder="e.g. Rick Astley"
								disabled={isPublishing}
							/>
						</Box>
					</Flex>

					<Flex gap="3" wrap="wrap">
						<Box style={{ flex: "1 1 200px" }}>
							<Text as="label" size="2" weight="bold">
								{t("unison.fields.album", { defaultValue: "Album" })}
							</Text>
							<TextField.Root
								value={album}
								onChange={(e) => setAlbum(e.target.value)}
								placeholder="e.g. Whenever You Need Somebody"
								disabled={isPublishing}
							/>
						</Box>

						<Box style={{ flex: "0 0 120px" }}>
							<Text as="label" size="2" weight="bold">
								{t("unison.fields.duration", { defaultValue: "Duration (s)" })} *
							</Text>
							<TextField.Root
								type="number"
								value={durationSeconds}
								onChange={(e) =>
									setDurationSeconds(
										e.target.value === "" ? "" : Number(e.target.value),
									)
								}
								placeholder="e.g. 213"
								disabled={isPublishing}
							/>
						</Box>

						<Box style={{ flex: "1 1 200px" }}>
							<Text as="label" size="2" weight="bold">
								{t("unison.fields.videoId", {
									defaultValue: "YouTube Video ID or URL",
								})}
							</Text>
							<TextField.Root
								value={videoId}
								onChange={(e) => setVideoId(e.target.value)}
								placeholder="e.g. dQw4w9WgXcQ"
								disabled={isPublishing}
							/>
						</Box>
					</Flex>

					<Flex gap="3" wrap="wrap">
						<Box style={{ flex: "1 1 180px" }}>
							<Text as="label" size="2">
								{t("unison.fields.isrc", { defaultValue: "ISRC" })}
							</Text>
							<TextField.Root
								value={isrc}
								onChange={(e) => setIsrc(e.target.value)}
								placeholder="e.g. GBARL9300135"
								disabled={isPublishing}
							/>
						</Box>

						<Box style={{ flex: "1 1 180px" }}>
							<Text as="label" size="2">
								{t("unison.fields.language", { defaultValue: "Language Code" })}
							</Text>
							<TextField.Root
								value={language}
								onChange={(e) => setLanguage(e.target.value)}
								placeholder="e.g. en, pl, ja, zh"
								disabled={isPublishing}
							/>
						</Box>
					</Flex>

					{/* Format Selection */}
					<Box mt="1">
						<Text size="2" weight="bold" mb="1" as="div">
							{t("unison.fields.format", { defaultValue: "Lyrics Format" })}
						</Text>
						<RadioGroup.Root
							value={format}
							onValueChange={(val) => setFormat(val as UnisonLyricFormat)}
							disabled={isPublishing}
						>
							<Flex gap="4" wrap="wrap">
								<RadioGroup.Item value="ttml">
									<Flex align="center" gap="1">
										<Text size="2" weight="medium">
											TTML (Word-by-word)
										</Text>
										<Badge color="violet" size="1">
											Recommended
										</Badge>
									</Flex>
								</RadioGroup.Item>
								<RadioGroup.Item value="lrc">
									<Text size="2">Synced LRC</Text>
								</RadioGroup.Item>
								<RadioGroup.Item value="text">
									<Text size="2">Plain Text</Text>
								</RadioGroup.Item>
							</Flex>
						</RadioGroup.Root>
					</Box>
				</Flex>

				{/* Payload Preview */}
				<Tabs.Root defaultValue="preview">
					<Tabs.List size="1">
						<Tabs.Trigger value="preview">
							{t("unison.previewTab", { defaultValue: "Lyrics Content Preview" })}
						</Tabs.Trigger>
						<Tabs.Trigger value="info">
							{t("unison.infoTab", { defaultValue: "About Unison" })}
						</Tabs.Trigger>
					</Tabs.List>

					<Box pt="2">
						<Tabs.Content value="preview">
							<TextArea
								value={activeLyricsContent}
								readOnly
								rows={8}
								style={{
									fontFamily: "monospace",
									fontSize: 12,
									backgroundColor: "var(--gray-a2)",
								}}
							/>
						</Tabs.Content>

						<Tabs.Content value="info">
							<Flex direction="column" gap="2" p="2">
								<Flex align="center" gap="2">
									<Info16Regular style={{ color: "var(--accent-9)" }} />
									<Text size="2" weight="medium">
										Unison (Better Lyrics) Public Database
									</Text>
								</Flex>
								<Text size="2" color="gray">
									Unison is a crowdsourced lyrics database supporting rich TTML
									word-synced lyrics for the Better Lyrics YouTube Music
									extension and compatible open-source media players.
								</Text>
								<Text size="2" color="gray">
									All contributions are signed with your local ECDSA P-256 key,
									maintaining your reputation without requiring password logins.
								</Text>
							</Flex>
						</Tabs.Content>
					</Box>
				</Tabs.Root>

				{/* Status Banners */}
				{publishState.status === "error" && (
					<Callout.Root color="red" mt="3" size="1">
						<Callout.Icon>
							<DismissCircle16Filled />
						</Callout.Icon>
						<Callout.Text>{publishState.message}</Callout.Text>
					</Callout.Root>
				)}

				{publishState.status === "success" && (
					<Callout.Root color="green" mt="3" size="1">
						<Callout.Icon>
							<CheckmarkCircle16Filled />
						</Callout.Icon>
						<Callout.Text>
							{t("unison.publishedSuccess", {
								defaultValue: "Successfully published to Unison!",
							})}
							{publishState.id && ` (ID: #${publishState.id})`}
						</Callout.Text>
					</Callout.Root>
				)}

				{/* Footer Buttons */}
				<Flex justify="end" gap="3" mt="4">
					<Dialog.Close>
						<Button variant="soft" color="gray" disabled={isPublishing}>
							{t("common.cancel", { defaultValue: "Cancel" })}
						</Button>
					</Dialog.Close>
					<Button
						color="violet"
						onClick={handlePublish}
						loading={isPublishing}
						disabled={isPublishing || !song.trim() || !artist.trim()}
					>
						<Sparkle16Filled />
						{t("unison.publishButton", { defaultValue: "Publish to Unison" })}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
