import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export enum SyncJudgeMode {
	FirstKeyDownTime = "first-keydown-time",
	FirstKeyDownTimeLegacy = "first-keydown-time-legacy",
	LastKeyUpTime = "last-keyup-time",
	MiddleKeyTime = "middle-key-time",
}

export enum LayoutMode {
	Simple = "simple",
	Advance = "advance",
}

export const geniusApiKeyAtom = atomWithStorage<string>("geniusApiKey", "");

export const latencyTestBPMAtom = atomWithStorage("latencyTestBPM", 120);

export const syncJudgeModeAtom = atomWithStorage(
	"syncJudgeMode",
	SyncJudgeMode.FirstKeyDownTime,
);

export const layoutModeAtom = atomWithStorage("layoutMode", LayoutMode.Simple);

export const showWordRomanizationInputAtom = atomWithStorage(
	"showWordRomanizationInput",
	false,
);

export const displayRomanizationInSyncAtom = atomWithStorage(
	"displayRomanizationInSync",
	false,
);

export const showLineTranslationAtom = atomWithStorage(
	"showLineTranslation",
	true,
);

export const showLineRomanizationAtom = atomWithStorage(
	"showLineRomanization",
	true,
);

export const hideSubmitAMLLDBWarningAtom = atomWithStorage(
	"hideSubmitAMLLDBWarning",
	false,
);
export const generateNameFromMetadataAtom = atomWithStorage(
	"generateNameFromMetadata",
	true,
);

export const autosaveEnabledAtom = atomWithStorage("autosaveEnabled", true);
export const autosaveIntervalAtom = atomWithStorage("autosaveInterval", 10);
export const autosaveLimitAtom = atomWithStorage("autosaveLimit", 10);

export const showTimestampsAtom = atomWithStorage("showTimestamps", true);
export const enableManualTimestampEditAtom = atomWithStorage(
	"enableManualTimestampEdit",
	true,
);

export const highlightActiveWordAtom = atomWithStorage(
	"highlightActiveWord",
	true,
);

export const enableSyncGlowAnimationAtom = atomWithStorage(
	"enableSyncGlowAnimation",
	false,
);

export const highlightErrorsAtom = atomWithStorage("highlightErrors", false);

export const quickFixesAtom = atomWithStorage(
	"highlightGrammarWarnings",
	false,
);
export const ignoredQuickFixWordsAtom = atomWithStorage(
	"ignoredGrammarWords",
	[] as string[],
);

export const smartFirstWordAtom = atomWithStorage("smartFirstWord", false);
export const smartLastWordAtom = atomWithStorage("smartLastWord", false);
export const compactBGInSyncAtom = atomWithStorage("compactBGInSync", true);

export const accentColorAtom = atomWithStorage<
	| "gray"
	| "gold"
	| "bronze"
	| "brown"
	| "yellow"
	| "amber"
	| "orange"
	| "tomato"
	| "red"
	| "ruby"
	| "crimson"
	| "pink"
	| "plum"
	| "purple"
	| "violet"
	| "iris"
	| "indigo"
	| "blue"
	| "cyan"
	| "teal"
	| "jade"
	| "green"
	| "grass"
	| "lime"
	| "mint"
	| "sky"
>("accentColor", "red");

export const backgroundModeAtom = atomWithStorage<
	"none" | "image" | "gradient"
>("backgroundMode", "none");

export const selectedGradientAtom = atomWithStorage<string>(
	"selectedGradient",
	"sunset",
);

export const useCustomAccentAtom = atomWithStorage<boolean>(
	"useCustomAccent",
	false,
);

export const customAccentColorAtom = atomWithStorage<string>(
	"customAccentColor",
	"#e5484d",
);

export const useCustomGradientAtom = atomWithStorage<boolean>(
	"useCustomGradient",
	false,
);

export const customGradientColorsAtom = atomWithStorage<string[]>(
	"customGradientColors",
	["#7028e4"],
);

export const customGradientTypeAtom = atomWithStorage<
	"linear" | "radial" | "conic"
>("customGradientType", "linear");

export const customGradientOpacityAtom = atomWithStorage<number>(
	"customGradientOpacity",
	1,
);

export const customGradientCenterAtom = atomWithStorage<[number, number]>(
	"customGradientCenter",
	[50, 50],
);

export const customGradientAngleAtom = atomWithStorage<number>(
	"customGradientAngle",
	45,
);

export const customGradientSizeAtom = atomWithStorage<number>(
	"customGradientSize",
	1,
);

export const syncGradientToAccentAtom = atomWithStorage<boolean>(
	"syncGradientToAccent",
	false,
);

export const appFontAtom = atomWithStorage<string>(
	"appFont",
	'"MiSans", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
);

export const customFontDataAtom = atomWithStorage<string | null>(
	"customFontData",
	null,
);
export const customFontNameAtom = atomWithStorage<string | null>(
	"customFontName",
	null,
);

export const appFontWeightAtom = atomWithStorage<string>(
	"appFontWeight",
	"400",
);
export const appFontStyleAtom = atomWithStorage<string>(
	"appFontStyle",
	"normal",
);

export const importAddSpacesAtom = atomWithStorage<boolean>(
	"importAddSpaces",
	false,
);

export const importSplitHyphensAtom = atomWithStorage<boolean>(
	"importSplitHyphens",
	true,
);

export enum Mp3ConversionMode {
	Never = "never",
	Always = "always",
	Ask = "ask",
}

export const mp3ConversionModeAtom = atomWithStorage<Mp3ConversionMode>(
	"mp3ConversionMode",
	Mp3ConversionMode.Ask,
);

export const hideMp3ConversionWarningAtom = atomWithStorage<boolean>(
	"hideMp3ConversionWarning",
	false,
);

export const boykisserModeAtom = atomWithStorage<boolean>(
	"boykisserMode",
	false,
);

export const glassmorphismBlurAtom = atomWithStorage<number>(
	"glassmorphismBlur",
	24,
);

export enum AppearanceEditorMode {
	Basic = "basic",
	Advanced = "advanced",
}

export const appearanceEditorModeAtom = atomWithStorage<AppearanceEditorMode>(
	"appearanceEditorMode",
	AppearanceEditorMode.Basic,
);

export const advancedWaveformColorAtom = atomWithStorage<string>(
	"advancedWaveformColor",
	"",
);

export const advancedWaveformProgressColorAtom = atomWithStorage<string>(
	"advancedWaveformProgressColor",
	"",
);

export const advancedPrimaryTextColorAtom = atomWithStorage<string>(
	"advancedPrimaryTextColor",
	"",
);

export const advancedSecondaryTextColorAtom = atomWithStorage<string>(
	"advancedSecondaryTextColor",
	"",
);

// --- 20+ Advanced Workspace Customizations ---
export const advTitlebarBgAtom = atomWithStorage("advTitlebarBg", "");
export const advSidebarBgAtom = atomWithStorage("advSidebarBg", "");
export const advSidebarActiveAtom = atomWithStorage("advSidebarActive", "");
export const advMenuHoverBgAtom = atomWithStorage("advMenuHoverBg", "");

export const advEditorBgAtom = atomWithStorage("advEditorBg", "");
export const advActiveLineBgAtom = atomWithStorage("advActiveLineBg", "");
export const advLineHoverBgAtom = atomWithStorage("advLineHoverBg", "");

export const advChipBorderRadiusAtom = atomWithStorage("advChipBorderRadius", 8);
export const advChipGapAtom = atomWithStorage("advChipGap", 8);
export const advChipPaddingVerticalAtom = atomWithStorage("advChipPaddingVertical", 4);
export const advChipPaddingHorizontalAtom = atomWithStorage("advChipPaddingHorizontal", 12);

export const advRomanizationColorAtom = atomWithStorage("advRomanizationColor", "");
export const advTranslationColorAtom = atomWithStorage("advTranslationColor", "");
export const advGeniusHeaderColorAtom = atomWithStorage("advGeniusHeaderColor", "");

export const advAudioBarBgAtom = atomWithStorage("advAudioBarBg", "");
export const advAudioBarTextAtom = atomWithStorage("advAudioBarText", "");

export const advScrollbarColorAtom = atomWithStorage("advScrollbarColor", "");
export const advDialogBgAtom = atomWithStorage("advDialogBg", "");
export const advDialogBorderAtom = atomWithStorage("advDialogBorder", "");

export const advGlobalBorderRadiusAtom = atomWithStorage("advGlobalBorderRadius", 12);
export const advGlobalBorderWidthAtom = atomWithStorage("advGlobalBorderWidth", 1);
export const advShadowIntensityAtom = atomWithStorage("advShadowIntensity", 1);
export const advSelectionColorAtom = atomWithStorage("advSelectionColor", "");
export const advBackdropBlurAtom = atomWithStorage("advBackdropBlur", 16);

export const appLayoutOrderAtom = atomWithStorage<string[]>(
	"appLayoutOrder",
	["titlebar", "ribbonbar", "editor", "audio-controls"],
);

export const vRibbonPositionAtom = atomWithStorage<"top" | "bottom" | "left" | "right">(
	"vRibbonPosition",
	"top",
);

export interface AppearancePreset {
	id: string;
	name: string;
	settings: Record<string, any>;
}

export const appearancePresetsAtom = atomWithStorage<AppearancePreset[]>(
	"appearancePresets",
	[],
);

export const geniusCategorizationEnabledAtom = atomWithStorage<boolean>(
	"geniusCategorizationEnabled",
	false,
);

export const experimentalFeaturesDialogOpenAtom = atom(false);

export const geniusHeaderDetectionDialogShownAtom = atomWithStorage<boolean>(
	"geniusHeaderDetectionDialogShown",
	false,
);

export const geniusHeaderDetectionDialogOpenAtom = atom(false);

export const geniusHeaderRestorationTextAtom = atom<string | null>(null);
