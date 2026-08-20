import resources from "virtual:i18next-loader";
import {
	ContentView24Regular,
	History24Regular,
	Keyboard12324Regular,
	LocalLanguage24Regular,
	PaddingLeft24Regular,
	PaddingRight24Regular,
	Save24Regular,
	Sparkle24Regular,
	Speaker224Regular,
	Stack24Regular,
	Timer24Regular,
	TopSpeed24Regular,
	VideoBackgroundEffect24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Card,
	Flex,
	Heading,
	Link,
	Select,
	Slider,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { playbackRateAtom, volumeAtom } from "$/modules/audio/states";
import { DiscordPresenceSettings } from "$/modules/discord-presence/DiscordPresenceSettings";
import {
	autosaveEnabledAtom,
	autosaveIntervalAtom,
	autosaveLimitAtom,
	LayoutMode,
	layoutModeAtom,
	SyncJudgeMode,
	smartFirstWordAtom,
	smartLastWordAtom,
	syncJudgeModeAtom,
	compactBGInSyncAtom,
	normalizeApostrophesOnImportAtom,
	normalizeCyrillicEsOnImportAtom,
	previewFollowsPlaybackAtom,
} from "$/modules/settings/states";
import {
	enableUpcomingWordHighlightAtom,
	syncFghToHoverAtom,
	syncTimeOffsetAtom,
	syncCommitOffsetAtom,
	upcomingWordHighlightColorAtom,
	upcomingWordHighlightThresholdAtom,
} from "$/modules/settings/states/sync";
import {
	KeyBindingTriggerMode,
	keyBindingTriggerModeAtom,
} from "$/utils/keybindings";

export type CommonSettingsSection = "general" | "editor" | "files" | "audio";

export const SettingsCommonTab = ({
	section = "general",
}: {
	section?: CommonSettingsSection;
}) => {
	const languageOptions: readonly string[] = Object.keys(resources);
	const [layoutMode, setLayoutMode] = useAtom(layoutModeAtom);
	const [syncJudgeMode, setSyncJudgeMode] = useAtom(syncJudgeModeAtom);
	const [keyBindingTriggerMode, setKeyBindingTriggerMode] = useAtom(
		keyBindingTriggerModeAtom,
	);
	const [smartFirstWord, setSmartFirstWord] = useAtom(smartFirstWordAtom);
	const [smartLastWord, setSmartLastWord] = useAtom(smartLastWordAtom);
	const [volume, setVolume] = useAtom(volumeAtom);
	const [playbackRate, setPlaybackRate] = useAtom(playbackRateAtom);
	const [autosaveEnabled, setAutosaveEnabled] = useAtom(autosaveEnabledAtom);
	const [autosaveInterval, setAutosaveInterval] = useAtom(autosaveIntervalAtom);
	const [autosaveLimit, setAutosaveLimit] = useAtom(autosaveLimitAtom);
	const [enableUpcomingWordHighlight, setEnableUpcomingWordHighlight] = useAtom(
		enableUpcomingWordHighlightAtom,
	);
	const [upcomingWordHighlightThreshold, setUpcomingWordHighlightThreshold] =
		useAtom(upcomingWordHighlightThresholdAtom);
	const [upcomingWordHighlightColor, setUpcomingWordHighlightColor] = useAtom(
		upcomingWordHighlightColorAtom,
	);
	const [syncTimeOffset, setSyncTimeOffset] = useAtom(syncTimeOffsetAtom);
	const [syncCommitOffset, setSyncCommitOffset] = useAtom(syncCommitOffsetAtom);
	const [syncFghToHover, setSyncFghToHover] = useAtom(syncFghToHoverAtom);

const [compactBGInSync, setCompactBGInSync] = useAtom(compactBGInSyncAtom);
const [normalizeApostrophesOnImport, setNormalizeApostrophesOnImport] =
	useAtom(normalizeApostrophesOnImportAtom);
const [normalizeCyrillicEsOnImport, setNormalizeCyrillicEsOnImport] =
	useAtom(normalizeCyrillicEsOnImportAtom);
const [previewFollowsPlayback, setPreviewFollowsPlayback] = useAtom(
	previewFollowsPlaybackAtom,
);

const { t, i18n } = useTranslation();
	const currentLanguage = i18n.resolvedLanguage || i18n.language;

	const getLanguageName = (code: string) => {
		if (code === "lolcat") return "Lolcat";
		try {
			interface DisplayNamesLike {
				new (
					locales: string | string[],
					options: { type: string },
				): {
					of: (code: string) => string | undefined;
				};
			}
			const DN: DisplayNamesLike | undefined = (
				Intl as unknown as {
					DisplayNames?: DisplayNamesLike;
				}
			).DisplayNames;
			if (DN) {
				const nativeDn = new DN([code], { type: "language" });
				const nativeName = nativeDn.of(code) || code;
				// Capitalize first letter (e.g., français -> Français)
				return nativeName.charAt(0).toUpperCase() + nativeName.slice(1);
			}
		} catch {
			// ignore errors and fallback
		}
		return code;
	};



	const getTranslationProgress = (code: string) => {
		const source = (resources as any)["en-US"]?.translation;
		const target = (resources as any)[code]?.translation;
		if (!source || !target || code === "en-US") return null;

		const countKeys = (obj: any): number => {
			let count = 0;
			for (const key in obj) {
				if (typeof obj[key] === "object") {
					count += countKeys(obj[key]);
				} else {
					count++;
				}
			}
			return count;
		};

		const countTranslatedKeys = (s: any, t: any): number => {
			let count = 0;
			for (const key in s) {
				if (t[key] !== undefined) {
					if (typeof s[key] === "object") {
						count += countTranslatedKeys(s[key], t[key]);
					} else if (t[key] !== s[key] && t[key] !== "") {
						// Only count as translated if it's different from English and not empty
						count++;
					}
				}
			}
			return count;
		};

		const total = countKeys(source);
		const translated = countTranslatedKeys(source, target);
		return Math.floor((translated / total) * 100);
	};

	return (
		<Flex direction="column" gap="4">
			{section === "general" && (
			<Flex direction="column" gap="2">
				<Heading size="4">{t("settings.group.display", "Display")}</Heading>

				<Card>
					<Flex gap="3" align="center">
						<LocalLanguage24Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>{t("settings.common.language", "Interface Language")}</Text>
									<Text size="1" color="gray">
										{t("settings.common.languageDesc", "Select the language for the interface")}
									</Text>
								</Flex>

								<Flex direction="column" gap="2" align="end">
									<Select.Root
										value={currentLanguage}
										onValueChange={(lng) => {
											i18n.changeLanguage(lng).then(() => {
												localStorage.setItem("language", lng);
											});
										}}
									>
										<Select.Trigger /><Select.Content>
											{languageOptions.map((code) => {
												const progress = getTranslationProgress(code);
												return (
													<Select.Item key={code} value={code}>
														<Flex justify="between" gap="4" align="center" style={{ width: "100%" }}>
															<Text>{getLanguageName(code)}</Text>
															{code === "en-US" ? (
																<Text size="1" color="gray">
																	(Source)
																</Text>
															) : (
																progress !== null && (
																	<Text size="1" color={progress === 100 ? "green" : "gray"}>
																		{progress}%
																	</Text>
																)
															)}
														</Flex>
													</Select.Item>
												);
											})}
										</Select.Content>
									</Select.Root>
									<Link
										size="1"
										href="https://crowdin.com/project/very-cool-ttml-tool"
										target="_blank"
									>
										{t("settings.common.helpTranslate", "Help translate this app")}
									</Link>
								</Flex>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<ContentView24Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>{t("settings.common.layoutMode", "Editor Layout Mode")}</Text>
									<Text size="1" color="gray">
										{t(
											"settings.common.layoutModeDesc.line1",
											"Simple layout meets the basic needs of most users",
										)}
										<br />
										{t(
											"settings.common.layoutModeDesc.line2",
											"If you require higher syncing efficiency, consider switching to advanced mode",
										)}
									</Text>
								</Flex>

								<Select.Root
									value={layoutMode}
									onValueChange={(v) => setLayoutMode(v as LayoutMode)}
								>
									<Select.Trigger /><Select.Content>
										<Select.Item value={LayoutMode.Simple}>
											{t(
												"settings.common.layoutModeOptions.simple",
												"Simple Mode",
											)}
										</Select.Item>
										<Select.Item value={LayoutMode.Advance}>
											{t(
												"settings.common.layoutModeOptions.advance",
												"Advanced Mode",
											)}
										</Select.Item>
									</Select.Content>
								</Select.Root>
							</Flex>
						</Box>
					</Flex>
				</Card>
				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<VideoBackgroundEffect24Regular />
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Flex direction="column" gap="1">
										<Text>
											{t("settings.common.compactBGInSync", "Compact Background Vocals (Sync Mode)")}
										</Text>
										<Text size="1" color="gray">
											{t(
												"settings.common.compactBGInSyncDesc",
												"Automatically compress vertical space for background vocal lines during synchronization.",
											)}
										</Text>
									</Flex>
									<Switch
										checked={compactBGInSync}
										onCheckedChange={setCompactBGInSync}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<VideoBackgroundEffect24Regular />
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Flex direction="column" gap="1">
										<Text>
											{t("settings.common.previewFollowsPlayback", "Preview follows playback")}
										</Text>
										<Text size="1" color="gray">
											{t(
												"settings.common.previewFollowsPlaybackDesc",
												"When enabled, the preview panel follows audio playback only. When disabled, it also follows seek actions in Time/Edit modes.",
											)}
										</Text>
									</Flex>
									<Switch
										checked={previewFollowsPlayback}
										onCheckedChange={setPreviewFollowsPlayback}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>
			</Flex>
			)}

			{section === "editor" && (
			<Flex direction="column" gap="3">
				<Heading size="4">{t("settings.group.timing", "Syncing")}</Heading>

				<Card>
					<Flex gap="3" align="center">
						<Timer24Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>
										{t("settings.common.syncJudgeMode", "Sync Timestamp Judgment Mode")}
									</Text>
									<Text size="1" color="gray">
										{t(
											"settings.common.syncJudgeModeDesc",
											'Set the sync timestamp judgment mode, default is "First Key Down Time".',
										)}
									</Text>
								</Flex>

								<Select.Root
									value={syncJudgeMode}
									onValueChange={(v) => setSyncJudgeMode(v as SyncJudgeMode)}
								>
									<Select.Trigger /><Select.Content>
										<Select.Item value={SyncJudgeMode.FirstKeyDownTime}>
											{t(
												"settings.common.syncJudgeModeOptions.firstKeyDown",
												"First Key Down Time",
											)}
										</Select.Item>
										<Select.Item value={SyncJudgeMode.LastKeyUpTime}>
											{t(
												"settings.common.syncJudgeModeOptions.lastKeyUp",
												"Last Key Up Time",
											)}
										</Select.Item>
										<Select.Item value={SyncJudgeMode.MiddleKeyTime}>
											{t(
												"settings.common.syncJudgeModeOptions.middleKey",
												"Average of Key Down and Key Up Time",
											)}
										</Select.Item>
										<Select.Item value={SyncJudgeMode.FirstKeyDownTimeLegacy}>
											{t(
												"settings.common.syncJudgeModeOptions.firstKeyDownLegacy",
												"First Key Down Time (Legacy)",
											)}
										</Select.Item>
									</Select.Content>
								</Select.Root>
							</Flex>
						</Box>
					</Flex>
				</Card>

			<Card>
				<Flex gap="3" align="center">
					<PaddingLeft24Regular />
					<Box flexGrow="1">
						<Flex align="center" justify="between" gap="4">
							<Flex direction="column" gap="1">
								<Text>
									{t("settings.common.syncFghToHover", "Sync F/G/H to Spectrogram Hover")}
								</Text>
								<Text size="1" color="gray">
									{t(
										"settings.common.syncFghToHoverDesc",
										"When hovering over the spectrogram, F/G/H will use the hover time instead of the audio playhead.",
									)}
								</Text>
							</Flex>

							<Switch
								checked={syncFghToHover}
								onCheckedChange={setSyncFghToHover}
							/>
						</Flex>
					</Box>
				</Flex>
			</Card>

			<Card>
				<Flex gap="3" align="center">
					<Keyboard12324Regular />
					<Box flexGrow="1">
						<Flex align="center" justify="between" gap="4">
							<Flex direction="column" gap="1">
								<Text>
									{t("settings.common.keyBindingTrigger", "Keybinding Trigger Timing")}
								</Text>
									<Text size="1" color="gray">
										{t(
											"settings.common.keyBindingTriggerDesc",
											"Whether keybindings are triggered on key down or key up",
										)}
									</Text>
								</Flex>

								<Select.Root
									value={keyBindingTriggerMode}
									onValueChange={(v) =>
										setKeyBindingTriggerMode(v as KeyBindingTriggerMode)
									}
								>
									<Select.Trigger /><Select.Content>
										<Select.Item value={KeyBindingTriggerMode.KeyDown}>
											{t(
												"settings.common.keyBindingTriggerOptions.keyDown",
												"Trigger on Key Down",
											)}
										</Select.Item>
										<Select.Item value={KeyBindingTriggerMode.KeyUp}>
											{t(
												"settings.common.keyBindingTriggerOptions.keyUp",
												"Trigger on Key Up",
											)}
										</Select.Item>
									</Select.Content>
								</Select.Root>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<Timer24Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>
										{t("settings.common.syncTimeOffset", "Global Sync Time Offset (ms)")}
									</Text>
									<Text size="1" color="gray">
										{t(
											"settings.common.syncTimeOffsetDesc",
											"Adjust all sync timestamps by this amount to compensate for audio latency.",
										)}
									</Text>
								</Flex>
								<TextField.Root
									type="number"
									value={syncTimeOffset}
									onChange={(e) =>
										setSyncTimeOffset(Number.parseInt(e.target.value, 10) || 0)
									}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<Timer24Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>
										{t("settings.common.syncCommitOffset", "Commit Input Offset (ms)")}
									</Text>
									<Text size="1" color="gray">
										{t(
											"settings.common.syncCommitOffsetDesc",
											"Specific offset for the 'Commit' action to fix delayed audio issues.",
										)}
									</Text>
								</Flex>
								<TextField.Root
									type="number"
									value={syncCommitOffset}
									onChange={(e) =>
										setSyncCommitOffset(Number.parseInt(e.target.value, 10) || 0)
									}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<PaddingLeft24Regular />
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Flex direction="column" gap="1">
										<Text>
											{t("settings.common.smartFirstWord", "Smart First Word")}
										</Text>
										<Text size="1" color="gray">
											{t(
												"settings.common.smartFirstWordDesc",
												"When syncing the first syllable of a line, pressing the Start trigger records its start time but not its end time.",
											)}
										</Text>
									</Flex>
									<Switch
										checked={smartFirstWord}
										onCheckedChange={setSmartFirstWord}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<PaddingRight24Regular />
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Flex direction="column" gap="1">
										<Text>
											{t("settings.common.smartLastWord", "Smart Last Word")}
										</Text>
										<Text size="1" color="gray">
											{t(
												"settings.common.smartLastWordDesc",
												"When syncing the last syllable of a line, pressing the End trigger records its end time without starting the next syllable.",
											)}
										</Text>
									</Flex>
									<Switch
										checked={smartLastWord}
										onCheckedChange={setSmartLastWord}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>
			</Flex>
			)}

			{section === "editor" && (
			<Flex direction="column" gap="3">
				<Heading size="4">
					{t("settings.group.timingHighlight", "Visual Timing Cue (Sync)")}
				</Heading>
				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<Timer24Regular />
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Flex direction="column" gap="1">
										<Text>
											{t(
												"settings.common.enableUpcomingWordHighlight",
												"Enable Upcoming Word Pre-Highlight",
											)}
										</Text>
										<Text size="1" color="gray">
											{t(
												"settings.common.enableUpcomingWordHighlightDesc",
												"Fades in a highlight color shortly before a word plays during Sync mode to improve precision.",
											)}
										</Text>
									</Flex>
									<Switch
										checked={enableUpcomingWordHighlight}
										onCheckedChange={setEnableUpcomingWordHighlight}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>
				<Card>
					<Flex gap="3" align="center">
						<Timer24Regular />
						<Box flexGrow="1">
							<Flex direction="column" gap="2" align="start">
								<Text>
									{t(
										"settings.common.upcomingWordHighlightThreshold",
										"Pre-Highlight Time Threshold (ms)",
									)}
								</Text>
								<TextField.Root
									type="number"
									disabled={!enableUpcomingWordHighlight}
									value={upcomingWordHighlightThreshold}
									onChange={(e) =>
										setUpcomingWordHighlightThreshold(
											Math.max(0, Number.parseInt(e.target.value, 10) || 0),
										)
									}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>
				<Card>
					<Flex gap="3" align="center">
						<ContentView24Regular />
						<Box flexGrow="1">
							<Flex direction="column" gap="2" align="start">
								<Text>
									{t(
										"settings.common.upcomingWordHighlightColor",
										"Highlight Color (CSS Value)",
									)}
								</Text>
								<TextField.Root
									disabled={!enableUpcomingWordHighlight}
									value={upcomingWordHighlightColor}
									onChange={(e) =>
										setUpcomingWordHighlightColor(e.target.value)
									}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>
				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<Keyboard12324Regular />
							<Box flexGrow="1">
								<Flex direction="column" gap="1">
									<Flex align="center" justify="between" gap="4">
										<Text weight="medium">
											{t("settings.editor.hoverSync", "Sync F/G/H to Spectrogram Hover")}
										</Text>
										<Switch
											checked={syncFghToHover}
											onCheckedChange={setSyncFghToHover}
										/>
									</Flex>
									<Text size="1" color="gray">
										{t("settings.editor.hoverSyncDesc", "Use F/G/H shortcuts to directly sync words to current spectrogram hover position.")}
									</Text>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>
			</Flex>
			)}

			{section === "general" && import.meta.env.TAURI_ENV_PLATFORM && (
				<Flex direction="column" gap="2">
					<Heading size="4">
						{t("settings.group.privacy", "Privacy")}
					</Heading>
					<DiscordPresenceSettings />
				</Flex>
			)}

			{section === "files" && (
			<Flex direction="column" gap="2">
				<Heading size="4">{t("settings.group.import", "Import & export")}</Heading>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<ContentView24Regular />
							<Box flexGrow="1">
								<Flex direction="column" gap="1">
									<Flex align="center" justify="between" gap="4">
										<Text>
											{t(
												"settings.common.normalizeApostrophesOnImport",
												"Normalize apostrophes",
											)}
										</Text>
										<Switch
											checked={normalizeApostrophesOnImport}
											onCheckedChange={setNormalizeApostrophesOnImport}
										/>
									</Flex>
									<Text size="1" color="gray">
										{t(
											"settings.common.normalizeApostrophesOnImportDesc",
											"Convert curly and other apostrophe-like characters during import and export.",
										)}
									</Text>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<ContentView24Regular />
							<Box flexGrow="1">
								<Flex direction="column" gap="1">
									<Flex align="center" justify="between" gap="4">
										<Text>
											{t(
												"settings.common.normalizeCyrillicEsOnImport",
												"Fix isolated Cyrillic Е/е in Latin words",
											)}
										</Text>
										<Switch
											checked={normalizeCyrillicEsOnImport}
											onCheckedChange={setNormalizeCyrillicEsOnImport}
										/>
									</Flex>
									<Text size="1" color="gray">
										{t(
											"settings.common.normalizeCyrillicEsOnImportDesc",
											"Correct hidden Cyrillic lookalikes in Latin words during import and export.",
										)}
									</Text>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>
			</Flex>
			)}

			{section === "audio" && (
			<Flex direction="column" gap="2">
				<Heading size="4">{t("settings.group.playback", "Playback")}</Heading>

				<Card>
					<Flex gap="3" align="center">
						<Speaker224Regular />
						<Box flexGrow="1">
							<Flex direction="column" gap="2" align="start">
								<Flex
									align="center"
									justify="between"
									style={{ alignSelf: "stretch" }}
								>
									<Text>{t("settings.common.volume", "Music Volume")}</Text>
									<Text wrap="nowrap" color="gray" size="1">
										{(volume * 100).toFixed()}%
									</Text>
								</Flex>
								<Slider
									min={0}
									max={1}
									defaultValue={[volume]}
									step={0.01}
									onValueChange={(v) => setVolume(v[0])}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<TopSpeed24Regular />
						<Box flexGrow="1">
							<Flex direction="column" gap="2" align="start">
								<Flex
									align="center"
									justify="between"
									style={{ alignSelf: "stretch" }}
								>
									<Text>{t("settings.common.playbackRate", "Playback Speed")}</Text>
									<Text wrap="nowrap" color="gray" size="1">
										{playbackRate.toFixed(2)}x
									</Text>
								</Flex>
								<Slider
									min={0.1}
									max={2}
									defaultValue={[playbackRate]}
									step={0.05}
									onValueChange={(v) => setPlaybackRate(v[0])}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>
			</Flex>
			)}

			{section === "files" && (
			<Flex direction="column" gap="2">
				<Heading size="4">{t("settings.group.autosave", "Auto Save")}</Heading>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<Save24Regular />
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Text>
										{t("settings.common.autosave.enable", "Enable Auto Save")}
									</Text>
									<Switch
										checked={autosaveEnabled}
										onCheckedChange={setAutosaveEnabled}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<History24Regular />
							<Box flexGrow="1">
								<Flex direction="column" gap="2" align="start">
									<Text>
										{t("settings.common.autosave.interval", "Save Interval (minutes)")}
									</Text>
									<TextField.Root
										type="number"
										disabled={!autosaveEnabled}
										value={autosaveInterval}
										onChange={(e) =>
											setAutosaveInterval(
												Math.max(1, Number.parseInt(e.target.value, 10) || 1),
											)
										}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<Stack24Regular />
						<Box flexGrow="1">
							<Flex direction="column" gap="2" align="start">
								<Flex
									align="center"
									justify="between"
									style={{ alignSelf: "stretch" }}
								>
									<Text>
										{t("settings.common.autosave.limit", "Snapshots to keep")}
									</Text>
									<Text wrap="nowrap" color="gray" size="1">
										{autosaveLimit}
									</Text>
								</Flex>
								<Slider
									min={1}
									max={50}
									disabled={!autosaveEnabled}
									value={[autosaveLimit]}
									step={1}
									onValueChange={(v) => setAutosaveLimit(v[0])}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>
			</Flex>
			)}
		</Flex>
	);
};
