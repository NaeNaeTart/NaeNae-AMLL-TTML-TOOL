export const SECRET_KEYS = ["geniusApiKey"];
const LOCAL_ONLY_KEYS = ["lastWorkspaceDir", "amll-ttml:recent-projects"];
/**
 * @description 会被排除在设置备份之外的本地存储键。
 * `customBackgroundImage` 为已迁移到 IndexedDB 的旧键，其余为第三方（Sentry、开发工具、Vercel Analytics、i18next）。
 */
const LEGACY_KEYS = ["customBackgroundImage"];
// Old feature values stay orphaned locally and must not travel in new backups.
const REMOVED_SETTING_KEYS = [
	"hideSubmitAMLLDBWarning",
	"syncGradientToAccent",
	"importAddSpaces",
	"importSplitHyphens",
	"boykisserMode",
	"vRibbonPosition",
	"hideObsceneWords",
	"keybindings:selectInverted",
	"keybindings:selectWordsOfMatchedSelection",
];
const ASSET_OWNED_KEYS = [
	"appearancePresets",
	"customFontName",
	"customFontData",
];
const DENYLIST_PREFIXES = [
	"sentry",
	"__",
	"va-",
	"i18next",
	"aiSidebar",
	"grammarCheck",
];

const DENIED_EXACT = new Set<string>([
	...SECRET_KEYS,
	...LOCAL_ONLY_KEYS,
	...LEGACY_KEYS,
	...REMOVED_SETTING_KEYS,
]);
const EXPORT_ONLY_DENIED = new Set<string>(ASSET_OWNED_KEYS);

export function isDeniedKey(key: string): boolean {
	if (DENIED_EXACT.has(key)) return true;
	return DENYLIST_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function isExportDeniedKey(key: string): boolean {
	return EXPORT_ONLY_DENIED.has(key) || isDeniedKey(key);
}

export function isSecretKey(key: string): boolean {
	return SECRET_KEYS.includes(key);
}
