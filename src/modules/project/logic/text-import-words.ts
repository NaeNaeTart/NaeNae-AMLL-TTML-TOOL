/**
 * Split an imported line into words: at the user's explicit separator (if any),
 * then after every hyphen, keeping the hyphen on the left part ("la-la" -> "la-", "la").
 * This matches the old defaults of the removed hidden switches (split hyphens on, add spaces off).
 */
export function splitTextImportWords(
	text: string,
	separator: string,
): string[] {
	const segments = separator
		? text.split(separator).filter((word) => word.length > 0)
		: [text];
	return segments
		.flatMap((word) => word.split(/(?<=-)/g))
		.map((word) => word.replace(/\\/g, ""));
}
