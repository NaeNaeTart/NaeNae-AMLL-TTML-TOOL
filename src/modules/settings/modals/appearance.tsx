import {
	ContentView24Regular,
	History24Regular,
	Keyboard12324Regular,
	LocalLanguage24Regular,
	PaddingLeft24Regular,
	PaddingRight24Regular,
	Save24Regular,
	Speaker224Regular,
	Stack24Regular,
	Timer24Regular,
	TopSpeed24Regular,
	VideoBackgroundEffect24Regular,
	Sparkle24Regular,
	TimeAndWeather24Regular,
	ErrorCircle24Regular,
	TextT24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Flex,
	Grid,
	Heading,
	IconButton,
	Popover,
	RadioGroup,
	SegmentedControl,
	Slider,
	Switch,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Reorder } from "framer-motion";
import { backgroundGradients } from "$/modules/settings/states/gradients";
import {
	accentColorAtom,
	appFontAtom,
	backgroundModeAtom,
	customAccentColorAtom,
	customGradientAngleAtom,
	customGradientCenterAtom,
	customGradientColorsAtom,
	customGradientOpacityAtom,
	customGradientSizeAtom,
	customGradientTypeAtom,
	selectedGradientAtom,
	useCustomAccentAtom,
	useCustomGradientAtom,
	glassmorphismBlurAtom,
	AppearanceEditorMode,
	appearanceEditorModeAtom,
	advancedWaveformColorAtom,
	advancedWaveformProgressColorAtom,
	advancedPrimaryTextColorAtom,
	advancedSecondaryTextColorAtom,
	advTitlebarBgAtom,
	advSidebarBgAtom,
	advSidebarActiveAtom,
	advMenuHoverBgAtom,
	advEditorBgAtom,
	advActiveLineBgAtom,
	advLineHoverBgAtom,
	advChipBorderRadiusAtom,
	advChipGapAtom,
	advChipPaddingVerticalAtom,
	advChipPaddingHorizontalAtom,
	advRomanizationColorAtom,
	advTranslationColorAtom,
	advGeniusHeaderColorAtom,
	advAudioBarBgAtom,
	advAudioBarTextAtom,
	advScrollbarColorAtom,
	advDialogBgAtom,
	advDialogBorderAtom,
	advGlobalBorderRadiusAtom,
	advGlobalBorderWidthAtom,
	advShadowIntensityAtom,
	advSelectionColorAtom,
	advBackdropBlurAtom,
	appearancePresetsAtom,
	type AppearancePreset,
	appLayoutOrderAtom,
	vRibbonPositionAtom,
} from "$/modules/settings/states/index.ts";
import { fontSelectionDialogAtom } from "$/states/dialogs.ts";
import { isDarkThemeAtom } from "$/states/main.ts";
import { generateGradient, generateRadixScale } from "$/utils/colorScale";
import {
	SettingsCustomBackgroundCard,
	SettingsCustomBackgroundSettings,
} from "./customBackground";

const accentColors = [
	"gray",
	"gold",
	"bronze",
	"brown",
	"yellow",
	"amber",
	"orange",
	"tomato",
	"red",
	"ruby",
	"crimson",
	"pink",
	"plum",
	"purple",
	"violet",
	"iris",
	"indigo",
	"blue",
	"cyan",
	"teal",
	"jade",
	"green",
	"grass",
	"lime",
	"mint",
	"sky",
] as const;

export const SettingsAppearanceTab = () => {
	const [accentColor, setAccentColor] = useAtom(accentColorAtom);
	const [useCustomAccent, setUseCustomAccent] = useAtom(useCustomAccentAtom);
	const [customAccentColor, setCustomAccentColor] = useAtom(
		customAccentColorAtom,
	);
	const isDarkTheme = useAtomValue(isDarkThemeAtom);
	const customScale = useMemo(
		() =>
			generateRadixScale(
				customAccentColor,
				isDarkTheme,
			),
		[
			customAccentColor,
			isDarkTheme,
		],
	);

	const [backgroundMode, setBackgroundMode] = useAtom(backgroundModeAtom);
	const [selectedGradient, setSelectedGradient] = useAtom(selectedGradientAtom);
	const [useCustomGradient, setUseCustomGradient] = useAtom(
		useCustomGradientAtom,
	);
	const [customGradientColors, setCustomGradientColors] = useAtom(
		customGradientColorsAtom,
	);
	const [customGradientType, setCustomGradientType] = useAtom(
		customGradientTypeAtom,
	);
	const [customGradientOpacity, setCustomGradientOpacity] = useAtom(
		customGradientOpacityAtom,
	);
	const [customGradientCenter, setCustomGradientCenter] = useAtom(
		customGradientCenterAtom,
	);
	const [customGradientAngle, setCustomGradientAngle] = useAtom(
		customGradientAngleAtom,
	);
	const [customGradientSize, setCustomGradientSize] = useAtom(
		customGradientSizeAtom,
	);
	const [editorMode, setEditorMode] = useAtom(appearanceEditorModeAtom);
	const [advWaveformColor, setAdvWaveformColor] = useAtom(advancedWaveformColorAtom);
	const [advWaveformProgress, setAdvWaveformProgress] = useAtom(advancedWaveformProgressColorAtom);
	const [advPrimaryText, setAdvPrimaryText] = useAtom(advancedPrimaryTextColorAtom);
	const [advSecondaryText, setAdvSecondaryText] = useAtom(advancedSecondaryTextColorAtom);
	
	const [vTitlebarBg, setVTitlebarBg] = useAtom(advTitlebarBgAtom);
	const [vSidebarBg, setVSidebarBg] = useAtom(advSidebarBgAtom);
	const [vSidebarActive, setVSidebarActive] = useAtom(advSidebarActiveAtom);
	const [vMenuHover, setVMenuHover] = useAtom(advMenuHoverBgAtom);
	const [vEditorBg, setVEditorBg] = useAtom(advEditorBgAtom);
	const [vActiveLine, setVActiveLine] = useAtom(advActiveLineBgAtom);
	const [vLineHover, setVLineHover] = useAtom(advLineHoverBgAtom);
	const [vChipRadius, setVChipRadius] = useAtom(advChipBorderRadiusAtom);
	const [vChipGap, setVChipGap] = useAtom(advChipGapAtom);
	const [vChipPaddingV, setVChipPaddingV] = useAtom(advChipPaddingVerticalAtom);
	const [vChipPaddingH, setVChipPaddingH] = useAtom(advChipPaddingHorizontalAtom);
	const [vRomanColor, setVRomanColor] = useAtom(advRomanizationColorAtom);
	const [vTransColor, setVTransColor] = useAtom(advTranslationColorAtom);
	const [vGeniusHeaderColor, setVGeniusHeaderColor] = useAtom(advGeniusHeaderColorAtom);
	const [vAudioBarBg, setVAudioBarBg] = useAtom(advAudioBarBgAtom);
	const [vAudioBarText, setVAudioBarText] = useAtom(advAudioBarTextAtom);
	const [vScrollbar, setVScrollbar] = useAtom(advScrollbarColorAtom);
	const [vDialogBg, setVDialogBg] = useAtom(advDialogBgAtom);
	const [vDialogBorder, setVDialogBorder] = useAtom(advDialogBorderAtom);
	const [vGlobalRadius, setVGlobalRadius] = useAtom(advGlobalBorderRadiusAtom);
	const [vGlobalBorderWidth, setVGlobalBorderWidth] = useAtom(advGlobalBorderWidthAtom);
	const [vShadow, setVShadow] = useAtom(advShadowIntensityAtom);
	const [vSelection, setVSelection] = useAtom(advSelectionColorAtom);
	const [vBackdrop, setVBackdrop] = useAtom(advBackdropBlurAtom);
	const [presets, setPresets] = useAtom(appearancePresetsAtom);
	const [layoutOrder, setLayoutOrder] = useAtom(appLayoutOrderAtom);
	const [vRibbonPos, setVRibbonPos] = useAtom(vRibbonPositionAtom);
	const [newPresetName, setNewPresetName] = useState("");

	const appFont = useAtomValue(appFontAtom);
	const [glassBlur, setGlassBlur] = useAtom(glassmorphismBlurAtom);

	const [lastLoaded, setLastLoaded] = useState<string | null>(null);

	const handleSavePreset = () => {
		if (!newPresetName.trim()) return;
		const newPreset: AppearancePreset = {
			id: Date.now().toString(),
			name: newPresetName,
			settings: {
				// Basic & General
				accentColor, useCustomAccent, customAccentColor, glassBlur,
				// Backgrounds
				backgroundMode, selectedGradient, useCustomGradient, customGradientColors,
				customGradientType, customGradientOpacity, customGradientCenter,
				customGradientAngle, customGradientSize,
				// Advanced
				advWaveformColor, advWaveformProgress, advPrimaryText, advSecondaryText,
				vTitlebarBg, vSidebarBg, vSidebarActive, vMenuHover, vEditorBg, vActiveLine, vLineHover, vSelection,
				vChipRadius, vChipGap, vChipPaddingV, vChipPaddingH, vRomanColor, vTransColor, vGeniusHeaderColor,
				vAudioBarBg, vAudioBarText, vScrollbar, vDialogBg, vDialogBorder,
				vGlobalRadius, vGlobalBorderWidth, vShadow, vBackdrop,
				layoutOrder, vRibbonPos
			}
		};
		setPresets([...presets, newPreset]);
		setNewPresetName("");
	};

	const handleLoadPreset = (p: AppearancePreset) => {
		const s = p.settings;
		
		// Set a small loading indicator state
		setLastLoaded(p.name);

		// Basic & General
		if (s.accentColor !== undefined) setAccentColor(s.accentColor);
		if (s.useCustomAccent !== undefined) setUseCustomAccent(!!s.useCustomAccent);
		if (s.customAccentColor !== undefined) setCustomAccentColor(s.customAccentColor);
		if (s.glassBlur !== undefined) setGlassBlur(Number(s.glassBlur));

		// Backgrounds
		if (s.backgroundMode !== undefined) setBackgroundMode(s.backgroundMode);
		if (s.selectedGradient !== undefined) setSelectedGradient(s.selectedGradient);
		if (s.useCustomGradient !== undefined) setUseCustomGradient(!!s.useCustomGradient);
		if (s.customGradientColors !== undefined) setCustomGradientColors(s.customGradientColors);
		if (s.customGradientType !== undefined) setCustomGradientType(s.customGradientType);
		if (s.customGradientOpacity !== undefined) setCustomGradientOpacity(Number(s.customGradientOpacity));
		if (s.customGradientCenter !== undefined) setCustomGradientCenter(s.customGradientCenter);
		if (s.customGradientAngle !== undefined) setCustomGradientAngle(Number(s.customGradientAngle));
		if (s.customGradientSize !== undefined) setCustomGradientSize(Number(s.customGradientSize));

		// Advanced
		if (s.advWaveformColor !== undefined) setAdvWaveformColor(s.advWaveformColor);
		if (s.advWaveformProgress !== undefined) setAdvWaveformProgress(s.advWaveformProgress);
		if (s.advPrimaryText !== undefined) setAdvPrimaryText(s.advPrimaryText);
		if (s.advSecondaryText !== undefined) setAdvSecondaryText(s.advSecondaryText);
		if (s.vTitlebarBg !== undefined) setVTitlebarBg(s.vTitlebarBg);
		if (s.vSidebarBg !== undefined) setVSidebarBg(s.vSidebarBg);
		if (s.vSidebarActive !== undefined) setVSidebarActive(s.vSidebarActive);
		if (s.vMenuHover !== undefined) setVMenuHover(s.vMenuHover);
		if (s.vEditorBg !== undefined) setVEditorBg(s.vEditorBg);
		if (s.vActiveLine !== undefined) setVActiveLine(s.vActiveLine);
		if (s.vLineHover !== undefined) setVLineHover(s.vLineHover);
		if (s.vSelection !== undefined) setVSelection(s.vSelection);
		if (s.vChipRadius !== undefined) setVChipRadius(Number(s.vChipRadius));
		if (s.vChipGap !== undefined) setVChipGap(Number(s.vChipGap));
		if (s.vChipPaddingV !== undefined) setVChipPaddingV(Number(s.vChipPaddingV));
		if (s.vChipPaddingH !== undefined) setVChipPaddingH(Number(s.vChipPaddingH));
		if (s.vRomanColor !== undefined) setVRomanColor(s.vRomanColor);
		if (s.vTransColor !== undefined) setVTransColor(s.vTransColor);
		if (s.vGeniusHeaderColor !== undefined) setVGeniusHeaderColor(s.vGeniusHeaderColor);
		if (s.vAudioBarBg !== undefined) setVAudioBarBg(s.vAudioBarBg);
		if (s.vAudioBarText !== undefined) setVAudioBarText(s.vAudioBarText);
		if (s.vScrollbar !== undefined) setVScrollbar(s.vScrollbar);
		if (s.vDialogBg !== undefined) setVDialogBg(s.vDialogBg);
		if (s.vDialogBorder !== undefined) setVDialogBorder(s.vDialogBorder);
		if (s.vGlobalRadius !== undefined) setVGlobalRadius(Number(s.vGlobalRadius));
		if (s.vGlobalBorderWidth !== undefined) setVGlobalBorderWidth(Number(s.vGlobalBorderWidth));
		if (s.vShadow !== undefined) setVShadow(Number(s.vShadow));
		if (s.vBackdrop !== undefined) setVBackdrop(Number(s.vBackdrop));
		if (s.layoutOrder !== undefined) setLayoutOrder(s.layoutOrder);
		if (s.vRibbonPos !== undefined) setVRibbonPos(s.vRibbonPos);

		// Small timeout to clear the flash of "active" state if desired, 
		// but keeping it visible helps user know it worked.
	};
	const setIsFontSelectionOpen = useSetAtom(fontSelectionDialogAtom);

	const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
	const { t } = useTranslation();

	if (showBackgroundSettings) {
		return (
			<SettingsCustomBackgroundSettings
				onClose={() => setShowBackgroundSettings(false)}
			/>
		);
	}

	return (
		<Flex direction="column" gap="4">
			<Flex direction="column" gap="2">
				<SegmentedControl.Root
					value={editorMode}
					onValueChange={(v) => setEditorMode(v as AppearanceEditorMode)}
				>
					<SegmentedControl.Item value={AppearanceEditorMode.Basic}>
						{t("settings.appearance.mode.basic", "Basic Editor")}
					</SegmentedControl.Item>
					<SegmentedControl.Item value={AppearanceEditorMode.Advanced}>
						{t("settings.appearance.mode.advanced", "Advanced Editor")}
					</SegmentedControl.Item>
				</SegmentedControl.Root>
			</Flex>

			<Flex direction="column" gap="3">
				<Heading size="4"><Save24Regular /> {t("settings.appearance.presets.title", "Appearance Presets")}</Heading>
				<Card>
					<Flex direction="column" gap="3">
						<Flex gap="3" align="center">
							<TextField.Root 
								placeholder={t("settings.appearance.presets.namePlaceholder", "Theme Name...")}
								value={newPresetName}
								onChange={(e) => setNewPresetName(e.target.value)}
								style={{ flexGrow: 1 }}
							>
								<TextField.Slot><Save24Regular /></TextField.Slot>
							</TextField.Root>
							<Button onClick={handleSavePreset} disabled={!newPresetName.trim()}>
								{t("settings.appearance.presets.save", "Save Current")}
							</Button>
						</Flex>

						{presets.length > 0 ? (
							<Grid columns="2" gap="2">
								{presets.map((p) => (
									<Card key={p.id} size="1" style={{ 
										border: lastLoaded === p.name ? "1px solid var(--accent-9)" : undefined,
										backgroundColor: lastLoaded === p.name ? "var(--accent-2)" : undefined
									}}>
										<Flex align="center" justify="between">
											<Box flexGrow="1" overflow="hidden">
												<Text size="2" weight="bold" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</Text>
												{lastLoaded === p.name && <Text size="1" color="accent" style={{ display: "block" }}>Active</Text>}
											</Box>
											<Flex gap="1">
												<IconButton size="1" variant="soft" onClick={() => handleLoadPreset(p)} title="Load Preset">
													<Timer24Regular />
												</IconButton>
												<IconButton size="1" variant="ghost" color="red" onClick={() => setPresets(presets.filter(pr => pr.id !== p.id))} title="Delete Preset">
													<History24Regular />
												</IconButton>
											</Flex>
										</Flex>
									</Card>
								))}
							</Grid>
						) : (
							<Text size="2" color="gray" align="center">{t("settings.appearance.presets.empty", "No saved presets yet.")}</Text>
						)}
					</Flex>
				</Card>
			</Flex>

			{editorMode === AppearanceEditorMode.Basic ? (
				<>
					<Flex direction="column" gap="2">
				<Heading size="4">{t("settings.appearance.theme", "Theme")}</Heading>

				<Card>
					<Flex direction="column" gap="4">
						<Flex gap="3" align="start">
							<Sparkle24Regular />
							<Box flexGrow="1">
								<Flex direction="column" gap="3">
									<Flex align="center" justify="between">
										<Flex direction="column" gap="1">
											<Text>
												{t(
													"settings.appearance.useCustomAccent",
													"Custom Accent Color",
												)}
											</Text>
											<Text size="1" color="gray">
												{t(
													"settings.appearance.useCustomAccentDesc",
													"Set Accent color",
												)}
											</Text>
										</Flex>
										<Switch
											checked={useCustomAccent}
											onCheckedChange={setUseCustomAccent}
										/>
									</Flex>

									{useCustomAccent ? (
										<Flex direction="column" gap="3">
											<Flex align="center" gap="3">
												<input
													type="color"
													value={customAccentColor}
													onChange={(e) => {
														const newColor = e.target.value;
														setCustomAccentColor(newColor);
													}}
													style={{
														width: "40px",
														height: "40px",
														padding: 0,
														border: "none",
														borderRadius: "var(--radius-3)",
														cursor: "pointer",
														backgroundColor: "transparent",
													}}
												/>
												<Text size="2" weight="bold">
													{customAccentColor.toUpperCase()}
												</Text>
											</Flex>
											<Grid columns="12" gap="1">
												{Array.from({ length: 12 }).map((_, i) => (
													<Box
														key={`shade-${i + 1}`}
														style={{
															height: "20px",
															borderRadius: "var(--radius-1)",
															backgroundColor: customScale[`--accent-${i + 1}`],
														}}
													/>
												))}
											</Grid>
										</Flex>
									) : (
										<Grid columns="8" gap="2">
											{accentColors.map((color) => (
												<Tooltip key={color} content={color}>
													<IconButton
														size="2"
														variant={accentColor === color ? "solid" : "soft"}
														color={color}
														style={{
															borderRadius: "var(--radius-2)",
															cursor: "pointer",
														}}
														onClick={() => setAccentColor(color)}
													>
														<Box
															style={{
																width: "12px",
																height: "12px",
																borderRadius: "50%",
																backgroundColor: "currentColor",
															}}
														/>
													</IconButton>
												</Tooltip>
											))}
										</Grid>
									)}
								</Flex>
							</Box>
						</Flex>
					</Flex>
				</Card>

				<Heading size="4" mt="4">{t("settings.appearance.glass", "Glassmorphism")}</Heading>
				<Card>
					<Flex direction="column" gap="4">
						<Flex gap="3" align="start">
							<Sparkle24Regular />
							<Box flexGrow="1">
								<Flex direction="column" gap="3">
									<Flex align="center" justify="between">
										<Flex direction="column" gap="1">
											<Text>
												{t("settings.appearance.glassBlur", "Glass Intensity")}
											</Text>
											<Text size="1" color="gray">
												{t("settings.appearance.glassBlurDesc", "Adjust the background blur effect for glassmorphic elements.")}
											</Text>
										</Flex>
										<Text size="1" weight="bold" color="accent">{glassBlur}px</Text>
									</Flex>
									<Slider 
										min={0} 
										max={64} 
										step={1} 
										value={[glassBlur]} 
										onValueChange={(v) => setGlassBlur(v[0])} 
									/>
								</Flex>
							</Box>
						</Flex>
					</Flex>
				</Card>
			</Flex>

			<Flex direction="column" gap="3">
				<Heading size="4">
					{t("settings.appearance.background", "Background")}
				</Heading>

				<SegmentedControl.Root
					value={backgroundMode}
					onValueChange={(v) =>
						setBackgroundMode(v as "none" | "image" | "gradient")
					}
				>
					<SegmentedControl.Item value="none">
						{t("settings.appearance.mode.none", "None")}
					</SegmentedControl.Item>
					<SegmentedControl.Item value="image">
						{t("settings.appearance.mode.image", "Image")}
					</SegmentedControl.Item>
					<SegmentedControl.Item value="gradient">
						{t("settings.appearance.mode.gradient", "Gradient")}
					</SegmentedControl.Item>
				</SegmentedControl.Root>

				{backgroundMode === "image" && (
					<SettingsCustomBackgroundCard
						onOpen={() => setShowBackgroundSettings(true)}
					/>
				)}

				{backgroundMode === "gradient" && (
					<Card>
						<Flex direction="column" gap="4">
							<Flex gap="3" align="start">
								<Sparkle24Regular />
								<Box flexGrow="1">
									<Flex direction="column" gap="3">
										<Flex align="center" justify="between">
											<Flex direction="column" gap="1">
												<Text>
													{t(
														"settings.appearance.useCustomGradient",
														"Custom Gradient Color",
													)}
												</Text>
												<Text size="1" color="gray">
													{t(
														"settings.appearance.useCustomGradientDesc",
														"Generate a gradient from a single color.",
													)}
												</Text>
											</Flex>
											<Switch
												checked={useCustomGradient}
												onCheckedChange={setUseCustomGradient}
											/>
										</Flex>

										{useCustomGradient ? (
											<Flex direction="column" gap="4">
												<Flex align="center" justify="between">
													<Text>
														{t(
															"settings.appearance.syncGradientToAccent",
															"Sync first color with Accent",
														)}
													</Text>
													<Button
														variant="soft"
														onClick={() => {
															const newGradientColors = [
																...customGradientColors,
															];
															newGradientColors[0] = customAccentColor;
															setCustomGradientColors(newGradientColors);
														}}
													>
														{t("common.sync", "Sync")}
													</Button>
												</Flex>
												<Flex align="center" gap="3" wrap="wrap">
													{customGradientColors.map((color, idx) => (
														// biome-ignore lint/suspicious/noArrayIndexKey: primitive array without unique IDs
														<Flex key={idx} align="center" gap="2">
															<input
																type="color"
																value={color}
																onChange={(e) => {
																	const newColor = e.target.value;
																	const newColors = [...customGradientColors];
																	newColors[idx] = newColor;
																	setCustomGradientColors(newColors);
																}}
																style={{
																	width: "40px",
																	height: "40px",
																	padding: 0,
																	border: "none",
																	borderRadius: "var(--radius-3)",
																	cursor: "pointer",
																	backgroundColor: "transparent",
																}}
															/>
															{customGradientColors.length > 1 && (
																<Button
																	variant="soft"
																	color="red"
																	size="1"
																	onClick={() => {
																		setCustomGradientColors(
																			customGradientColors.filter(
																				(_, i) => i !== idx,
																			),
																		);
																	}}
																>
																	{t("common.remove", "Remove")}
																</Button>
															)}
														</Flex>
													))}
													{customGradientColors.length < 4 && (
														<Button
															variant="outline"
															onClick={() => {
																setCustomGradientColors([
																	...customGradientColors,
																	"#ffffff",
																]);
															}}
														>
															{t(
																"settings.appearance.addGradientColor",
																"Add Color",
															)}
														</Button>
													)}
												</Flex>
												<Flex align="center" justify="between">
													<Text>
														{t(
															"settings.appearance.gradientType",
															"Gradient Type",
														)}
													</Text>
													<SegmentedControl.Root
														value={customGradientType}
														onValueChange={(v) =>
															setCustomGradientType(
																v as "linear" | "radial" | "conic",
															)
														}
													>
														<SegmentedControl.Item value="linear">
															{t("settings.appearance.type.linear", "Linear")}
														</SegmentedControl.Item>
														<SegmentedControl.Item value="radial">
															{t("settings.appearance.type.radial", "Radial")}
														</SegmentedControl.Item>
														<SegmentedControl.Item value="conic">
															{t("settings.appearance.type.conic", "Conic")}
														</SegmentedControl.Item>
													</SegmentedControl.Root>
												</Flex>
												<Flex direction="column" gap="2">
													<Flex align="center" justify="between">
														<Text>
															{t(
																"settings.appearance.gradientOpacity",
																"Gradient Opacity",
															)}
														</Text>
														<Text wrap="nowrap" color="gray" size="1">
															{Math.round(customGradientOpacity * 100)}%
														</Text>
													</Flex>
													<Slider
														min={0}
														max={1}
														step={0.01}
														value={[customGradientOpacity]}
														onValueChange={(v) =>
															setCustomGradientOpacity(v[0])
														}
													/>
												</Flex>
												<Flex direction="column" gap="2">
													<Flex align="center" justify="between">
														<Text>
															{t(
																"settings.appearance.gradientSize",
																"Gradient Scale",
															)}
														</Text>
														<Text wrap="nowrap" color="gray" size="1">
															{Math.round(customGradientSize * 100)}%
														</Text>
													</Flex>
													<Slider
														min={0.1}
														max={3}
														step={0.1}
														value={[customGradientSize]}
														onValueChange={(v) => setCustomGradientSize(v[0])}
													/>
												</Flex>
												<Flex align="center" gap="2">
													<Popover.Root>
														<Popover.Trigger>
															<Button variant="soft" style={{ flexGrow: 1 }}>
																<Timer24Regular />
																{t(
																	"settings.appearance.gradientPositionSettings",
																	"Adjust Center & Angle",
																)}
															</Button>
														</Popover.Trigger>
														<Popover.Content size="2" style={{ width: 300 }}>
															<Flex direction="column" gap="3">
																<Text weight="bold" size="2">
																	{t(
																		"settings.appearance.gradientPositionSettings",
																		"Center & Angle",
																	)}
																</Text>

																{customGradientType !== "linear" && (
																	<>
																		<Text size="1" color="gray">
																			{t(
																				"settings.appearance.gradientCenterX",
																				"Center X (Horizontal)",
																			)}
																			: {customGradientCenter[0]}%
																		</Text>
																		<Slider
																			min={0}
																			max={100}
																			step={1}
																			value={[customGradientCenter[0]]}
																			onValueChange={(v) =>
																				setCustomGradientCenter([
																					v[0],
																					customGradientCenter[1],
																				])
																			}
																		/>

																		<Text size="1" color="gray">
																			{t(
																				"settings.appearance.gradientCenterY",
																				"Center Y (Vertical)",
																			)}
																			: {customGradientCenter[1]}%
																		</Text>
																		<Slider
																			min={0}
																			max={100}
																			step={1}
																			value={[customGradientCenter[1]]}
																			onValueChange={(v) =>
																				setCustomGradientCenter([
																					customGradientCenter[0],
																					v[0],
																				])
																			}
																		/>
																	</>
																)}

																{customGradientType !== "radial" && (
																	<>
																		<Text size="1" color="gray">
																			{t(
																				"settings.appearance.gradientAngle",
																				"Angle",
																			)}
																			: {customGradientAngle}°
																		</Text>
																		<Slider
																			min={0}
																			max={360}
																			step={1}
																			value={[customGradientAngle]}
																			onValueChange={(v) =>
																				setCustomGradientAngle(v[0])
																			}
																		/>
																	</>
																)}
															</Flex>
														</Popover.Content>
													</Popover.Root>
													<IconButton
														variant="outline"
														onClick={() => {
															setCustomGradientCenter([50, 50]);
															setCustomGradientAngle(45);
														}}
													>
														<History24Regular />
													</IconButton>
												</Flex>
												<Box
													style={{
														height: "40px",
														borderRadius: "var(--radius-2)",
														background: generateGradient(
															customGradientColors,
															customGradientType,
															customGradientCenter,
															customGradientAngle,
															customGradientSize,
														),
														marginTop: "var(--space-2)",
													}}
												/>
											</Flex>
										) : (
											<Grid columns="4" gap="2">
												{backgroundGradients.map((gradient) => (
													<Tooltip key={gradient.id} content={gradient.name}>
														<Box
															style={{
																height: "40px",
																borderRadius: "var(--radius-2)",
																background: gradient.css,
																cursor: "pointer",
																outline:
																	selectedGradient === gradient.id
																		? "2px solid var(--accent-9)"
																		: "none",
																outlineOffset: "2px",
															}}
															onClick={() => setSelectedGradient(gradient.id)}
														/>
													</Tooltip>
												))}
											</Grid>
										)}
									</Flex>
								</Box>
							</Flex>
						</Flex>
					</Card>
				)}


			</Flex>
			<Flex direction="column" gap="3">
				<Heading size="4">
					{t("settings.appearance.font", "Application Font")}
				</Heading>
				<Card>
					<Flex direction="column" gap="3">
						<Flex direction="column" gap="1">
							<Text size="2" weight="bold">
								{t("settings.appearance.currentFont", "Current Font")}
							</Text>
							<Text size="1" color="gray" style={{ fontFamily: appFont }}>
								{appFont.split(",")[0].replace(/"/g, "")}
							</Text>
						</Flex>
						<Button
							variant="soft"
							style={{ cursor: "pointer" }}
							onClick={() => setIsFontSelectionOpen(true)}
						>
							<TextT24Regular />
							{t("settings.appearance.changeFont", "Change Font...")}
						</Button>
					</Flex>
				</Card>
			</Flex>
				</>
			) : (
				<Flex direction="column" gap="4">

					<Flex direction="column" gap="3">
						<Heading size="4">{t("settings.appearance.advanced.projectColors", "Project Colors")}</Heading>
						<Card>
							<Flex direction="column" gap="4">
								<Flex gap="3" align="start">
									<TextT24Regular />
									<Box flexGrow="1">
										<Flex direction="column" gap="3">
											<Flex align="center" justify="between">
												<Flex direction="column" gap="1">
													<Text>{t("settings.appearance.advanced.primaryText", "Primary Text Color")}</Text>
													<Text size="1" color="gray">{t("settings.appearance.advanced.primaryTextDesc", "Global primary text override.")}</Text>
												</Flex>
												<input type="color" value={advPrimaryText || "#ffffff"} onChange={(e) => setAdvPrimaryText(e.target.value)} style={{ width: "32px", height: "32px" }} />
											</Flex>

											<Flex align="center" justify="between">
												<Flex direction="column" gap="1">
													<Text>{t("settings.appearance.advanced.secondaryText", "Secondary Text Color")}</Text>
													<Text size="1" color="gray">{t("settings.appearance.secondaryDesc", "Translations & Metadata.")}</Text>
												</Flex>
												<input type="color" value={advSecondaryText || "#888888"} onChange={(e) => setAdvSecondaryText(e.target.value)} style={{ width: "32px", height: "32px" }} />
											</Flex>
										</Flex>
									</Box>
								</Flex>
							</Flex>
						</Card>
					</Flex>

					<Flex direction="column" gap="3">
						<Heading size="4"><ContentView24Regular /> {t("settings.appearance.advanced.workspace", "Workspace Theme")}</Heading>
						<Card>
							<Grid columns="2" gap="3">
								<AdvancedColorItem label="Titlebar Background" value={vTitlebarBg} onChange={setVTitlebarBg} />
								<AdvancedColorItem label="Sidebar Background" value={vSidebarBg} onChange={setVSidebarBg} />
								<AdvancedColorItem label="Active Item Highlight" value={vSidebarActive} onChange={setVSidebarActive} />
								<AdvancedColorItem label="Menu Hover Color" value={vMenuHover} onChange={setVMenuHover} />
							</Grid>
						</Card>
					</Flex>

					<Flex direction="column" gap="3">
						<Heading size="4"><Stack24Regular /> {t("settings.appearance.advanced.editor", "Editor Layout")}</Heading>
						<Card>
							<Flex direction="column" gap="4">
								<Grid columns="2" gap="3">
									<AdvancedColorItem label="Editor Canvas" value={vEditorBg} onChange={setVEditorBg} />
									<AdvancedColorItem label="Active Line Highlight" value={vActiveLine} onChange={setVActiveLine} />
									<AdvancedColorItem label="Line Hover Effect" value={vLineHover} onChange={setVLineHover} />
									<AdvancedColorItem label="Selection Highlight" value={vSelection} onChange={setVSelection} />
								</Grid>
								<AdvancedSliderItem label="Chip Border Radius" icon={<Stack24Regular />} value={vChipRadius} min={0} max={32} onChange={setVChipRadius} unit="px" />
								<AdvancedSliderItem label="Chip Spacing (Gap)" icon={<Stack24Regular />} value={vChipGap} min={0} max={32} onChange={setVChipGap} unit="px" />
								<AdvancedSliderItem label="Chip Padding (V)" icon={<PaddingLeft24Regular />} value={vChipPaddingV} min={0} max={32} onChange={setVChipPaddingV} unit="px" />
								<AdvancedSliderItem label="Chip Padding (H)" icon={<PaddingLeft24Regular />} value={vChipPaddingH} min={0} max={32} onChange={setVChipPaddingH} unit="px" />
							</Flex>
						</Card>
					</Flex>

					<Flex direction="column" gap="3">
						<Heading size="4"><VideoBackgroundEffect24Regular /> {t("settings.appearance.advanced.audioVisuals", "Playback & Visuals")}</Heading>
						<Card>
							<Flex direction="column" gap="4">
								<Grid columns="2" gap="3">
									<AdvancedColorItem label="Audio Bar Color" value={vAudioBarBg} onChange={setVAudioBarBg} />
									<AdvancedColorItem label="Audio Bar Text" value={vAudioBarText} onChange={setVAudioBarText} />
									<AdvancedColorItem label="Waveform Inactive" value={advWaveformColor} onChange={setAdvWaveformColor} />
									<AdvancedColorItem label="Waveform Progress" value={advWaveformProgress} onChange={setAdvWaveformProgress} />
								</Grid>
								<AdvancedColorItem label="Romanization Text" value={vRomanColor} onChange={setVRomanColor} />
								<AdvancedColorItem label="Translation Text" value={vTransColor} onChange={setVTransColor} />
								<AdvancedColorItem label="Genius Header Color" value={vGeniusHeaderColor} onChange={setVGeniusHeaderColor} />
							</Flex>
						</Card>
					</Flex>

					<Flex direction="column" gap="3">
						<Heading size="4"><Sparkle24Regular /> {t("settings.appearance.advanced.global", "Global Design System")}</Heading>
						<Card>
							<Flex direction="column" gap="4">
								<Grid columns="2" gap="3">
									<AdvancedColorItem label="Scrollbar Thumb" value={vScrollbar} onChange={setVScrollbar} />
									<AdvancedColorItem label="Dialog Background" value={vDialogBg} onChange={setVDialogBg} />
									<AdvancedColorItem label="Dialog Border" value={vDialogBorder} onChange={setVDialogBorder} />
								</Grid>
								<AdvancedSliderItem label="Global Border Radius" icon={<Stack24Regular />} value={vGlobalRadius} min={0} max={40} onChange={setVGlobalRadius} unit="px" />
								<AdvancedSliderItem label="Global Border Width" icon={<Timer24Regular />} value={vGlobalBorderWidth} min={0} max={8} onChange={setVGlobalBorderWidth} unit="px" />
								<AdvancedSliderItem label="Shadow Intensity" icon={<VideoBackgroundEffect24Regular />} value={vShadow} min={0} max={10} step={0.1} onChange={setVShadow} unit="" />
								<AdvancedSliderItem label="Backdrop Blur" icon={<Sparkle24Regular />} value={vBackdrop} min={0} max={100} onChange={setVBackdrop} unit="px" />
							</Flex>
						</Card>
					</Flex>

					<Flex direction="column" gap="3">
						<Heading size="4"><Stack24Regular /> {t("settings.appearance.layout.title", "Application Layout")}</Heading>
						<Card>
							<Flex direction="column" gap="4">
								<Flex direction="column" gap="1">
									<Text weight="bold">{t("settings.appearance.layout.order", "Element Order")}</Text>
									<Text size="1" color="gray">{t("settings.appearance.layout.orderDesc", "Drag to reorder elements. Some positions may be limited by constraints.")}</Text>
								</Flex>

								<Reorder.Group axis="y" values={layoutOrder} onReorder={setLayoutOrder} style={{ display: "flex", flexDirection: "column", gap: "8px", listStyle: "none", padding: 0 }}>
									{layoutOrder.map((item) => (
										<Reorder.Item key={item} value={item} style={{ cursor: "grab" }}>
											<Card size="1">
												<Flex align="center" gap="3">
													<Stack24Regular style={{ color: "var(--gray-8)" }} />
													<Box flexGrow="1">
														<Text size="2" weight="bold">
														{item === "titlebar" && <><ContentView24Regular /> {t("settings.appearance.layout.titlebar", "Title Bar")}</>}
														{item === "ribbonbar" && <><Stack24Regular style={{ transform: "rotate(180deg)" }} /> {t("settings.appearance.layout.ribbonbar", "Toolbar (Ribbon)")}</>}
														{item === "editor" && <><TextT24Regular /> {t("settings.appearance.layout.editor", "Main Editor Area")}</>}
														{item === "audio-controls" && <><Speaker224Regular /> {t("settings.appearance.layout.audio", "Audio Controls")}</>}
														</Text>
													</Box>
												</Flex>
											</Card>
										</Reorder.Item>
									))}
								</Reorder.Group>

								<Flex direction="column" gap="2" mt="2">
									<Text size="2" weight="bold">{t("settings.appearance.layout.ribbonPos", "Toolbar Orientation")}</Text>
									<SegmentedControl.Root value={vRibbonPos} onValueChange={(v) => setVRibbonPos(v as any)}>
										<SegmentedControl.Item value="top">{t("settings.appearance.layout.pos.top", "Top")}</SegmentedControl.Item>
										<SegmentedControl.Item value="bottom">{t("settings.appearance.layout.pos.bottom", "Bottom")}</SegmentedControl.Item>
										<SegmentedControl.Item value="left">{t("settings.appearance.layout.pos.left", "Left")}</SegmentedControl.Item>
										<SegmentedControl.Item value="right">{t("settings.appearance.layout.pos.right", "Right")}</SegmentedControl.Item>
									</SegmentedControl.Root>
									{(vRibbonPos === "left" || vRibbonPos === "right") && (
										<Text size="1" color="amber">
											{t("settings.appearance.layout.sidebarWarning", "Note: Sidebar mode is experimental and may look different.")}
										</Text>
									)}
								</Flex>
							</Flex>
						</Card>
					</Flex>

					<Card size="2">
						<Flex direction="column" gap="2">
							<Flex align="center" gap="2" color="gray">
								<Sparkle24Regular />
								<Text size="2">{t("settings.appearance.advanced.masterResetNote", "This will reset all 20+ granular overrides.")}</Text>
							</Flex>
							<Button variant="soft" color="red" onClick={() => {
								setAdvWaveformColor(""); setAdvWaveformProgress("");
								setAdvPrimaryText(""); setAdvSecondaryText("");
								setVTitlebarBg(""); setVSidebarBg(""); setVSidebarActive(""); setVMenuHover("");
								setVEditorBg(""); setVActiveLine(""); setVLineHover(""); setVSelection("");
								setVChipRadius(8); setVChipGap(8); setVChipPaddingV(4); setVChipPaddingH(12);
								setVRomanColor(""); setVTransColor("");
								setVAudioBarBg(""); setVAudioBarText("");
								setVScrollbar(""); setVDialogBg(""); setVDialogBorder("");
								setVGlobalRadius(12); setVGlobalBorderWidth(1); setVShadow(1); setVBackdrop(16);
								setLayoutOrder(["titlebar", "ribbonbar", "editor", "audio-controls"]); setVRibbonPos("top");
							}}>
								<History24Regular />
								{t("settings.appearance.advanced.resetMaster", "Master Reset Advanced Config")}
							</Button>
						</Flex>
					</Card>
				</Flex>
			)}
		</Flex>
	);
};

// --- Helper Components for Advanced Editor ---

const AdvancedColorItem = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => (
	<Flex direction="column" gap="1">
		<Flex align="center" justify="between">
			<Text size="1" color="gray" weight="bold">{label}</Text>
			{value && (
				<IconButton size="1" variant="ghost" onClick={() => onChange("")}>
					<History24Regular />
				</IconButton>
			)}
		</Flex>
		<input 
			type="color" 
			value={value || "#000000"} 
			onChange={(e) => onChange(e.target.value)} 
			style={{ width: "100%", height: "24px", border: "1px solid var(--gray-5)", borderRadius: "4px", cursor: "pointer", padding: 0 }}
		/>
	</Flex>
);

const AdvancedSliderItem = ({ label, icon, value, min, max, step = 1, onChange, unit }: { label: string, icon: React.ReactNode, value: number, min: number, max: number, step?: number, onChange: (v: number) => void, unit: string }) => (
	<Box>
		<Flex align="center" justify="between" mb="1">
			<Flex align="center" gap="2">
				<Box color="accent">{icon}</Box>
				<Text size="1" weight="bold">{label}</Text>
			</Flex>
			<Text size="1" color="gray">{value}{unit}</Text>
		</Flex>
		<Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0])} />
	</Box>
);
