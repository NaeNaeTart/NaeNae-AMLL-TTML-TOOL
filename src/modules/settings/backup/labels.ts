const ACRONYMS = new Set([
	"ai",
	"api",
	"amll",
	"fps",
	"id",
	"lrc",
	"mp3",
	"ttml",
	"ui",
	"url",
	"yaml",
]);

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
		.map((word) =>
			ACRONYMS.has(word.toLowerCase())
				? word.toUpperCase()
				: word.charAt(0).toUpperCase() + word.slice(1),
		)
		.join(" ");
}

export function formatSettingLabel(key: string): string {
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
