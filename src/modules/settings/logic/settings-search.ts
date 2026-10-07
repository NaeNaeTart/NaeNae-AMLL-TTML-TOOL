export const settingsSearchKeywords: Record<string, string> = {
	common:
		"interface language layout mode simple advanced privacy display discord presence compact background vocals sync",
	editor:
		"sync timing timestamp judgment keybinding trigger offset commit smart first last word upcoming highlight threshold color wrap scroll focus spectrogram hover tab position",
	files:
		"import export cleanup normalize apostrophes cyrillic autosave interval snapshots history backup restore folder project storage preview files consecutive standalone background vocals",
	audio:
		"music volume playback speed equalizer gain preset mp3 flac conversion spectrogram palette frequency",
	keybinding:
		"keyboard keys shortcut controls new open save undo redo select delete mode sync playback seek volume segment audition",
	appearance:
		"theme preset custom accent color background blur glass intensity image gradient font interface scale reset layout titlebar sidebar editor chip spacing padding romanization translation scrollbar dialog shadow selection",
	ai: "assistant model api provider prompt review",
	about: "version update credits license",
	dev: "developer debug experimental advanced",
};

export function matchesSettingsSearch(text: string, query: string): boolean {
	const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
	const normalizedText = text.toLocaleLowerCase();
	return tokens.every((token) => normalizedText.includes(token));
}
