const isCJKChar = (char: string) =>
	/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(char);
const isAlphaNum = (char: string) => /[\p{L}\p{N}]/u.test(char);
const isLatinAlphaNum = (char: string) => /[\p{Script=Latin}\p{N}]/u.test(char);

const normalize = (value: string) => {
	let processed = "";
	for (let index = 0; index < value.length; index++) {
		const char = value[index];
		if (char !== "-") {
			processed += char;
			continue;
		}
		const nextChar = value[index + 1];
		if (nextChar === " ") {
			processed += "— ";
			index++;
		} else if (nextChar === "-") {
			processed += "—";
			index++;
		} else if (nextChar && index > 0 && isAlphaNum(value[index - 1]) && isAlphaNum(nextChar)) {
			processed += "-\\";
		} else {
			processed += "—";
		}
	}

	let cjkProcessed = "";
	for (let index = 0; index < processed.length; index++) {
		const char = processed[index];
		const nextChar = processed[index + 1] ?? "";
		cjkProcessed += char;
		if (
			(isCJKChar(char) && (isCJKChar(nextChar) || isLatinAlphaNum(nextChar))) ||
			(isLatinAlphaNum(char) && isCJKChar(nextChar))
		) {
			cjkProcessed += "\\";
		}
	}
	return cjkProcessed
		.replace(/\s*,\s*/g, ", ")
		.replace(/\s+/g, " ")
		.replace(/\s+,/g, ",")
		.replace(/\s+(?=[,.;:!?])/g, "")
		.trim();
};

/** Process one lyric line into the plain-text import representation. */
export const prepareLyricLine = (line: string, escapeSpaces = true) => {
	const backgroundVocals: string[] = [];
	let mainLine = "";
	let currentParen = "";
	let inParen = false;

	for (const char of line.replace(/\[.*?\]/g, "").trim()) {
		if (["(", "（"].includes(char) && !inParen) {
			inParen = true;
			currentParen = "";
		} else if ([")", "）"].includes(char) && inParen) {
			inParen = false;
			backgroundVocals.push(currentParen.trim());
		} else if (inParen) {
			currentParen += char;
		} else {
			mainLine += char;
		}
	}

	const main = normalize(mainLine);
	const background = backgroundVocals.map(normalize).filter(Boolean).join(", ");
	const output = background
		? main
			? main + "\n<" + background.charAt(0).toUpperCase() + background.slice(1)
			: "<" + background.charAt(0).toUpperCase() + background.slice(1)
		: main;
	return escapeSpaces ? output.replace(/ /g, "\\ \\") : output;
};
