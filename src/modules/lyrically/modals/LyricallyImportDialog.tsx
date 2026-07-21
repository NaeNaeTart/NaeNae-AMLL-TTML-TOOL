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

import { Search16Regular, Search24Regular } from "@fluentui/react-icons";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";

import { useImmerAtom } from "jotai-immer";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { uid } from "uid";
import { confirmDialogAtom, lyricallyImportLyricsDialogAtom } from "$/states/dialogs.ts";
import { isDirtyAtom, lyricLinesAtom, saveFileNameAtom, selectedLinesAtom, selectedWordsAtom } from "$/states/main.ts";
import { prepareLyricLine } from "$/utils/lyric-prep";

import type { LyricLine, LyricWord } from "$/types/ttml.ts";
import { getBetterGeniusCoverArt } from "$/modules/genius/utils/image";
import { LyricallyApi } from "../api/client";
import type { LyricallyTrack } from "../types";






export const LyricallyImportDialog = () => {
	const { t } = useTranslation();
	const store = useStore();

	const [isOpen, setIsOpen] = useAtom(lyricallyImportLyricsDialogAtom);
	const [, setLyricLines] = useImmerAtom(lyricLinesAtom);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);

	// Search
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<LyricallyTrack[]>([]);
	const [searching, setSearching] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);

	// Lyrics preview
	const [selectedHit, setSelectedHit] = useState<LyricallyTrack | null>(null);
	const [fetchingLyrics, setFetchingLyrics] = useState(false);
	const [editableLyrics, setEditableLyrics] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [processLyrics, setProcessLyrics] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);





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
			const hits = await LyricallyApi.search(query);
			setResults(hits);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			toast.error(t("metadataDialog.fetchSongwriters.searchError", "Search failed: {error}", { error: msg }));
		} finally {
			setSearching(false);
		}
	}, [query, t]);

	const handleSelectSong = useCallback(async (hit: LyricallyTrack) => {
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
			// If lyrics are already provided in the search result, use them directly
			if (hit.lyrics && hit.lyrics.trim().length > 10) {
				setEditableLyrics(hit.lyrics);
			} else {
				// Otherwise fetch them explicitly
				const detailedTrack = await LyricallyApi.getLyrics(hit.name, hit.artist);
				setEditableLyrics(detailedTrack.lyrics || t("lyrically.noLyricsLabel", "No lyrics available for this track."));
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			toast.error(t("metadataDialog.fetchSongwriters.fetchError", "Could not fetch lyrics: {error}", { error: msg }));
			setSelectedHit(null);
		} finally {
			setFetchingLyrics(false);
		}
	}, [setSaveFileName, setLyricLines, t]);

	const performImport = useCallback(() => {
		const rawLines = (processLyrics
			? editableLyrics.split("\n").flatMap((line) => prepareLyricLine(line).split("\n"))
			: editableLyrics.split("\n")
		).map((line) => line.trim());

		const slopPatterns = [
			/^\[.*\]$/, // Section headers [Verse], [Chorus]
		];

		const lines = rawLines.filter((l) => {
			if (!l) return false;
			return !slopPatterns.some((pattern) => pattern.test(l));
		});

		if (lines.length === 0) {
			toast.error(t("metadataDialog.fetchSongwriters.noLyricsError", "No lyrics to import."));
			return;
		}

		if (processLyrics) {
			const processedLines: LyricLine[] = lines.map((lineText) => {
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
				return {
					id: uid(),
					words,
					startTime: 0,
					endTime: 0,
					isBG,
					isDuet: false,
					ignoreSync: false,
					translatedLyric: "",
					romanLyric: "",
				};
			});

			setLyricLines((prev) => {
				prev.lyricLines = processedLines;
			});
			if (processedLines[0]?.words[0]) {
				store.set(selectedLinesAtom, new Set([processedLines[0].id]));
				store.set(selectedWordsAtom, new Set([processedLines[0].words[0].id]));
			}
			toast.success(t("metadataDialog.fetchSongwriters.importSuccess", "Imported {count} lines from Genius.", { count: processedLines.length }));
			setIsOpen(false);
			return;
		}

		// Standard import: preserve source lines verbatim, including parentheses.
		const processedLines: LyricLine[] = [];

		for (const lineText of lines) {
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
				});

			}
		}

		setLyricLines((prev) => {
			prev.lyricLines = processedLines;
		});

		// Select first new word
		if (processedLines.length > 0) {
			store.set(selectedLinesAtom, new Set([processedLines[0].id]));
			if (processedLines[0].words.length > 0) {
				store.set(selectedWordsAtom, new Set([processedLines[0].words[0].id]));
			}
		}

		toast.success(
			t("metadataDialog.fetchSongwriters.importSuccess", "Imported {count} lines from Genius.", {
				count: processedLines.length,
			}),
		);
		setIsOpen(false);
	}, [editableLyrics, setLyricLines, setIsOpen, t, processLyrics, store]);

	const handleImport = useCallback(() => {
		if (isDirty) {
			setConfirmDialog({
				open: true,
				title: t("confirmDialog.importFile.title", "Confirm lyric import"),
				description: t(
					"confirmDialog.importFile.description",
					"This project has unsaved changes. Importing will replace its lyrics. Continue?",
				),
				onConfirm: performImport,
			});
			return;
		}
		performImport();
	}, [isDirty, performImport, setConfirmDialog, t]);




	// ── Lyrics preview pane ────────────────────────────────────────────────────
	if (selectedHit) {
		return (
			<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
				<Dialog.Content style={{ maxWidth: 680, height: "82vh" }}>
					<Flex justify="between" align="center" mb="3">
						<Flex direction="column">
							<Dialog.Title mb="0">{t("lyrically.previewTitle", "Lyrically — Lyrics Preview")}</Dialog.Title>
							<Text size="1" color="gray" truncate style={{ maxWidth: 460 }}>
								{selectedHit.name} - {selectedHit.artist}
							</Text>
						</Flex>
						<Button variant="soft" color="gray" onClick={() => { setSelectedHit(null); setEditableLyrics(""); }}>
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
									{isEditing ? t("lyrically.editingRawText", "Editing Raw Text") : t("genius.previewSubtitle", "Text in parentheses will be separated as background lyrics.")}
								</Text>
								<Button variant="ghost" size="1" onClick={() => setIsEditing(!isEditing)}>
									{isEditing ? t("lyrically.backToPreview", "Back to Preview") : t("lyrically.manualEdit", "Manual Edit")}
								</Button>
							</Flex>

							{isEditing ? (
								<TextArea
									value={editableLyrics}
									onChange={(e) => setEditableLyrics(e.target.value)}
									style={{ height: "calc(82vh - 200px)", resize: "none", fontSize: 13 }}
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
												.replace(/(\([^)]+\))/g, '<span style="opacity: 0.35; font-style: italic; font-weight: 300;">$1</span>')
										}}
									/>
								</Box>
							)}

							<Flex justify="between" align="center" mt="3">
								<Flex gap="2" align="center">
									<Text size="1" color="gray">
										{t("genius.linesCount", "{count} lines", { count: editableLyrics.split("\n").filter((l) => l.trim()).length })}
									</Text>
									<Flex gap="2" align="center" ml="3">
										<Text size="1" color="gray">{t("textImportDialog.processLyrics", "Process Lyrics")}</Text>
										<Checkbox
											size="1"
											checked={processLyrics}
											onCheckedChange={(c: boolean) => setProcessLyrics(c)}
										/>
									</Flex>

								</Flex>

								<Flex gap="2">
									<Dialog.Close>
										<Button variant="soft" color="gray">{t("common.cancel", "Cancel")}</Button>
									</Dialog.Close>
									<Button onClick={handleImport} disabled={!editableLyrics.trim() || editableLyrics === t("lyrically.noLyricsLabel", "No lyrics available for this track.")}>
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
			<Dialog.Content style={{ maxWidth: 620, height: "70vh" }}>
				<Dialog.Title>{t("lyrically.importTitle", "Import Lyrics safely via Lyrically (No CORS via API endpoint)")}</Dialog.Title>

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

				<ScrollArea type="auto" scrollbars="vertical" style={{ height: "calc(70vh - 160px)" }}>
					<Flex direction="column" gap="2">
						{searching && (
							<Flex align="center" justify="center" p="6">
								<Spinner size="3" />
							</Flex>
						)}

						{!searching && results.map((hit, i) => (
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
											style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
											referrerPolicy="no-referrer"
										/>
									) : (
										<Box style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: "var(--gray-3)", flexShrink: 0 }} />
									)}
									<Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
										<Text size="2" weight="bold" truncate>{hit.name}</Text>
										<Text size="1" color="gray" truncate>{hit.artist}{hit.album ? ` • ${hit.album}` : ""}</Text>
										{hit.source && <Text size="1" color="gray" style={{ opacity: 0.6 }}>{t("lyrically.source", "Source: ")}{hit.source}</Text>}
									</Flex>
								</Flex>
							</Card>
						))}

						{!searching && hasSearched && results.length === 0 && (
							<Flex direction="column" align="center" justify="center" gap="2" p="6" style={{ color: "var(--gray-9)" }}>
								<Search24Regular style={{ width: 40, height: 40 }} />
								<Text>{t("genius.notFound", "No results found. Try different keywords.")}</Text>
							</Flex>
						)}

						{!hasSearched && !searching && (
							<Flex direction="column" align="center" justify="center" gap="2" p="6" style={{ color: "var(--gray-9)" }}>
								<Search24Regular style={{ width: 40, height: 40 }} />
								<Text>{t("genius.noResult", "Enter a song name or artist to start.")}</Text>
							</Flex>
						)}
					</Flex>
				</ScrollArea>

				<Flex justify="between" align="center" mt="3">
					<Dialog.Close>
						<Button variant="soft" color="gray">{t("common.close", "Close")}</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
