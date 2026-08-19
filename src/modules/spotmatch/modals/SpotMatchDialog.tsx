import {
	ArrowMinimize16Regular,
	Checkmark16Regular,
	Copy16Regular,
	Delete16Regular,
	Dismiss16Regular,
	DocumentArrowDown16Regular,
	Key16Regular,
	Open16Regular,
	Save16Regular,
	Search16Regular,
	Search24Regular,
	SelectAllOff16Regular,
	SelectAllOn16Regular,
	Settings16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Checkbox,
	Dialog,
	Flex,
	IconButton,
	ScrollArea,
	Select,
	Spinner,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useImmerAtom } from "jotai-immer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { SpotifyIcon } from "$/modules/project/modals/PlatformIcons";
import {
	spotifyAccessTokenAtom,
	spotifyClientIdAtom,
	spotifyClientSecretAtom,
	spotMatchCustomPresetsAtom,
} from "$/modules/settings/states/index.ts";
import { spotMatchDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import { findMatches } from "../logic/matcher";
import {
	spotMatchDismissedWidgetAtom,
	spotMatchExactTitleAtom,
	spotMatchGlobalAlbumsAtom,
	spotMatchGlobalPlaylistsAtom,
	spotMatchHasSearchedAtom,
	spotMatchInputAtom,
	spotMatchIsLoadingAtom,
	spotMatchMatchesAtom,
	spotMatchMaxDurationSecAtom,
	spotMatchMinScoreAtom,
	spotMatchPresetAtom,
	spotMatchProgressMessageAtom,
	spotMatchReleasesPerArtistAtom,
	spotMatchSearchPagesAtom,
	spotMatchSearchRepeatsAtom,
	spotMatchSelectedIdsAtom,
	spotMatchShowAdvancedAtom,
	spotMatchSourceTrackAtom,
	spotMatchTitleFloorAtom,
	spotMatchTracksPerPlaylistAtom,
	spotMatchVariantQueriesAtom,
} from "../states";
import type {
	SpotifyTrack,
	SpotMatchCandidate,
	SpotMatchOptions,
	SpotMatchPresetKey,
} from "../types";
import { formatDuration, PRESETS } from "../utils/similarity";
import styles from "./SpotMatchDialog.module.css";

const SCORE_OPTIONS = [95, 90, 85, 80, 75, 70, 65, 60, 50, 40];
const DURATION_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30, 60];

export const SpotMatchDialog = () => {
	const { t } = useTranslation();
	const [dialogState, setDialogState] = useAtom(spotMatchDialogAtom);
	const [lyricLines, setLyricLines] = useImmerAtom(lyricLinesAtom);

	const [spotifyClientId, setSpotifyClientId] = useAtom(spotifyClientIdAtom);
	const [spotifyClientSecret, setSpotifyClientSecret] = useAtom(
		spotifyClientSecretAtom,
	);
	const [spotifyAccessToken, setSpotifyAccessToken] = useAtom(
		spotifyAccessTokenAtom,
	);
	const [customPresets, setCustomPresets] = useAtom(spotMatchCustomPresetsAtom);

	// Global state for background searching & persistence
	const [sourceInput, setSourceInput] = useAtom(spotMatchInputAtom);
	const [preset, setPreset] = useAtom(spotMatchPresetAtom);
	const [minScore, setMinScore] = useAtom(spotMatchMinScoreAtom);
	const [maxDurationSec, setMaxDurationSec] = useAtom(
		spotMatchMaxDurationSecAtom,
	);
	const [exactTitle, setExactTitle] = useAtom(spotMatchExactTitleAtom);
	const [showAdvanced, setShowAdvanced] = useAtom(spotMatchShowAdvancedAtom);

	const [searchPages, setSearchPages] = useAtom(spotMatchSearchPagesAtom);
	const [searchRepeats, setSearchRepeats] = useAtom(spotMatchSearchRepeatsAtom);
	const [releasesPerArtist, setReleasesPerArtist] = useAtom(
		spotMatchReleasesPerArtistAtom,
	);
	const [globalAlbums, setGlobalAlbums] = useAtom(spotMatchGlobalAlbumsAtom);
	const [globalPlaylists, setGlobalPlaylists] = useAtom(
		spotMatchGlobalPlaylistsAtom,
	);
	const [tracksPerPlaylist, setTracksPerPlaylist] = useAtom(
		spotMatchTracksPerPlaylistAtom,
	);
	const [titleFloor, setTitleFloor] = useAtom(spotMatchTitleFloorAtom);
	const [variantQueries, setVariantQueries] = useAtom(
		spotMatchVariantQueriesAtom,
	);

	const [isLoading, setIsLoading] = useAtom(spotMatchIsLoadingAtom);
	const [progressMessage, setProgressMessage] = useAtom(
		spotMatchProgressMessageAtom,
	);
	const [sourceTrack, setSourceTrack] = useAtom(spotMatchSourceTrackAtom);
	const [matches, setMatches] = useAtom(spotMatchMatchesAtom);
	const [selectedIds, setSelectedIds] = useAtom(spotMatchSelectedIdsAtom);
	const [hasSearched, setHasSearched] = useAtom(spotMatchHasSearchedAtom);
	const [, setIsDismissedWidget] = useAtom(spotMatchDismissedWidgetAtom);

	const [showApiSettings, setShowApiSettings] = useState(false);
	const [tempClientId, setTempClientId] = useState("");
	const [tempClientSecret, setTempClientSecret] = useState("");
	const [tempToken, setTempToken] = useState("");

	const [isSavingPreset, setIsSavingPreset] = useState(false);
	const [newPresetName, setNewPresetName] = useState("");
	const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

	const isOpen =
		typeof dialogState === "boolean" ? dialogState : dialogState.open;
	const initialTrackId =
		typeof dialogState === "object" && dialogState.initialTrackId
			? dialogState.initialTrackId
			: "";

	const inputRef = useRef<HTMLInputElement>(null);

	// Load preset values into state
	const applyPreset = useCallback(
		(presetKey: SpotMatchPresetKey) => {
			setPreset(presetKey);
			const config =
				PRESETS[presetKey as keyof typeof PRESETS] ||
				customPresets[presetKey] ||
				PRESETS.Balanced;

			if (config) {
				setMinScore(config.minimum_score ?? 60);
				setMaxDurationSec(config.maximum_duration_seconds ?? 10);
				setExactTitle(config.exact_title ?? false);
				setSearchPages(config.search_pages ?? 1);
				setSearchRepeats(config.search_repeats ?? 1);
				setReleasesPerArtist(config.releases_per_artist ?? 0);
				setGlobalAlbums(config.global_albums ?? 0);
				setGlobalPlaylists(config.global_playlists ?? 0);
				setTracksPerPlaylist(config.tracks_per_playlist ?? 0);
				setTitleFloor(config.minimum_title_similarity ?? 58);
				setVariantQueries(config.variant_queries ?? false);
			}
		},
		[
			customPresets,
			setPreset,
			setMinScore,
			setMaxDurationSec,
			setExactTitle,
			setSearchPages,
			setSearchRepeats,
			setReleasesPerArtist,
			setGlobalAlbums,
			setGlobalPlaylists,
			setTracksPerPlaylist,
			setTitleFloor,
			setVariantQueries,
		],
	);

	const handleSavePreset = () => {
		const name = newPresetName.trim();
		if (!name) return;
		if (["Quick", "Balanced", "Deep", "Exhaustive"].includes(name)) {
			toast.error(
				t("spotmatch.reservedPresetName", "Cannot overwrite built-in preset."),
			);
			return;
		}

		setCustomPresets((prev) => ({
			...prev,
			[name]: {
				minimum_score: minScore,
				maximum_duration_seconds: maxDurationSec,
				exact_title: exactTitle,
				search_pages: searchPages,
				search_repeats: searchRepeats,
				releases_per_artist: releasesPerArtist,
				global_albums: globalAlbums,
				global_playlists: globalPlaylists,
				tracks_per_playlist: tracksPerPlaylist,
				minimum_title_similarity: titleFloor,
				variant_queries: variantQueries,
			},
		}));
		setPreset(name);
		setIsSavingPreset(false);
		setNewPresetName("");
		toast.success(
			t("spotmatch.savedPreset", 'Saved custom preset "{name}"', { name }),
		);
	};

	const handleDeletePreset = () => {
		if (["Quick", "Balanced", "Deep", "Exhaustive"].includes(preset)) {
			toast.info(
				t(
					"spotmatch.cannotDeleteBuiltin",
					"Built-in presets cannot be deleted.",
				),
			);
			return;
		}

		setCustomPresets((prev) => {
			const next = { ...prev };
			delete next[preset];
			return next;
		});
		applyPreset("Balanced");
		toast.success(
			t("spotmatch.deletedPreset", 'Deleted custom preset "{name}"', {
				name: preset,
			}),
		);
	};

	const hasCustomApiCredentials = Boolean(
		(spotifyClientId && spotifyClientSecret) || spotifyAccessToken,
	);

	// Pre-fill input when opening if empty
	useEffect(() => {
		if (isOpen) {
			setTempClientId(spotifyClientId || "");
			setTempClientSecret(spotifyClientSecret || "");
			setTempToken(spotifyAccessToken || "");

			if (!sourceInput && !hasSearched) {
				let defaultInput = initialTrackId;

				if (!defaultInput) {
					const existingSpotifyId = lyricLines.metadata
						.find((m) => m.key === "spotifyId")
						?.value.find((v) => v.trim() !== "");

					if (existingSpotifyId) {
						defaultInput = existingSpotifyId;
					} else {
						const musicName = lyricLines.metadata.find(
							(m) => m.key === "musicName",
						)?.value[0];
						const artists = lyricLines.metadata.find((m) => m.key === "artists")
							?.value[0];
						defaultInput = [musicName, artists].filter(Boolean).join(" ");
					}
				}

				if (defaultInput) {
					setSourceInput(defaultInput);
				}
			}

			setTimeout(() => {
				inputRef.current?.focus();
			}, 50);
		}
	}, [
		isOpen,
		initialTrackId,
		lyricLines.metadata,
		spotifyClientId,
		spotifyClientSecret,
		spotifyAccessToken,
		sourceInput,
		hasSearched,
		setSourceInput,
	]);

	const currentOptions: SpotMatchOptions = useMemo(
		() => ({
			preset,
			minimum_score: minScore,
			maximum_duration_seconds: maxDurationSec,
			exact_title: exactTitle,
			search_pages: Math.max(1, searchPages),
			search_repeats: Math.max(1, searchRepeats),
			releases_per_artist: Math.max(0, releasesPerArtist),
			global_albums: Math.max(0, globalAlbums),
			global_playlists: Math.max(0, globalPlaylists),
			tracks_per_playlist: Math.max(0, tracksPerPlaylist),
			minimum_title_similarity: Math.max(0, Math.min(100, titleFloor)),
			variant_queries: variantQueries,
		}),
		[
			preset,
			minScore,
			maxDurationSec,
			exactTitle,
			searchPages,
			searchRepeats,
			releasesPerArtist,
			globalAlbums,
			globalPlaylists,
			tracksPerPlaylist,
			titleFloor,
			variantQueries,
		],
	);

	const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

	const handleSearch = useCallback(async () => {
		if (!sourceInput.trim()) return;
		setIsLoading(true);
		setHasSearched(true);
		setIsDismissedWidget(false);
		setProgressMessage(
			t(
				"spotmatch.searching",
				"Reading the source track and searching Spotify…",
			),
		);
		setMatches([]);
		setSelectedIds([]);

		try {
			const res = await findMatches(
				sourceInput.trim(),
				currentOptions,
				(msg) => setProgressMessage(msg),
				{
					clientId: spotifyClientId,
					clientSecret: spotifyClientSecret,
					accessToken: spotifyAccessToken,
				},
			);
			setSourceTrack(res.source);
			setMatches(res.matches);

			// Automatically select top matches (score >= 70)
			const autoSelected = res.matches
				.filter((m) => m.score >= 70)
				.map((m) => m.track_id);
			setSelectedIds(autoSelected);

			if (res.matches.length > 0) {
				toast.success(
					t(
						"spotmatch.foundMatches",
						"Found {count} alternate Spotify tracks",
						{
							count: res.matches.length,
						},
					),
					{
						onClick: () => setDialogState({ open: true }),
					},
				);
			} else {
				toast.info(
					t(
						"spotmatch.noMatches",
						"No alternate tracks met the filter criteria",
					),
				);
			}
		} catch (e: unknown) {
			console.error("SpotMatch Search Error:", e);
			const errorMsg = e instanceof Error ? e.message : String(e);
			if (
				errorMsg.includes("Active premium subscription required") ||
				errorMsg.includes("403")
			) {
				setShowApiSettings(true);
				toast.error(
					t(
						"spotmatch.premiumRequiredError",
						"Spotify requires Premium for Developer API keys. Paste a Bearer Token from Spotify Web Player (F12 → Network) below!",
					),
					{ autoClose: 8000 },
				);
			} else {
				toast.error(`${t("spotmatch.error", "Search failed")}: ${errorMsg}`);
			}
		} finally {
			setIsLoading(false);
			setProgressMessage("");
		}
	}, [
		sourceInput,
		currentOptions,
		spotifyClientId,
		spotifyClientSecret,
		spotifyAccessToken,
		setIsLoading,
		setHasSearched,
		setIsDismissedWidget,
		setProgressMessage,
		setMatches,
		setSelectedIds,
		setSourceTrack,
		setDialogState,
		t,
	]);

	const handleRowClick = (
		index: number,
		trackId: string,
		event: React.MouseEvent,
	) => {
		if (event.shiftKey && lastClickedIndex !== null) {
			const start = Math.min(lastClickedIndex, index);
			const end = Math.max(lastClickedIndex, index);
			const newSelected = new Set(selectedIdSet);
			for (let i = start; i <= end; i++) {
				if (matches[i]) newSelected.add(matches[i].track_id);
			}
			setSelectedIds(Array.from(newSelected));
		} else if (event.ctrlKey || event.metaKey) {
			setSelectedIds((prev) => {
				const next = new Set(prev);
				if (next.has(trackId)) next.delete(trackId);
				else next.add(trackId);
				return Array.from(next);
			});
			setLastClickedIndex(index);
		} else {
			setSelectedIds((prev) => {
				const next = new Set(prev);
				if (next.has(trackId)) next.delete(trackId);
				else next.add(trackId);
				return Array.from(next);
			});
			setLastClickedIndex(index);
		}
	};

	const handleRowDoubleClick = (trackId: string) => {
		window.open(`https://open.spotify.com/track/${trackId}`, "_blank");
	};

	const handleSelectAll = () => {
		if (selectedIds.length === matches.length) {
			setSelectedIds([]);
		} else {
			setSelectedIds(matches.map((m) => m.track_id));
		}
	};

	const handleCopySelected = () => {
		if (selectedIds.length === 0) {
			toast.info(
				t("spotmatch.selectAtLeastOne", "Select at least one track ID"),
			);
			return;
		}
		const text = selectedIds.join(",");
		navigator.clipboard.writeText(text);
		toast.success(t("spotmatch.copiedSingleId", "Copied Spotify IDs!"));
	};

	const handleCopySelectedWithSource = () => {
		if (!sourceTrack) return;
		const ids = [
			sourceTrack.id,
			...selectedIds.filter((id) => id !== sourceTrack.id),
		];
		navigator.clipboard.writeText(ids.join(","));
		toast.success(
			t(
				"spotmatch.copiedWithSource",
				"Copied source ID and {count} alternate IDs!",
				{ count: ids.length - 1 },
			),
		);
	};

	const handleExportTxt = () => {
		if (selectedIds.length === 0) {
			toast.info(
				t("spotmatch.selectAtLeastOne", "Select at least one track ID"),
			);
			return;
		}
		const blob = new Blob([selectedIds.join(",")], {
			type: "text/plain;charset=utf-8",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "spotify-ids.txt";
		a.click();
		URL.revokeObjectURL(url);
		toast.success(
			t("spotmatch.exportedTxt", "Exported {count} IDs to spotify-ids.txt", {
				count: selectedIds.length,
			}),
		);
	};

	const handleOpenInSpotify = () => {
		const targetId = selectedIds[0] || sourceTrack?.id;
		if (targetId) {
			window.open(`https://open.spotify.com/track/${targetId}`, "_blank");
		}
	};

	const handleApplyToMetadata = () => {
		if (selectedIds.length === 0) {
			toast.info(
				t("spotmatch.selectAtLeastOne", "Select at least one track ID"),
			);
			return;
		}

		const idsToAdd = selectedIds;

		setLyricLines((draft) => {
			const existingIndex = draft.metadata.findIndex(
				(m) => m.key === "spotifyId",
			);
			if (existingIndex >= 0) {
				const currentList = draft.metadata[existingIndex].value;
				const merged = Array.from(new Set([...currentList, ...idsToAdd]));
				draft.metadata[existingIndex].value = merged;
			} else {
				draft.metadata.push({
					key: "spotifyId",
					value: idsToAdd,
				});
			}
		});

		toast.success(
			t(
				"spotmatch.appliedToMetadata",
				"Successfully added Spotify IDs to metadata!",
			),
		);
	};

	const handleCopySpicyFormat = () => {
		if (selectedIds.length === 0) {
			toast.info(
				t("spotmatch.selectAtLeastOne", "Select at least one track ID"),
			);
			return;
		}
		const text = `spotifyId: ${selectedIds.join(", ")}`;
		navigator.clipboard.writeText(text);
		toast.success(
			t(
				"spotmatch.copiedSpicyFormat",
				"Copied {count} Spotify IDs in Spicy Lyrics format!",
				{
					count: selectedIds.length,
				},
			),
		);
	};

	const handleSaveApiSettings = () => {
		setSpotifyClientId(tempClientId.trim());
		setSpotifyClientSecret(tempClientSecret.trim());
		setSpotifyAccessToken(tempToken.trim());
		setShowApiSettings(false);
		toast.success(
			t("spotmatch.apiSettingsSaved", "Spotify API Settings saved!"),
		);
	};

	const handleClearApiSettings = () => {
		setTempClientId("");
		setTempClientSecret("");
		setTempToken("");
		setSpotifyClientId("");
		setSpotifyClientSecret("");
		setSpotifyAccessToken("");
		setShowApiSettings(false);
		toast.info(
			t("spotmatch.apiSettingsCleared", "Spotify API Settings cleared"),
		);
	};

	const getScoreBadgeClass = (score: number) => {
		if (score >= 85) return styles.scoreBadgeHigh;
		if (score >= 65) return styles.scoreBadgeMedium;
		return styles.scoreBadgeLow;
	};

	const allPresetKeys = [
		"Quick",
		"Balanced",
		"Deep",
		"Exhaustive",
		...Object.keys(customPresets),
	];

	return (
		<Dialog.Root
			open={isOpen}
			onOpenChange={(open) => {
				setDialogState(open ? { open: true } : { open: false });
			}}
		>
			<Dialog.Content className={styles.dialogContent}>
				{/* Title Header */}
				<Flex justify="between" align="start" mb="2">
					<Flex direction="column" gap="0">
						<Flex align="center" gap="2">
							<SpotifyIcon
								style={{ width: "22px", height: "22px", color: "#1DB954" }}
							/>
							<Dialog.Title style={{ margin: 0 }}>SpotMatch</Dialog.Title>
						</Flex>
						<Dialog.Description size="1" color="gray">
							{t(
								"spotmatch.subtitle",
								"Find alternate Spotify IDs for the same track",
							)}
						</Dialog.Description>
					</Flex>

					<Flex align="center" gap="1">
						<Tooltip
							content={t(
								"spotmatch.apiSettingsTooltip",
								"Configure Spotify API Credentials / Keys",
							)}
						>
							<IconButton
								size="1"
								variant={
									showApiSettings || hasCustomApiCredentials ? "solid" : "ghost"
								}
								color={hasCustomApiCredentials ? "green" : "gray"}
								onClick={() => setShowApiSettings((prev) => !prev)}
							>
								{hasCustomApiCredentials ? (
									<Key16Regular />
								) : (
									<Settings16Regular />
								)}
							</IconButton>
						</Tooltip>
						<Tooltip
							content={t("spotmatch.minimize", "Run in background / Minimize")}
						>
							<IconButton
								size="1"
								variant="ghost"
								color="gray"
								onClick={() => setDialogState(false)}
							>
								<ArrowMinimize16Regular />
							</IconButton>
						</Tooltip>
						<Dialog.Close>
							<IconButton size="1" variant="ghost" color="gray">
								<Dismiss16Regular />
							</IconButton>
						</Dialog.Close>
					</Flex>
				</Flex>

				{/* API Settings Collapsible Card */}
				{showApiSettings && (
					<Card mb="3" style={{ background: "var(--gray-3)" }}>
						<Flex direction="column" gap="2">
							<Flex justify="between" align="center">
								<Text size="2" weight="bold">
									{t(
										"spotmatch.apiSettingsTitle",
										"Spotify API Settings (Optional)",
									)}
								</Text>
								<Button
									size="1"
									variant="soft"
									color="gray"
									onClick={handleClearApiSettings}
								>
									{t("common.clear", "Clear")}
								</Button>
							</Flex>
							<Text size="1" color="gray">
								{t(
									"spotmatch.apiSettingsDesc",
									"SpotMatch uses anonymous web player tokens via local proxy by default. If you experience CORS errors in your browser or want higher rate limits, you can provide free API credentials from the Spotify Developer Dashboard.",
								)}
							</Text>

							<Flex gap="2">
								<Flex direction="column" gap="1" style={{ flex: 1 }}>
									<Text size="1" weight="medium">
										Client ID:
									</Text>
									<TextField.Root
										size="1"
										placeholder="e.g. 1a2b3c4d..."
										value={tempClientId}
										onChange={(e) => setTempClientId(e.target.value)}
									/>
								</Flex>
								<Flex direction="column" gap="1" style={{ flex: 1 }}>
									<Text size="1" weight="medium">
										Client Secret:
									</Text>
									<TextField.Root
										size="1"
										type="password"
										placeholder="e.g. 5e6f7g8h..."
										value={tempClientSecret}
										onChange={(e) => setTempClientSecret(e.target.value)}
									/>
								</Flex>
							</Flex>

							<Flex direction="column" gap="1">
								<Text size="1" weight="medium">
									{t(
										"spotmatch.customToken",
										"Or Custom Access Token (Bearer):",
									)}
								</Text>
								<TextField.Root
									size="1"
									type="password"
									placeholder="BQC..."
									value={tempToken}
									onChange={(e) => setTempToken(e.target.value)}
								/>
								<Text size="1" color="gray" style={{ fontSize: "11px" }}>
									{t(
										"spotmatch.bearerTokenHint",
										"Tip (No Premium needed): Open open.spotify.com in browser, press F12 → Network tab, search any song, copy token from request header (authorization: Bearer BQC...).",
									)}
								</Text>
							</Flex>

							<Flex justify="end" gap="2" mt="1">
								<Button
									size="1"
									variant="soft"
									color="gray"
									onClick={() => setShowApiSettings(false)}
								>
									{t("common.cancel", "Cancel")}
								</Button>
								<Button
									size="1"
									variant="solid"
									color="green"
									onClick={handleSaveApiSettings}
								>
									<Checkmark16Regular />
									{t("common.save", "Save")}
								</Button>
							</Flex>
						</Flex>
					</Card>
				)}

				{/* Search Bar Row */}
				<Flex gap="2" mb="2">
					<TextField.Root
						ref={inputRef}
						className={styles.searchBar}
						size="2"
						placeholder={t(
							"spotmatch.inputPlaceholder",
							"Paste a Spotify track ID or URL, then press Enter.",
						)}
						value={sourceInput}
						onChange={(e) => setSourceInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !isLoading) {
								handleSearch();
							}
						}}
					>
						<TextField.Slot>
							<Search16Regular />
						</TextField.Slot>
					</TextField.Root>
					<Button
						size="2"
						variant="solid"
						color="blue"
						disabled={isLoading || !sourceInput.trim()}
						onClick={handleSearch}
					>
						{isLoading ? <Spinner size="1" /> : <Search16Regular />}
						{t("spotmatch.findMatches", "Find matches")}
					</Button>
				</Flex>

				{/* Primary Options Row */}
				<Flex align="center" justify="between" wrap="wrap" gap="2" mb="2">
					<Flex align="center" gap="2">
						<Text size="1" weight="medium">
							{t("spotmatch.preset", "Preset")}
						</Text>
						<Select.Root
							size="1"
							value={preset}
							onValueChange={(val) => applyPreset(val as SpotMatchPresetKey)}
						>
							<Select.Trigger style={{ minWidth: "100px" }} />
							<Select.Content>
								{allPresetKeys.map((k) => (
									<Select.Item key={k} value={k}>
										{k}
									</Select.Item>
								))}
							</Select.Content>
						</Select.Root>

						{/* Save / Delete Preset */}
						{isSavingPreset ? (
							<Flex align="center" gap="1">
								<TextField.Root
									size="1"
									placeholder={t("spotmatch.presetName", "Preset name")}
									value={newPresetName}
									onChange={(e) => setNewPresetName(e.target.value)}
									style={{ width: "110px" }}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleSavePreset();
										if (e.key === "Escape") setIsSavingPreset(false);
									}}
								/>
								<IconButton
									size="1"
									variant="solid"
									color="green"
									onClick={handleSavePreset}
								>
									<Checkmark16Regular />
								</IconButton>
								<IconButton
									size="1"
									variant="ghost"
									color="gray"
									onClick={() => setIsSavingPreset(false)}
								>
									<Dismiss16Regular />
								</IconButton>
							</Flex>
						) : (
							<Button
								size="1"
								variant="soft"
								color="gray"
								onClick={() => setIsSavingPreset(true)}
							>
								<Save16Regular />
								{t("spotmatch.save", "Save")}
							</Button>
						)}

						{!["Quick", "Balanced", "Deep", "Exhaustive"].includes(preset) && (
							<Button
								size="1"
								variant="soft"
								color="red"
								onClick={handleDeletePreset}
							>
								<Delete16Regular />
								{t("spotmatch.delete", "Delete")}
							</Button>
						)}
					</Flex>

					<Flex align="center" gap="3">
						<Flex align="center" gap="1">
							<Text size="1" color="gray">
								{t("spotmatch.minMatch", "Minimum match")}
							</Text>
							<Select.Root
								size="1"
								value={String(minScore)}
								onValueChange={(v) => setMinScore(Number(v))}
							>
								<Select.Trigger />
								<Select.Content>
									{SCORE_OPTIONS.map((sc) => (
										<Select.Item key={sc} value={String(sc)}>
											{sc}%
										</Select.Item>
									))}
								</Select.Content>
							</Select.Root>
						</Flex>

						<Flex align="center" gap="1">
							<Text size="1" color="gray">
								{t("spotmatch.maxDuration", "Max duration difference")}
							</Text>
							<Select.Root
								size="1"
								value={String(maxDurationSec)}
								onValueChange={(v) => setMaxDurationSec(Number(v))}
							>
								<Select.Trigger />
								<Select.Content>
									{DURATION_OPTIONS.map((d) => (
										<Select.Item key={d} value={String(d)}>
											{d} sec
										</Select.Item>
									))}
								</Select.Content>
							</Select.Root>
						</Flex>

						<Flex align="center" gap="1">
							<Checkbox
								size="1"
								checked={exactTitle}
								onCheckedChange={(c) => setExactTitle(Boolean(c))}
							/>
							<Text
								size="1"
								style={{ cursor: "pointer" }}
								onClick={() => setExactTitle(!exactTitle)}
							>
								{t("spotmatch.exactTitle", "Exact title only")}
							</Text>
						</Flex>

						<Flex align="center" gap="1">
							<Checkbox
								size="1"
								checked={showAdvanced}
								onCheckedChange={(c) => setShowAdvanced(Boolean(c))}
							/>
							<Text
								size="1"
								style={{ cursor: "pointer" }}
								onClick={() => setShowAdvanced(!showAdvanced)}
							>
								{t("spotmatch.showAdvanced", "Show advanced options")}
							</Text>
						</Flex>
					</Flex>
				</Flex>

				{/* Advanced Search Limits Panel */}
				{showAdvanced && (
					<Box className={styles.advancedBox} mb="2">
						<Text size="1" weight="bold" color="gray" mb="1" as="div">
							{t("spotmatch.searchLimitsTitle", "Search limits (editable)")}
						</Text>
						<div className={styles.limitsGrid}>
							<Flex direction="column" gap="1">
								<Text size="1" color="gray">
									Pages ×50
								</Text>
								<TextField.Root
									size="1"
									type="number"
									min="1"
									max="50"
									value={String(searchPages)}
									onChange={(e) => setSearchPages(Number(e.target.value) || 1)}
								/>
							</Flex>
							<Flex direction="column" gap="1">
								<Text size="1" color="gray">
									Search passes
								</Text>
								<TextField.Root
									size="1"
									type="number"
									min="1"
									max="20"
									value={String(searchRepeats)}
									onChange={(e) =>
										setSearchRepeats(Number(e.target.value) || 1)
									}
								/>
							</Flex>
							<Flex direction="column" gap="1">
								<Text size="1" color="gray">
									Artist releases
								</Text>
								<TextField.Root
									size="1"
									type="number"
									min="0"
									max="1000"
									value={String(releasesPerArtist)}
									onChange={(e) =>
										setReleasesPerArtist(Number(e.target.value) || 0)
									}
								/>
							</Flex>
							<Flex direction="column" gap="1">
								<Text size="1" color="gray">
									Global albums
								</Text>
								<TextField.Root
									size="1"
									type="number"
									min="0"
									max="1000"
									value={String(globalAlbums)}
									onChange={(e) => setGlobalAlbums(Number(e.target.value) || 0)}
								/>
							</Flex>
							<Flex direction="column" gap="1">
								<Text size="1" color="gray">
									Playlists
								</Text>
								<TextField.Root
									size="1"
									type="number"
									min="0"
									max="500"
									value={String(globalPlaylists)}
									onChange={(e) =>
										setGlobalPlaylists(Number(e.target.value) || 0)
									}
								/>
							</Flex>
							<Flex direction="column" gap="1">
								<Text size="1" color="gray">
									Tracks/playlist
								</Text>
								<TextField.Root
									size="1"
									type="number"
									min="0"
									max="5000"
									value={String(tracksPerPlaylist)}
									onChange={(e) =>
										setTracksPerPlaylist(Number(e.target.value) || 0)
									}
								/>
							</Flex>
							<Flex direction="column" gap="1">
								<Text size="1" color="gray">
									Title floor %
								</Text>
								<TextField.Root
									size="1"
									type="number"
									min="0"
									max="100"
									value={String(titleFloor)}
									onChange={(e) => setTitleFloor(Number(e.target.value) || 0)}
								/>
							</Flex>
						</div>

						<Flex align="center" gap="2" mt="2">
							<Checkbox
								size="1"
								checked={variantQueries}
								onCheckedChange={(c) => setVariantQueries(Boolean(c))}
							/>
							<Text
								size="1"
								color="gray"
								style={{ cursor: "pointer" }}
								onClick={() => setVariantQueries(!variantQueries)}
							>
								{t(
									"spotmatch.variantQueriesHint",
									"Include variant queries (cover, remix, live, instrumental, karaoke, sped up, slowed)",
								)}
							</Text>
						</Flex>
					</Box>
				)}

				{/* Source Track Banner (if loaded) */}
				{sourceTrack && (
					<Box className={styles.sourceBanner} mb="2">
						<Flex justify="between" align="center">
							<Flex align="center" gap="2">
								<Badge color="green" size="1">
									{t("spotmatch.sourceTrack", "Source")}
								</Badge>
								<Text size="2" weight="bold">
									{sourceTrack.name}
								</Text>
								<Text size="2" color="gray">
									— {sourceTrack.artists.map((a) => a.name).join(", ")}
								</Text>
								<Text size="1" color="gray">
									· {formatDuration(sourceTrack.duration_ms)}
								</Text>
								<Text size="1" color="gray">
									· {matches.length}{" "}
									{t("spotmatch.alternativesFound", "alternatives found")}
								</Text>
							</Flex>
							<Text size="1" color="gray" style={{ fontFamily: "monospace" }}>
								{sourceTrack.id}
							</Text>
						</Flex>
					</Box>
				)}

				{/* Progress status */}
				{isLoading && (
					<Flex align="center" gap="2" mb="2" p="1">
						<Spinner size="1" />
						<Text size="1" color="gray">
							{progressMessage}
						</Text>
					</Flex>
				)}

				{/* Results Table */}
				<div className={styles.tableContainer}>
					{matches.length === 0 ? (
						<div className={styles.emptyState}>
							<Search24Regular className={styles.emptyStateIcon} />
							<Text size="2" color="gray">
								{hasSearched
									? t(
											"spotmatch.noResults",
											"No alternate tracks found. Try lowering minimum score or switching to Deep preset.",
										)
									: t(
											"spotmatch.readyToSearch",
											"Paste a Spotify track ID or URL, then press Enter.",
										)}
							</Text>
						</div>
					) : (
						<div className={styles.tableScroll}>
							<table className={styles.matchTable}>
								<thead>
									<tr>
										<th style={{ width: "32px", textAlign: "center" }}>
											<Checkbox
												size="1"
												checked={
													matches.length > 0 &&
													selectedIds.length === matches.length
												}
												onCheckedChange={handleSelectAll}
											/>
										</th>
										<th style={{ width: "70px" }}>
											{t("spotmatch.matchCol", "Match")}
										</th>
										<th>{t("spotmatch.titleCol", "Title")}</th>
										<th>{t("spotmatch.artistCol", "Artist")}</th>
										<th style={{ width: "75px" }}>
											{t("spotmatch.lengthCol", "Length")}
										</th>
										<th style={{ width: "85px" }}>
											{t("spotmatch.differenceCol", "Difference")}
										</th>
										<th>{t("spotmatch.albumCol", "Album")}</th>
										<th style={{ width: "180px" }}>
											{t("spotmatch.spotifyIdCol", "Spotify ID")}
										</th>
									</tr>
								</thead>
								<tbody>
									{matches.map((item, idx) => {
										const isSelected = selectedIdSet.has(item.track_id);
										const diffSeconds = (item.duration_delta_ms / 1000).toFixed(
											2,
										);
										const diffDisplay =
											item.duration_delta_ms === 0
												? "0.00s"
												: `${diffSeconds}s`;

										return (
											<tr
												key={item.track_id}
												className={`${styles.tableRow} ${isSelected ? styles.tableRowSelected : ""}`}
												onClick={(e) => handleRowClick(idx, item.track_id, e)}
												onDoubleClick={() =>
													handleRowDoubleClick(item.track_id)
												}
											>
												<td
													style={{ textAlign: "center" }}
													onClick={(e) => e.stopPropagation()}
												>
													<Checkbox
														size="1"
														checked={isSelected}
														onCheckedChange={() => {
															setSelectedIds((prev) => {
																const next = new Set(prev);
																if (next.has(item.track_id))
																	next.delete(item.track_id);
																else next.add(item.track_id);
																return Array.from(next);
															});
														}}
													/>
												</td>
												<td>
													<Badge
														size="1"
														className={getScoreBadgeClass(item.score)}
													>
														{item.score}%
													</Badge>
												</td>
												<td style={{ fontWeight: 500 }}>{item.title}</td>
												<td style={{ color: "var(--gray-11)" }}>
													{item.artists}
												</td>
												<td style={{ color: "var(--gray-11)" }}>
													{formatDuration(item.duration_ms)}
												</td>
												<td
													style={{
														color: "var(--gray-11)",
														fontFamily: "monospace",
													}}
												>
													{diffDisplay}
												</td>
												<td style={{ color: "var(--gray-11)" }}>
													{item.album}
												</td>
												<td
													style={{
														fontFamily: "monospace",
														fontSize: "12px",
														color: "var(--gray-10)",
													}}
												>
													{item.track_id}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>

				{/* Bottom Actions Bar */}
				<Flex
					direction="column"
					gap="2"
					mt="2"
					pt="2"
					style={{ borderTop: "1px solid var(--gray-4)" }}
				>
					<Flex justify="between" align="center" wrap="wrap" gap="2">
						<Flex gap="2" wrap="wrap" align="center">
							<Button
								size="1"
								variant="soft"
								color="gray"
								disabled={selectedIds.length === 0}
								onClick={handleCopySelected}
							>
								<Copy16Regular />
								{t("spotmatch.copySelected", "Copy selected IDs")}
							</Button>

							<Button
								size="1"
								variant="soft"
								color="gray"
								disabled={selectedIds.length === 0 || !sourceTrack}
								onClick={handleCopySelectedWithSource}
							>
								<Copy16Regular />
								{t(
									"spotmatch.copySelectedWithSource",
									"Copy selected + source",
								)}
							</Button>

							<Button
								size="1"
								variant="soft"
								color="gray"
								disabled={selectedIds.length === 0 && !sourceTrack}
								onClick={handleOpenInSpotify}
							>
								<Open16Regular />
								{t("spotmatch.openSpotify", "Open in Spotify")}
							</Button>

							<Button
								size="1"
								variant="soft"
								color="gray"
								disabled={matches.length === 0}
								onClick={handleSelectAll}
							>
								{selectedIds.length === matches.length ? (
									<SelectAllOff16Regular />
								) : (
									<SelectAllOn16Regular />
								)}
								{selectedIds.length === matches.length
									? t("spotmatch.deselectAll", "Deselect all")
									: t("spotmatch.selectAll", "Select all")}
							</Button>

							<Button
								size="1"
								variant="soft"
								color="blue"
								disabled={selectedIds.length === 0}
								onClick={handleExportTxt}
							>
								<DocumentArrowDown16Regular />
								{t("spotmatch.exportTxt", "Export selected to TXT")}
							</Button>
						</Flex>

						<Flex gap="2" align="center">
							<Button
								size="1"
								variant="soft"
								color="amber"
								disabled={selectedIds.length === 0}
								onClick={handleCopySpicyFormat}
							>
								<Copy16Regular />
								{t("spotmatch.copySpicyFormat", "Copy Spicy Lyrics format")}
							</Button>

							<Button
								size="1"
								variant="solid"
								color="green"
								disabled={selectedIds.length === 0}
								onClick={handleApplyToMetadata}
							>
								<Checkmark16Regular />
								{t("spotmatch.applyToMetadata", "Apply to Metadata")}
							</Button>
						</Flex>
					</Flex>

					{/* Hint & Status Row */}
					<Flex justify="between" align="center" px="1">
						<Text size="1" color="gray">
							{matches.length > 0
								? t(
										"spotmatch.selectedCount",
										"Selected {selected} of {total}",
										{
											selected: selectedIds.length,
											total: matches.length,
										},
									)
								: ""}
						</Text>

						<Text
							size="1"
							color="gray"
							style={{ fontSize: "11px", whiteSpace: "nowrap" }}
						>
							{t(
								"spotmatch.hintClick",
								"Ctrl/Shift-click to select multiple · double-click to open",
							)}
						</Text>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
