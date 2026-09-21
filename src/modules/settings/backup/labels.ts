const SETTING_LABELS: Record<string, string> = {
	advancedRibbonControls: "Advanced Ribbon Controls",
	aiSidebarApiKey: "AI Sidebar API Key",
	bgLyricIgnoreSync: "Ignore Background Lyrics in Sync",
	showEndTimeAsDuration: "Show End Time as Duration",
	beginnerGuideStatus: "Beginner Guide Status",
	discordRichPresenceEnabled: "Discord Rich Presence",
	discordDetailsTemplate: "Discord Details Template",
	discordStateTemplate: "Discord State Template",
	discordPlaybackTimeline: "Discord Playback Timeline",
	discordProjectElapsed: "Discord Project Elapsed Time",
	discordRepositoryButton: "Discord Repository Button",
	discordStatusBadge: "Discord Status Badge",
	discordIdleTimeoutMinutes: "Discord Idle Timeout",
	editActiveLineHighlight: "Active Line Highlight",
	folderProjectsEnabled: "Folder Projects",
	previewModeType: "Preview Mode",
	previewPanelWidth: "Preview Panel Width",
	aiSidebarWidth: "AI Sidebar Width",
	aiSidebarEnabled: "AI Sidebar",
	aiSidebarBaseUrl: "AI Sidebar Base URL",
	aiSidebarModel: "AI Sidebar Model",
	aiSidebarPersistKey: "Persist AI API Key",
	accentColor: "Accent Color",
	useCustomAccent: "Custom Accent Color",
	customAccentColor: "Custom Accent Color Value",
	glassmorphismBlur: "Glassmorphism Blur",
	backgroundMode: "Background Mode",
	selectedGradient: "Selected Gradient",
	useCustomGradient: "Custom Gradient",
	customGradientColors: "Custom Gradient Colors",
	customGradientType: "Custom Gradient Type",
	customGradientOpacity: "Custom Gradient Opacity",
	customGradientCenter: "Custom Gradient Center",
	customGradientAngle: "Custom Gradient Angle",
	customGradientSize: "Custom Gradient Size",
	syncGradientToAccent: "Sync Gradient with Accent",
	customBackgroundOpacity: "Custom Background Opacity",
	customBackgroundMask: "Custom Background Mask",
	customBackgroundBlur: "Custom Background Blur",
	customBackgroundBrightness: "Custom Background Brightness",
	appearancePresets: "Appearance Presets",
	appearanceEditorMode: "Appearance Editor Mode",
	legacyDarkTheme: "Classic Dark Theme",
	interfaceScale: "Interface Scale",
	latencyTestBPM: "Latency Test BPM",
	syncJudgeMode: "Sync Judge Mode",
	layoutMode: "Layout Mode",
	showTimestamps: "Show Timestamps",
	enableManualTimestampEdit: "Manual Timestamp Editing",
	highlightActiveWord: "Highlight Active Word",
	enableSyncGlowAnimation: "Sync Glow Animation",
	highlightErrors: "Highlight Timing Errors",
	smartFirstWord: "Smart First Word",
	smartLastWord: "Smart Last Word",
	compactBGInSync: "Compact Background in Sync",
	touchSyncPanel: "Touch Sync Panel",
	visualizeTimestampUpdate: "Visualize Timestamp Updates",
	enableTimeModeDoubleClickEdit: "Double Click to Edit Timestamps",
	syncTimeOffset: "Sync Time Offset",
	syncCommitOffset: "Sync Commit Offset",
	syncWordWrap: "Sync Word Wrap",
	syncFocusMainLine: "Focus Main Line in Sync",
	syncAutoScroll: "Auto-Scroll in Sync",
	timingOverviewAutoScroll: "Timing Overview Auto-Scroll",
	timingOverviewOrderMode: "Timing Overview Order",
	spectrogramHoverSyncEnabled: "Spectrogram Hover Sync",
	syncTabPosition: "Sync Tab Position",
	syncLevelMode: "Sync Level Mode",
	enableUpcomingWordHighlight: "Upcoming Word Highlight",
	upcomingWordHighlightThreshold: "Upcoming Word Threshold",
	upcomingWordHighlightColor: "Upcoming Word Color",
	settings_spectrogramGain: "Spectrogram Gain",
	settings_spectrogramZoom: "Spectrogram Zoom",
	settings_spectrogramHeight: "Spectrogram Height",
	settings_spectrogramFftSize: "Spectrogram FFT Size",
	settings_selectedPaletteId: "Spectrogram Palette",
	settings_customPaletteStops: "Spectrogram Palette Stops",
	autosaveEnabled: "Auto-Save",
	autosaveInterval: "Auto-Save Interval",
	autosaveLimit: "Auto-Save Limit",
	showTranslationLines: "Translation in Preview",
	showRomanLines: "Romanization in Preview",
	hideObsceneWords: "Filter Explicit Words",
	lyricWordFadeWidth: "Word Fade Width",
	vsync: "VSync",
	showFpsCounter: "Show FPS Counter",
	instantHighlightFade: "Instant Highlight Fade",
	spicySimpleLyricsMode: "Spicy Simple Mode",
	spicyForceLineSynced: "Spicy Force Line Synced",
	spicyBackgroundMode: "Spicy Background Mode",
	showUnselectedLines: "Show Unselected Lines",
	keyBindingTriggerMode: "Shortcut Trigger Mode",
	"keybindings.autoSegment.doublePress": "Auto-Segment Double Press",
	geniusApiKey: "Genius API Key",
	geniusCategorizationEnabled: "Genius Categorization",
	geniusHeaderDetectionDialogShown: "Genius Header Detection",
	importSplitHyphens: "Split Hyphens on Import",
	normalizeApostrophesOnImport: "Normalize Apostrophes",
	normalizeCyrillicEsOnImport: "Normalize Cyrillic Es",
	allowConsecutiveBackgroundLines: "Consecutive Background Lines",
	ttmlChecklist: "TTML Checklist",
	appFont: "Application Font",
	appFontStyle: "Font Style",
	appFontWeight: "Font Weight",
	customFontName: "Custom Font Name",
	customFontData: "Custom Font File",
};

function humanizeKey(rawKey: string): string {
	let cleaned = rawKey;
	if (cleaned.includes(":")) {
		const parts = cleaned.split(":");
		cleaned = parts[parts.length - 1];
	}
	cleaned = cleaned.replace(/[-_]+/g, " ");
	cleaned = cleaned.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
	return cleaned
		.trim()
		.split(/\s+/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

export function formatSettingLabel(key: string): string {
	if (SETTING_LABELS[key]) {
		return SETTING_LABELS[key];
	}
	return humanizeKey(key);
}

export function formatKeybindingLabel(key: string): string {
	const stripped = key.startsWith("keybindings:")
		? key.slice("keybindings:".length)
		: key;
	if (stripped.includes(".")) {
		const [category, ...rest] = stripped.split(".");
		const action = rest.join(".");
		return `${humanizeKey(category)}: ${humanizeKey(action)}`;
	}
	return humanizeKey(stripped);
}
