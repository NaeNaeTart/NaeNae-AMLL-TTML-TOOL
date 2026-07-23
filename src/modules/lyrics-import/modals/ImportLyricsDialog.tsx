import { Search16Regular, Search24Regular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Checkbox,
	Dialog,
	Flex,
	ScrollArea,
	Spinner,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";

import { useImmerAtom } from "jotai-immer";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { uid } from "uid";
import { GeniusApi } from "$/modules/genius/api/client";
import { getBetterGeniusCoverArt } from "$/modules/genius/utils/image";
import { LrcLibApi } from "$/modules/lrclib/api/client";
import { LyricallyApi } from "$/modules/lyrically/api/client";
import {
	geniusApiKeyAtom,
	geniusCategorizationEnabledAtom,
} from "$/modules/settings/states/index.ts";
import {
	confirmDialogAtom,
	geniusImportLyricsDialogAtom,
	importFromLRCLIBDialogAtom,
	lyricallyImportLyricsDialogAtom,
} from "$/states/dialogs.ts";
import {
	isDirtyAtom,
	lyricLinesAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main.ts";
import type { LyricLine, LyricWord } from "$/types/ttml.ts";
import { prepareLyricLine } from "$/utils/lyric-prep";
import { getGeniusHeader } from "$/modules/lyric-editor/utils/genius-sections.ts";

type ImportSource = "lyrically" | "genius" | "lrclib";

type ImportTrack = {
	id: string | number;
	name: string;
	artist: string;
	album?: string;
	cover?: string;
	lyrics?: string;
	source?: string;
	fetchLyrics?: () => Promise<string>;
	fetchSongwriters?: () => Promise<string[]>;
};

const lrcToPlainLyrics = (lyrics: string) =>
	lyrics.replace(/^\s*\[(?:\d+:)?\d{1,2}(?:[.:]\d{1,3})?\]\s*/gm, "");

export const ImportLyricsDialog = ({
	source = "lyrically",
}: {
	source?: ImportSource;
}) => {
	const { t } = useTranslation();
	const store = useStore();

	const dialogAtom =
		source === "genius"
			? geniusImportLyricsDialogAtom
			: source === "lrclib"
				? importFromLRCLIBDialogAtom
				: lyricallyImportLyricsDialogAtom;
	const [isOpen, setIsOpen] = useAtom(dialogAtom);
	const [, setLyricLines] = useImmerAtom(lyricLinesAtom);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);

	// Search
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<ImportTrack[]>([]);
	const [searching, setSearching] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);

	// Lyrics preview
	const [selectedHit, setSelectedHit] = useState<ImportTrack | null>(null);
	const [fetchingLyrics, setFetchingLyrics] = useState(false);
	const [editableLyrics, setEditableLyrics] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [processLyrics, setProcessLyrics] = useState(false);
	const [fetchSongwriters, setFetchSongwriters] = useState(false);
	const [categorizeGeniusHeaders, setCategorizeGeniusHeaders] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const [geniusApiKey, setGeniusApiKey] = useAtom(geniusApiKeyAtom);
	const [, setGeniusCategorizationEnabled] = useAtom(
		geniusCategorizationEnabledAtom,
	);
	const [tempApiKey, setTempApiKey] = useState("");

	useEffect(() => {
		if (isOpen) {
			setHasSearched(false);
			setResults([]);
			setSelectedHit(null);
			setEditableLyrics("");
			setIsEditing(false);
			setTimeout(() => {
				inputRef.current?.focus();
			}, 50);
		}
	}, [isOpen]);

	const handleSearch = useCallback(async () => {
		if (!query.trim()) return;
		setSearching(true);
		setHasSearched(true);
		setResults([]);
		setSelectedHit(null);
		setEditableLyrics("");
		setIsEditing(false);
		try {
			const hits: ImportTrack[] =
				source === "genius"
					? (await GeniusApi.search(query, geniusApiKey)).response.hits.map(
							({ result }) => ({
								id: result.id,
								name: result.title,
								artist: result.primary_artist.name,
								album: result.album?.name,
								cover:
									result.song_art_image_url ||
									result.song_art_image_thumbnail_url,
								fetchLyrics: () => GeniusApi.getLyrics(result.id),
								fetchSongwriters: async () => {
									const artists = (
										await GeniusApi.getSongById(result.id, geniusApiKey)
									).response.song.writer_artists;
									const realNames: string[] = [];
									for (const artist of artists) {
										try {
											const detail = (
												await GeniusApi.getArtistById(artist.id, geniusApiKey)
											).response.artist;
											const description = detail.description.plain || "";
											const bornMatch = description.match(
												/born\s+([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+){1,4})/,
											);
											const realNameMatch = description.match(
												/real\s+name\s+(?:is\s+)?([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+){1,4})/i,
											);
											const potentialNames = detail.alternate_names.filter(
												(name) => {
													const lowerArtist = artist.name.toLowerCase();
													return (
														!name.toLowerCase().includes(lowerArtist) &&
														!lowerArtist.includes(name.toLowerCase()) &&
														name.split(" ").length >= 2 &&
														name.split(" ").length <= 4 &&
														![
															"King ",
															"The ",
															"Mr. ",
															"aka ",
															"alias ",
															"DJ ",
														].some((prefix) => name.startsWith(prefix)) &&
														name
															.split(" ")
															.every((word) => /^[A-Z]/.test(word)) &&
														!name.includes("http") &&
														!name.includes("www.")
													);
												},
											);
											realNames.push(
												bornMatch?.[1] ||
													realNameMatch?.[1] ||
													potentialNames.sort(
														(a, b) => a.length - b.length,
													)[0] ||
													artist.name,
											);
										} catch {
											realNames.push(artist.name);
										}
									}
									return realNames;
								},
							}),
						)
					: source === "lrclib"
						? (await LrcLibApi.search(query)).map((track) => ({
								id: track.id,
								name: track.name,
								artist: track.artistName,
								album: track.albumName,
								lyrics:
									track.plainLyrics ||
									(track.syncedLyrics
										? lrcToPlainLyrics(track.syncedLyrics)
										: ""),
								source: track.syncedLyrics
									? "LRCLIB • synced lyrics available"
									: "LRCLIB",
							}))
						: (await LyricallyApi.search(query)).map((track, index) => ({
								id: `${track.artist}-${track.name}-${index}`,
								...track,
								fetchLyrics: () =>
									LyricallyApi.getLyrics(track.name, track.artist).then(
										(detail) => detail.lyrics || "",
									),
							}));
			setResults(hits);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			toast.error(
				t(
					"metadataDialog.fetchSongwriters.searchError",
					"Search failed: {error}",
					{ error: msg },
				),
			);
		} finally {
			setSearching(false);
		}
	}, [query, t, source, geniusApiKey]);

	const handleSelectSong = useCallback(
		async (hit: ImportTrack) => {
			setSelectedHit(hit);
			setFetchingLyrics(true);
			setEditableLyrics("");
			setIsEditing(false);

			// Set TTML metadata and file name immediately
			const title = hit.name;
			const artist = hit.artist;
			const safeFileName = `${artist} - ${title}.ttml`
				.replace(/[/\\?%*:|"<>]/g, "-")
				.trim();

			setSaveFileName(safeFileName);
			setLyricLines((prev) => {
				const upsert = (key: string, value: string) => {
					const existing = prev.metadata.find((m) => m.key === key);
					if (existing) {
						existing.value = [value];
					} else {
						prev.metadata.push({ key, value: [value] });
					}
				};
				upsert("musicName", title);
				upsert("artists", artist);
				if (hit.album) upsert("album", hit.album);
				if (hit.cover) upsert("cover_art", hit.cover);
			});

			try {
				const lyrics =
					hit.lyrics?.trim() ||
					(hit.fetchLyrics ? await hit.fetchLyrics() : "");
				setEditableLyrics(
					lyrics ||
						t("lyrically.noLyricsLabel", "No lyrics available for this track."),
				);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				toast.error(
					t(
						"metadataDialog.fetchSongwriters.fetchError",
						"Could not fetch lyrics: {error}",
						{ error: msg },
					),
				);
				setSelectedHit(null);
			} finally {
				setFetchingLyrics(false);
			}
		},
		[setSaveFileName, setLyricLines, t],
	);

	const performImport = useCallback(async () => {
		const rawLines = (
			processLyrics
				? editableLyrics
						.split("\n")
						.flatMap((line) =>
							categorizeGeniusHeaders && /^\[.+\]$/.test(line.trim())
								? [line]
								: prepareLyricLine(line).split("\n"),
						)
				: editableLyrics.split("\n")
		).map((line) => line.trim());

		const slopPatterns = categorizeGeniusHeaders ? [] : [/^\[.*\]$/];

		const lines = rawLines.filter((l) => {
			if (!l) return false;
			return !slopPatterns.some((pattern) => pattern.test(l));
		});

		if (lines.length === 0) {
			toast.error(
				t(
					"metadataDialog.fetchSongwriters.noLyricsError",
					"No lyrics to import.",
				),
			);
			return;
		}

		const importSongwriters = async () => {
			if (
				source !== "genius" ||
				!fetchSongwriters ||
				!selectedHit?.fetchSongwriters
			)
				return;
			const writers = await selectedHit.fetchSongwriters();
			setLyricLines((current) => {
				const entry = current.metadata.find(
					(item) => item.key === "songwriter",
				);
				if (entry) {
					entry.value = writers;
				} else if (writers.length) {
					current.metadata.push({ key: "songwriter", value: writers });
				}
			});
		};

		if (processLyrics) {
			let geniusHeader: string | undefined;
			const processedLines: LyricLine[] = [];
			for (const lineText of lines) {
				const header = categorizeGeniusHeaders ? getGeniusHeader(lineText) : undefined;
				if (header) {
					geniusHeader = header;
					continue;
				}
				const isBG = lineText.startsWith("<");
				const words: LyricWord[] = lineText
					.slice(isBG ? 1 : 0)
					.split("\\")
					.filter(Boolean)
					.map((word) => ({
						id: uid(),
						word,
						startTime: 0,
						endTime: 0,
						emptyBeat: 0,
						obscene: false,
						romanWord: "",
					}));
				processedLines.push({
					id: uid(),
					words,
					startTime: 0,
					endTime: 0,
					isBG,
					isDuet: false,
					ignoreSync: false,
					translatedLyric: "",
					romanLyric: "",
					geniusHeader,
				});
			}

			setLyricLines((prev) => {
				prev.lyricLines = processedLines;
			});
			if (categorizeGeniusHeaders) setGeniusCategorizationEnabled(true);
			try {
				await importSongwriters();
			} catch (error) {
				console.error("Genius songwriter fetch failed", error);
			}
			if (processedLines[0]?.words[0]) {
				store.set(selectedLinesAtom, new Set([processedLines[0].id]));
				store.set(selectedWordsAtom, new Set([processedLines[0].words[0].id]));
			}
			toast.success(
				t(
					"metadataDialog.fetchSongwriters.importSuccess",
					"Imported {count} lines from Genius.",
					{ count: processedLines.length },
				),
			);
			setIsOpen(false);
			return;
		}

		// Standard import: preserve source lines verbatim, including parentheses.
		const processedLines: LyricLine[] = [];
		let geniusHeader: string | undefined;

		for (const lineText of lines) {
			const header = categorizeGeniusHeaders ? getGeniusHeader(lineText) : undefined;
			if (header) {
				geniusHeader = header;
				continue;
			}
			const parts = [lineText];

			for (const part of parts) {
				const trimmed = part.trim();
				if (!trimmed) continue;

				const isBG = false;
				let text = trimmed;

				text = text.replace(/\\/g, "").replace(/\s+/g, " ");
				if (!text) continue;

				const wordStrings = [text];

				const words: LyricWord[] = wordStrings.map((word) => ({
					id: uid(),
					word,
					startTime: 0,
					endTime: 0,
					emptyBeat: 0,
					obscene: false,
					romanWord: "",
				}));

				processedLines.push({
					id: uid(),
					words,
					startTime: 0,
					endTime: 0,
					isBG,
					isDuet: false,
					ignoreSync: false,
					translatedLyric: "",
					romanLyric: "",
					geniusHeader,
				});
			}
		}

		setLyricLines((prev) => {
			prev.lyricLines = processedLines;
		});
		if (categorizeGeniusHeaders) setGeniusCategorizationEnabled(true);
		try {
			await importSongwriters();
		} catch (error) {
			console.error("Genius songwriter fetch failed", error);
		}

		// Select first new word
		if (processedLines.length > 0) {
			store.set(selectedLinesAtom, new Set([processedLines[0].id]));
			if (processedLines[0].words.length > 0) {
				store.set(selectedWordsAtom, new Set([processedLines[0].words[0].id]));
			}
		}

		toast.success(
			t(
				"metadataDialog.fetchSongwriters.importSuccess",
				"Imported {count} lines from Genius.",
				{
					count: processedLines.length,
				},
			),
		);
		setIsOpen(false);
	}, [
		editableLyrics,
		setLyricLines,
		setIsOpen,
		t,
		processLyrics,
		store,
		categorizeGeniusHeaders,
		source,
		fetchSongwriters,
		selectedHit,
		setGeniusCategorizationEnabled,
	]);

	const handleImport = useCallback(() => {
		if (isDirty) {
			setConfirmDialog({
				open: true,
				title: t("confirmDialog.importFile.title", "Confirm lyric import"),
				description: t(
					"confirmDialog.importFile.description",
					"This project has unsaved changes. Importing will replace its lyrics. Continue?",
				),
				onConfirm: () => {
					void performImport();
				},
			});
			return;
		}
		void performImport();
	}, [isDirty, performImport, setConfirmDialog, t]);

	// ── Lyrics preview pane ────────────────────────────────────────────────────
	if (source === "genius" && !geniusApiKey) {
		return (
			<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
				<Dialog.Content style={{ maxWidth: 500 }}>
					<Dialog.Title>
						{t("genius.setupTitle", "Genius API Key Setup")}
					</Dialog.Title>
					<Flex direction="column" gap="4">
						<Text>
							{t(
								"genius.setupDesc",
								"To import lyrics from Genius you need a CLIENT ACCESS TOKEN.",
							)}
						</Text>
						<TextField.Root
							value={tempApiKey}
							onChange={(e) => setTempApiKey(e.target.value)}
							placeholder={t(
								"genius.keyPlaceholder",
								"Paste CLIENT ACCESS TOKEN here…",
							)}
						/>
						<Flex justify="end" gap="2">
							<Dialog.Close>
								<Button variant="soft" color="gray">
									{t("common.cancel", "Cancel")}
								</Button>
							</Dialog.Close>
							<Button
								disabled={!tempApiKey.trim()}
								onClick={() => setGeniusApiKey(tempApiKey.trim())}
							>
								{t("common.save", "Save & Continue")}
							</Button>
						</Flex>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>
		);
	}

	if (selectedHit) {
		return (
			<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
				<Dialog.Content style={{ maxWidth: 680, height: "80vh" }}>
					<Flex justify="between" align="center" mb="3">
						<Flex direction="column">
							<Dialog.Title mb="0">
								{source === "genius"
									? t("genius.previewTitle", "Genius — Lyrics Preview")
									: source === "lrclib"
										? t("lrclib.title", "LRCLIB — Lyrics Preview")
										: t("lyrically.previewTitle", "Lyrically — Lyrics Preview")}
							</Dialog.Title>
							<Text size="1" color="gray" truncate style={{ maxWidth: 460 }}>
								{selectedHit.name} - {selectedHit.artist}
							</Text>
						</Flex>
						<Button
							variant="soft"
							color="gray"
							onClick={() => {
								setSelectedHit(null);
								setEditableLyrics("");
							}}
						>
							{t("genius.back", "← Back")}
						</Button>
					</Flex>

					{fetchingLyrics ? (
						<Flex align="center" justify="center" style={{ height: "60%" }}>
							<Spinner size="3" />
						</Flex>
					) : (
						<>
							<Flex justify="between" align="center" mb="2">
								<Text size="1" color="gray">
									{isEditing
										? t("lyrically.editingRawText", "Editing Raw Text")
										: t(
												"genius.previewSubtitle",
												"Text in parentheses will be separated as background lyrics.",
											)}
								</Text>
								<Button
									variant="ghost"
									size="1"
									onClick={() => setIsEditing(!isEditing)}
								>
									{isEditing
										? t("lyrically.backToPreview", "Back to Preview")
										: t("lyrically.manualEdit", "Manual Edit")}
								</Button>
							</Flex>

							{isEditing ? (
								<TextArea
									value={editableLyrics}
									onChange={(e) => setEditableLyrics(e.target.value)}
									style={{
										height: "calc(82vh - 200px)",
										resize: "none",
										fontSize: 13,
									}}
								/>
							) : (
								<Box
									style={{
										height: "calc(82vh - 200px)",
										padding: "16px",
										backgroundColor: "var(--gray-2)",
										border: "1px solid var(--gray-5)",
										borderRadius: "var(--radius-3)",
										overflow: "auto",
									}}
								>
									<pre
										style={{
											margin: 0,
											whiteSpace: "pre-wrap",
											fontFamily: "inherit",
											fontSize: "13px",
											lineHeight: "1.6",
											color: "var(--gray-12)",
										}}
										// biome-ignore lint/security/noDangerouslySetInnerHtml: Used for syntax highlighting
										dangerouslySetInnerHTML={{
											__html: editableLyrics
												.replace(/&/g, "&amp;")
												.replace(/</g, "&lt;")
												.replace(/>/g, "&gt;")
												.replace(
													/(\([^)]+\))/g,
													'<span style="opacity: 0.35; font-style: italic; font-weight: 300;">$1</span>',
												),
										}}
									/>
								</Box>
							)}

							<Flex justify="between" align="end" gap="2" wrap="wrap" mt="3">
								<Flex
									gap="3"
									align="center"
									wrap="wrap"
									style={{ flex: 1, minWidth: 0 }}
								>
									<Text size="1" color="gray">
										{t("genius.linesCount", "{count} lines", {
											count: editableLyrics
												.split("\n")
												.filter((line) => line.trim()).length,
										})}
									</Text>
									<Flex direction="column" gap="2" align="start">
										<Flex gap="3" align="center" wrap="wrap">
											<Flex gap="2" align="center">
												<Text size="1" color="gray">
													{t(
														"textImportDialog.processLyrics",
														"Process Lyrics",
													)}
												</Text>
												<Checkbox
													size="1"
													checked={processLyrics}
													onCheckedChange={(checked: boolean) =>
														setProcessLyrics(checked)
													}
												/>
											</Flex>
											{source === "genius" && (
												<Flex gap="2" align="center">
													<Text size="1" color="gray">
														{t(
															"metadataDialog.fetchSongwriters.button",
															"Fetch Songwriters",
														)}
													</Text>
													<Checkbox
														size="1"
														checked={fetchSongwriters}
														onCheckedChange={(checked: boolean) =>
															setFetchSongwriters(checked)
														}
													/>
												</Flex>
											)}
										</Flex>
										{source === "genius" && (
											<Flex gap="2" align="center">
												<Text size="1" color="gray">
													{t(
														"experimentalFeatures.geniusCategorization.title",
														"Genius Header Categorization",
													)}
												</Text>
												<Checkbox
													size="1"
													checked={categorizeGeniusHeaders}
													onCheckedChange={(checked: boolean) =>
														setCategorizeGeniusHeaders(checked)
													}
												/>
											</Flex>
										)}
									</Flex>
								</Flex>

								<Flex gap="2" style={{ flexShrink: 0 }}>
									<Dialog.Close>
										<Button variant="soft" color="gray">
											{t("common.cancel", "Cancel")}
										</Button>
									</Dialog.Close>
									<Button
										onClick={handleImport}
										disabled={
											!editableLyrics.trim() ||
											editableLyrics ===
												t(
													"lyrically.noLyricsLabel",
													"No lyrics available for this track.",
												)
										}
									>
										{t("genius.importButton", "Import Lyrics")}
									</Button>
								</Flex>
							</Flex>
						</>
					)}
				</Dialog.Content>
			</Dialog.Root>
		);
	}

	// ── Search pane ────────────────────────────────────────────────────────────
	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 620, height: "72vh" }}>
				<Dialog.Title>
					{source === "genius"
						? t("genius.importTitle", "Import Lyrics from Genius")
						: source === "lrclib"
							? t("lrclib.title", "Import Lyrics from LRCLIB")
							: t(
									"lyrically.importTitle",
									"Import Lyrics safely via Lyrically",
								)}
				</Dialog.Title>

				<Flex gap="3" mb="4">
					<TextField.Root
						ref={inputRef}
						style={{ flex: 1 }}
						placeholder={t("genius.searchPlaceholder", "Artist – Song title…")}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
					>
						<TextField.Slot>
							<Search16Regular />
						</TextField.Slot>
					</TextField.Root>
					<Button onClick={handleSearch} disabled={searching}>
						{searching ? <Spinner /> : t("common.search", "Search")}
					</Button>
				</Flex>

				<ScrollArea
					type="auto"
					scrollbars="vertical"
					style={{ height: "calc(70vh - 160px)" }}
				>
					<Flex direction="column" gap="2">
						{searching && (
							<Flex align="center" justify="center" p="6">
								<Spinner size="3" />
							</Flex>
						)}

						{!searching &&
							results.map((hit, i) => (
								<Card
									key={`${hit.artist}-${hit.name}-${i}`}
									onClick={() => handleSelectSong(hit)}
									style={{ cursor: "pointer" }}
								>
									<Flex align="center" gap="3">
										{hit.cover ? (
											<img
												src={getBetterGeniusCoverArt(hit.cover, 100)}
												alt={hit.name}
												style={{
													width: 48,
													height: 48,
													borderRadius: 6,
													objectFit: "cover",
													flexShrink: 0,
												}}
												referrerPolicy="no-referrer"
											/>
										) : (
											<Box
												style={{
													width: 48,
													height: 48,
													borderRadius: 6,
													backgroundColor: "var(--gray-3)",
													flexShrink: 0,
												}}
											/>
										)}
										<Flex
											direction="column"
											gap="1"
											style={{ flex: 1, minWidth: 0 }}
										>
											<Text size="2" weight="bold" truncate>
												{hit.name}
											</Text>
											<Text size="1" color="gray" truncate>
												{hit.artist}
												{hit.album ? ` • ${hit.album}` : ""}
											</Text>
											{hit.source && (
												<Text size="1" color="gray" style={{ opacity: 0.6 }}>
													{t("lyrically.source", "Source: ")}
													{hit.source}
												</Text>
											)}
										</Flex>
									</Flex>
								</Card>
							))}

						{!searching && hasSearched && results.length === 0 && (
							<Flex
								direction="column"
								align="center"
								justify="center"
								gap="2"
								p="6"
								style={{ color: "var(--gray-9)" }}
							>
								<Search24Regular style={{ width: 40, height: 40 }} />
								<Text>
									{t(
										"genius.notFound",
										"No results found. Try different keywords.",
									)}
								</Text>
							</Flex>
						)}

						{!hasSearched && !searching && (
							<Flex
								direction="column"
								align="center"
								justify="center"
								gap="2"
								p="6"
								style={{ color: "var(--gray-9)" }}
							>
								<Search24Regular style={{ width: 40, height: 40 }} />
								<Text>
									{t(
										"genius.noResult",
										"Enter a song name or artist to start.",
									)}
								</Text>
							</Flex>
						)}
					</Flex>
				</ScrollArea>

				<Flex justify="between" align="center" mt="3">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.close", "Close")}
						</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
