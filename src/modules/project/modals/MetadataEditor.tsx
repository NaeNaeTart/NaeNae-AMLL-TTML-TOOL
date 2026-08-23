import {
	Add16Regular,
	AlbumRegular,
	Delete16Regular,
	Image16Regular,
	Info16Regular,
	MusicNote1Regular,
	NumberSymbol16Regular,
	Open16Regular,
	Person16Regular,
	Search16Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Dialog,
	DropdownMenu,
	Flex,
	IconButton,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useImmerAtom } from "jotai-immer";
import {
	memo,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { getBetterGeniusCoverArt } from "$/modules/genius/utils/image";
import {
	geniusSearchDialogAtom,
	metadataEditorDialogAtom,
	spotMatchDialogAtom,
} from "$/states/dialogs.ts";
import { ActiveFileKind, activeFileKindAtom, lyricLinesAtom } from "$/states/main.ts";
import type { TTMLLyric } from "$/types/ttml";
import styles from "./MetadataEditor.module.css";
import {
	AppleMusicIcon,
	GithubIcon,
	NeteaseIcon,
	QQMusicIcon,
	SpotifyIcon,
} from "./PlatformIcons";

interface MetadataEntryProps {
	entry: { key: string; value: string[] };
	index: number;
	setLyricLines: (args: (prev: TTMLLyric) => void) => void;
	option: SelectOption | null;
	focusAddKeyButton: () => void;
}

const MetadataEntry = memo(
	({
		entry,
		index,
		setLyricLines,
		option,
		focusAddKeyButton,
	}: MetadataEntryProps) => {
		const validation = option?.validation;
		const rowHasError = validation
			? entry.value.some(
					(val) => val.trim() !== "" && !validation.verifier(val),
				)
			: false;

		const rowHasDuplicate = useMemo(() => {
			const values = entry.value.filter((v) => v.trim() !== "");
			return new Set(values).size !== values.length;
		}, [entry.value]);

		const { t } = useTranslation();
		const setSpotMatchDialogOpen = useSetAtom(spotMatchDialogAtom);

		const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

		const [focusIndex, setFocusIndex] = useState<number | null>(null);

		useEffect(() => {
			if (focusIndex !== null) {
				const targetInput = inputRefs.current[focusIndex];
				if (targetInput) {
					targetInput.focus();
					const len = targetInput.value.length;
					targetInput.setSelectionRange(len, len);
				}
				setFocusIndex(null);
			}
		}, [focusIndex]);

		const [isDraggingCategory, setIsDraggingCategory] = useState(false);
		const [dragInputIndex, setDragInputIndex] = useState<number | null>(null);

		const handleCategoryDrop = useCallback(
			(e: React.DragEvent) => {
				e.preventDefault();
				setIsDraggingCategory(false);
				const text = e.dataTransfer.getData("text");
				if (!text) return;

				const parts = text
					.split(/[\n,;/，；、|\\]/)
					.map((s) => s.trim())
					.filter((s) => s !== "");

				if (parts.length === 0) return;

				setLyricLines((prev) => {
					const currentList = prev.metadata[index].value;
					const existingSet = new Set<string>();
					const emptyIndices: number[] = [];

					currentList.forEach((val, i) => {
						if (val.trim() === "") {
							emptyIndices.push(i);
						} else {
							existingSet.add(val);
						}
					});

					for (const part of parts) {
						if (existingSet.has(part)) continue;

						if (emptyIndices.length > 0) {
							// biome-ignore lint/style/noNonNullAssertion: 肯定有
							const slotIndex = emptyIndices.shift()!;
							currentList[slotIndex] = part;
						} else {
							currentList.push(part);
						}
						existingSet.add(part);
					}
				});
			},
			[index, setLyricLines],
		);

		return (
			<tbody
				className={isDraggingCategory ? styles.dragOverCategory : undefined}
				onDragOver={(e) => {
					e.preventDefault();
					setIsDraggingCategory(true);
				}}
				onDragLeave={(e) => {
					if (!e.currentTarget.contains(e.relatedTarget as Node)) {
						setIsDraggingCategory(false);
					}
				}}
				onDrop={handleCategoryDrop}
			>
				{entry.value.map((vv, ii) => {
					const itemHasError = validation
						? vv.trim() !== "" && !validation.verifier(vv)
						: false;
					const isDuplicate =
						vv.trim() !== "" && entry.value.filter((v) => v === vv).length > 1;
					const hasAnyError = itemHasError || isDuplicate;

					const url = option?.urlFormatter?.(vv);
					const isLinkable = !!option?.isLinkable;
					const isValid = validation ? validation.verifier(vv) : true;
					const isButtonEnabled = !!url && isValid;

					return (
						<tr key={`metadata-${entry.key}-${ii}`}>
							<td>
								{ii === 0 && (
									<Flex
										align="center"
										gap="2"
										style={{
											width: "100%",
										}}
									>
										<span
											style={{
												display: "flex",
												color: "var(--gray-12)",
											}}
										>
											{option?.icon || <Info16Regular />}
										</span>

										<Text
											style={{
												whiteSpace: "normal",
												wordBreak: "break-word",
											}}
										>
											{option?.label || entry.key}
										</Text>
									</Flex>
								)}
							</td>
							<td>
								<Flex gap="1" ml="2" mt="1">
									<TextField.Root
										data-metadata-input="true"
										ref={(el) => {
											inputRefs.current[ii] = el;
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												setLyricLines((prev) => {
													prev.metadata[index].value.splice(ii + 1, 0, "");
												});
												setFocusIndex(ii + 1);
											} else if (
												e.key === "Backspace" &&
												e.currentTarget.value === ""
											) {
												if (e.repeat) return;

												e.preventDefault();

												if (ii > 0) {
													setLyricLines((prev) => {
														prev.metadata[index].value.splice(ii, 1);
													});
													setFocusIndex(ii - 1);
												} else {
													setLyricLines((prev) => {
														prev.metadata[index].value.splice(ii, 1);
														if (prev.metadata[index].value.length === 0) {
															prev.metadata.splice(index, 1);
														}
													});
												}
											} else if (e.key === "Tab" && !e.shiftKey) {
												const allInputs = Array.from(
													document.querySelectorAll<HTMLInputElement>(
														'[data-metadata-input="true"]',
													),
												);
												const currentIndex = allInputs.indexOf(e.currentTarget);
												const nextInput =
													currentIndex >= 0
														? allInputs[currentIndex + 1]
														: null;

												e.preventDefault();
												if (nextInput) {
													nextInput.focus();
													const len = nextInput.value.length;
													nextInput.setSelectionRange(len, len);
												} else {
													focusAddKeyButton();
												}
											}
										}}
										value={vv}
										className={`${styles.metadataInput} ${
											dragInputIndex === ii ? styles.dragOverInput : ""
										}`}
										onChange={(e) => {
											const newValue = e.currentTarget.value;
											setLyricLines((prev) => {
												prev.metadata[index].value[ii] = newValue;
											});
										}}
										onDragOver={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setDragInputIndex(ii);
										}}
										onDragLeave={() => setDragInputIndex(null)}
										onDrop={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setDragInputIndex(null);
											setIsDraggingCategory(false);
											const text = e.dataTransfer.getData("text");
											if (text) {
												setLyricLines((prev) => {
													prev.metadata[index].value[ii] = text;
												});
											}
										}}
										variant={hasAnyError ? "soft" : "surface"}
										color={
											itemHasError
												? validation?.severe
													? "red"
													: "orange"
												: isDuplicate
													? "red"
													: undefined
										}
									/>
									{entry.key === "cover_art" && vv && (
										<Box
											style={{
												width: "32px",
												height: "32px",
												borderRadius: "4px",
												overflow: "hidden",
												flexShrink: 0,
											}}
										>
											<img
												src={getBetterGeniusCoverArt(vv, 100)}
												alt="Cover"
												style={{
													width: "100%",
													height: "100%",
													objectFit: "cover",
												}}
												referrerPolicy="no-referrer"
											/>
										</Box>
									)}
									{entry.key === "spotifyId" && (
										<IconButton
											variant="soft"
											title={t(
												"spotmatch.button",
												"SpotMatch (Find Spotify IDs)",
											)}
											onClick={() => {
												setSpotMatchDialogOpen({
													open: true,
													initialTrackId: vv,
												});
											}}
										>
											<Search16Regular />
										</IconButton>
									)}
									{isLinkable && (
										<IconButton
											disabled={!isButtonEnabled}
											asChild={isButtonEnabled}
											variant="soft"
											title={t("metadataDialog.openLink", "打开链接")}
										>
											{isButtonEnabled ? (
												<a
													href={url || ""}
													target="_blank"
													rel="noopener noreferrer"
												>
													<Open16Regular />
												</a>
											) : (
												<Open16Regular />
											)}
										</IconButton>
									)}
									<IconButton
										variant="soft"
										onClick={() => {
											setLyricLines((prev) => {
												prev.metadata[index].value.splice(ii, 1);
												if (prev.metadata[index].value.length === 0) {
													prev.metadata.splice(index, 1);
												}
											});
										}}
									>
										<Delete16Regular />
									</IconButton>
								</Flex>
							</td>
						</tr>
					);
				})}
				<tr className={styles.newItemLine}>
					<td />
					<td className={styles.newItemBtnRow}>
						<Flex direction="column">
							{validation && rowHasError && (
								<Text
									color={validation.severe ? "red" : "orange"}
									size="1"
									mb="1"
									mt="1"
									wrap="wrap"
								>
									{validation.message}
								</Text>
							)}
							{rowHasDuplicate && (
								<Text color="red" size="1" mb="1" mt="1" wrap="wrap">
									{t("metadataDialog.duplicateMsg", "存在重复的元数据值")}
								</Text>
							)}
							<Button
								variant="soft"
								my="1"
								onClick={() => {
									setLyricLines((prev) => {
										prev.metadata[index].value.push("");
									});
								}}
							>
								{t("metadataDialog.addValue", "添加")}
							</Button>
						</Flex>
					</td>
				</tr>
			</tbody>
		);
	},
);

const VOCALIST_DEFAULT_LABELS: Record<string, string> = {
	v1: "Lead",
	v2: "Duet",
	v3: "Middle",
	v4: "Harmony",
};

// Real vocalist names editor. Only relevant for the lyricsfile (YAML) export —
// TTML has no concept of named vocalists, only the generic v1/v2/v3 agent ids.
const VocalistNamesEditor = () => {
	const { t } = useTranslation();
	const [lyricLines, setLyricLines] = useImmerAtom(lyricLinesAtom);
	const [activeFileKind] = useAtom(activeFileKindAtom);

	const vocalistIds = useMemo(() => {
		const lines = lyricLines.lyricLines;
		const ids: string[] = ["v1"];
		if (lines.some((l) => l.isDuet && !l.isDuetGroup)) ids.push("v2");
		if (lines.some((l) => l.isMiddle)) ids.push("v3");
		if (lines.some((l) => l.isDuetGroup)) ids.push("v4");
		return ids;
	}, [lyricLines.lyricLines]);

	if (activeFileKind !== ActiveFileKind.Lyricsfile || vocalistIds.length <= 1) {
		return null;
	}

	return (
		<Box mb="4">
			<Flex align="center" gap="2" mb="2">
				<Person16Regular />
				<Text weight="bold" size="2">
					{t("metadataDialog.vocalists.title", "Vocalist names (lyricsfile)")}
				</Text>
			</Flex>
			<Text size="1" color="gray" mb="2" as="p">
				{t(
					"metadataDialog.vocalists.hint",
					"Only used when exporting/importing .lyricsfile.yaml. Give each generic voice (v1, v2, v3, v4) a real singer/artist name.",
				)}
			</Text>
			<Flex direction="column" gap="2">
				{vocalistIds.map((id) => (
					<Flex key={id} align="center" gap="2">
						<Text size="1" color="gray" style={{ width: "3.5em", flexShrink: 0 }}>
							{id}
						</Text>
						<TextField.Root
							style={{ flexGrow: 1 }}
							placeholder={VOCALIST_DEFAULT_LABELS[id] ?? id}
							value={lyricLines.vocalistNames?.[id] ?? ""}
							onChange={(e) => {
								const newValue = e.currentTarget.value;
								setLyricLines((prev) => {
									if (!prev.vocalistNames) prev.vocalistNames = {};
									if (newValue.trim().length === 0) {
										delete prev.vocalistNames[id];
									} else {
										prev.vocalistNames[id] = newValue;
									}
								});
							}}
						/>
					</Flex>
				))}
			</Flex>
		</Box>
	);
};

interface SelectOption {
	label: string;
	value: string;
	icon: ReactNode;
	isLinkable?: true;
	urlFormatter?: (value: string) => string | null;
	validation?: {
		verifier: (value: string) => boolean;
		message: string;
		/** red for true, orange for false */
		severe?: boolean;
	};
}

export const MetadataEditor = () => {
	const [metadataEditorDialog, setMetadataEditorDialog] = useAtom(
		metadataEditorDialogAtom,
	);
	const [customKey, setCustomKey] = useState("");
	const [lyricLines, setLyricLines] = useImmerAtom(lyricLinesAtom);
	const addKeyButtonRef = useRef<HTMLButtonElement | null>(null);
	const setGeniusSearchDialogOpen = useSetAtom(geniusSearchDialogAtom);
	const setSpotMatchDialogOpen = useSetAtom(spotMatchDialogAtom);

	const { t } = useTranslation();

	const builtinOptions: SelectOption[] = useMemo(() => {
		const numeric = (value: string) => /^\d+$/.test(value);
		const alphanumeric = (value: string) => /^[a-zA-Z0-9]+$/.test(value);

		const getPlatformUrl = (key: string, value: string) => {
			if (!value || !value.trim()) return null;

			switch (key) {
				case "ncmMusicId":
					return `https://music.163.com/#/song?id=${value}`;
				case "qqMusicId":
					return `https://y.qq.com/n/ryqq/songDetail/${value}`;
				case "spotifyId":
					return `https://open.spotify.com/track/${value}`;
				case "appleMusicId":
					return `https://music.apple.com/song/${value}`;
				case "ttmlAuthorGithubLogin":
					return `https://github.com/${value}`;
				case "isrc":
					return `https://isrcsearch.ifpi.org/?tab=%22code%22&isrcCode=%22${value}%22`;
				default:
					return null;
			}
		};
		return [
			{
				// 歌词所匹配的歌曲名
				label: t("metadataDialog.builtinOptions.musicName", "歌曲名称"),
				value: "musicName",
				icon: <MusicNote1Regular />,
			},
			{
				// 歌词所匹配的歌手名
				label: t("metadataDialog.builtinOptions.artists", "歌曲的艺术家"),
				value: "artists",
				icon: <Person16Regular />,
				validation: {
					verifier: (value: string) => !/^.+[,;&，；、].+$/.test(value),
					message: t(
						"metadataDialog.builtinOptions.artistsInvalidMsg",
						"如果有多个艺术家，请多次添加该键值，避免使用分隔符",
					),
				},
			},
			{
				label: t("metadataDialog.builtinOptions.songwriter", "词曲作者"),
				value: "songwriter",
				icon: <Person16Regular />,
				validation: {
					verifier: (value: string) => !/^.+[,;&，；、].+$/.test(value),
					message: t(
						"metadataDialog.builtinOptions.songwriterInvalidMsg",
						"如果有多个词曲作者，请多次添加该键值，避免使用分隔符",
					),
				},
			},
			{
				// 歌词所匹配的专辑名
				label: t("metadataDialog.builtinOptions.album", "歌曲的专辑名"),
				value: "album",
				icon: <AlbumRegular />,
			},
			{
				label: t("metadataDialog.builtinOptions.coverArt", "Cover URL"),
				value: "cover_art",
				icon: <Image16Regular />,
			},
			{
				// 歌词所匹配的网易云音乐 ID
				label: t("metadataDialog.builtinOptions.ncmMusicId", "网易云音乐 ID"),
				value: "ncmMusicId",
				icon: <NeteaseIcon />,
				isLinkable: true,
				urlFormatter: (val) => getPlatformUrl("ncmMusicId", val),
				validation: {
					verifier: numeric,
					message: t(
						"metadataDialog.builtinOptions.ncmMusicIdInvalidMsg",
						"网易云音乐 ID 应为纯数字",
					),
					severe: true,
				},
			},
			{
				// 歌词所匹配的 QQ 音乐 ID
				label: t("metadataDialog.builtinOptions.qqMusicId", "QQ 音乐 ID"),
				value: "qqMusicId",
				icon: <QQMusicIcon />,
				isLinkable: true,
				urlFormatter: (val) => getPlatformUrl("qqMusicId", val),
				validation: {
					verifier: alphanumeric,
					message: t(
						"metadataDialog.builtinOptions.qqMusicIdInvalidMsg",
						"QQ 音乐 ID 应为字母或数字",
					),
					severe: true,
				},
			},
			{
				// 歌词所匹配的 Spotify 音乐 ID
				label: t("metadataDialog.builtinOptions.spotifyId", "Spotify 音乐 ID"),
				value: "spotifyId",
				icon: <SpotifyIcon />,
				isLinkable: true,
				urlFormatter: (val) => getPlatformUrl("spotifyId", val),
				validation: {
					verifier: alphanumeric,
					message: t(
						"metadataDialog.builtinOptions.spotifyIdInvalidMsg",
						"Spotify ID 应为字母或数字",
					),
					severe: true,
				},
			},
			{
				// 歌词所匹配的 Apple Music 音乐 ID
				label: t(
					"metadataDialog.builtinOptions.appleMusicId",
					"Apple Music 音乐 ID",
				),
				value: "appleMusicId",
				icon: <AppleMusicIcon />,
				isLinkable: true,
				urlFormatter: (val) => getPlatformUrl("appleMusicId", val),
				validation: {
					verifier: numeric,
					message: t(
						"metadataDialog.builtinOptions.appleMusicIdInvalidMsg",
						"Apple Music ID 应为纯数字",
					),
					severe: true,
				},
			},
			{
				// 歌词所匹配的 ISRC 编码
				label: t("metadataDialog.builtinOptions.isrc", "歌曲的 ISRC 号码"),
				value: "isrc",
				icon: <NumberSymbol16Regular />,
				isLinkable: true,
				urlFormatter: (val) => getPlatformUrl("isrc", val),
				validation: {
					verifier: (value: string) =>
						/^[A-Z]{2}-?[A-Z0-9]{3}-?\d{2}-?\d{5}$/.test(value),
					message: t(
						"metadataDialog.builtinOptions.isrcInvalidMsg",
						"ISRC 编码格式应为 CC-XXX-YY-NNNNN",
					),
					severe: true,
				},
			},
			{
				// 逐词歌词作者 GitHub ID，例如 39523898
				label: t(
					"metadataDialog.builtinOptions.ttmlAuthorGithub",
					"歌词作者 GitHub ID",
				),
				value: "ttmlAuthorGithub",
				icon: <GithubIcon />,
				validation: {
					verifier: numeric,
					message: t(
						"metadataDialog.builtinOptions.ttmlAuthorGithubInvalidMsg",
						"GitHub ID 应为纯数字",
					),
					severe: true,
				},
			},
			{
				// 逐词歌词作者 GitHub 用户名，例如 Steve-xmh
				label: t(
					"metadataDialog.builtinOptions.ttmlAuthorGithubLogin",
					"歌词作者 GitHub 用户名",
				),
				value: "ttmlAuthorGithubLogin",
				icon: <GithubIcon />,
				isLinkable: true,
				urlFormatter: (val) => getPlatformUrl("ttmlAuthorGithubLogin", val),
				validation: {
					verifier: (value: string) =>
						/^(?!.*--)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(
							value,
						),
					message: t(
						"metadataDialog.builtinOptions.ttmlAuthorGithubLoginInvalidMsg",
						"GitHub username should be alphanumeric or hyphens, up to 39 characters",
					),
					severe: true,
				},
			},
			{
				label: t(
					"metadataDialog.builtinOptions.lyricsfileCreatedByDiscord",
					"[BETA] Lyricsfile creator (Discord username)",
				),
				value: "lyricsfileCreatedByDiscord",
				icon: <Person16Regular />,
				validation: {
					verifier: (value: string) =>
						/^(?!.*\.\.)(?!\.)[a-z0-9._]{2,32}(?<!\.)$/.test(value),
					message: t(
						"metadataDialog.builtinOptions.lyricsfileCreatedByDiscordInvalidMsg",
						"Discord username should be lowercase, 2-32 chars (letters, digits, . or _). Only used when exporting/reading .lyricsfile.yaml — not verified against any server.",
					),
					severe: false,
				},
			},
		];
	}, [t]);

	const findOptionByKey = useCallback(
		(key: string) => {
			return builtinOptions.find((v) => v.value === key) || null;
		},
		[builtinOptions],
	);

	const focusAddKeyButton = useCallback(() => {
		addKeyButtonRef.current?.focus();
	}, []);

	return (
		<Dialog.Root
			open={metadataEditorDialog}
			onOpenChange={setMetadataEditorDialog}
		>
			<Dialog.Content className={styles.dialogContent}>
				<div className={styles.dialogHeader}>
					<Flex align="center" gap="2" justify="between">
						<Dialog.Title style={{ margin: 0 }}>
							{t("metadataDialog.title", "元数据编辑器")}
						</Dialog.Title>
						<IconButton variant="ghost" color="gray" asChild>
							<a
								href="https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL"
								target="_blank"
								rel="noreferrer"
								title="GitHub"
							>
								<GithubIcon />
							</a>
						</IconButton>
					</Flex>
				</div>

				<div className={styles.dialogBody}>
					<VocalistNamesEditor />
					<table className={styles.metadataTable}>
						<thead>
							<tr>
								<th className={styles.keyColumn}>
									{t("metadataDialog.key", "元数据类型")}
								</th>
								<th>{t("metadataDialog.value", "值")}</th>
							</tr>
						</thead>
						{lyricLines.metadata.length === 0 && (
							<tbody>
								<tr style={{ height: "4em" }}>
									<td
										colSpan={2}
										style={{ color: "var(--gray-9)", textAlign: "center" }}
									>
										{t("metadataDialog.empty", "无任何元数据")}
									</td>
								</tr>
							</tbody>
						)}
						{lyricLines.metadata.map((v, i) => (
							<MetadataEntry
								key={`metadata-${v.key}`}
								entry={v}
								index={i}
								setLyricLines={setLyricLines}
								option={findOptionByKey(v.key)}
								focusAddKeyButton={focusAddKeyButton}
							/>
						))}
					</table>
				</div>
				<Flex
					gap="1"
					direction={{
						sm: "row",
						initial: "column",
					}}
					className={styles.dialogFooter}
				>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							style={{
								flex: "1 0 auto",
							}}
						>
							<Button variant="soft" ref={addKeyButtonRef}>
								{t("metadataDialog.addKeyValue", "添加新键值")}
								<DropdownMenu.TriggerIcon />
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content>
							<Flex gap="1">
								<TextField.Root
									style={{
										flexGrow: "1",
									}}
									placeholder={t("metadataDialog.customKey", "自定义键名")}
									value={customKey}
									onChange={(e) => setCustomKey(e.currentTarget.value)}
								/>
								<IconButton
									variant="soft"
									onClick={() => {
										setLyricLines((prev) => {
											const existsKey = prev.metadata.find(
												(k) => k.key === customKey,
											);
											if (existsKey) {
												existsKey.value.push("");
											} else {
												prev.metadata.push({
													key: customKey,
													value: [""],
												});
											}
										});
									}}
								>
									<Add16Regular />
								</IconButton>
							</Flex>
							{builtinOptions.map((v) => (
								<DropdownMenu.Item
									key={`builtin-option-${v.value}`}
									shortcut={v.value}
									onClick={() => {
										setLyricLines((prev) => {
											const existsKey = prev.metadata.find(
												(k) => k.key === v.value,
											);
											if (existsKey) {
												existsKey.value.push("");
											} else {
												prev.metadata.push({
													key: v.value,
													value: [""],
												});
											}
										});
									}}
								>
									<Flex gap="2" align="center">
										{v.icon}
										{v.label}
									</Flex>
								</DropdownMenu.Item>
							))}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
					<Button
						style={{
							flex: "1 0 auto",
						}}
						variant="soft"
						onClick={() => setSpotMatchDialogOpen(true)}
					>
						<SpotifyIcon />
						{t(
							"metadataDialog.spotmatch.button",
							"SpotMatch (Find Spotify IDs)",
						)}
					</Button>
					<Button
						style={{
							flex: "1 0 auto",
						}}
						variant="soft"
						onClick={() => setGeniusSearchDialogOpen(true)}
					>
						<Search16Regular />
						{t(
							"metadataDialog.fetchSongwriters.button",
							"Fetch Songwriters from Genius",
						)}
					</Button>
					<Button
						style={{
							flex: "1 0 auto",
						}}
						variant="soft"
						onClick={() => {
							setLyricLines((prev) => {
								for (const option of builtinOptions) {
									const existsKey = prev.metadata.find(
										(k) => k.key === option.value,
									);
									if (!existsKey) {
										prev.metadata.push({
											key: option.value,
											value: [""],
										});
									}
								}
							});
						}}
					>
						{t("metadataDialog.addPresets", "一键添加所有预设键")}
					</Button>
					<Button
						style={{ flex: "1 0 auto" }}
						color="red"
						variant="solid"
						onClick={() => {
							setLyricLines((prev) => {
								prev.metadata = [];
							});
						}}
					>
						<Delete16Regular />
						{t("metadataDialog.clear", "清空")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
