import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const generateReleaseNotes = (releases, version) => {
	const data = typeof releases === "string" ? JSON.parse(releases) : releases;
	const release = data.find((item) => item.version === version);
	if (!release?.entries.length) return null;
	return release.entries
		.map(
			({ title, body }) =>
				"- **" +
				title +
				(body ? ":" : "") +
				"**" +
				(body ? ` ${body.replace(/\s*\n\s*/g, " ")}` : ""),
		)
		.join("\n");
};

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const readArgument = (name) => {
		const index = process.argv.indexOf(name);
		return index === -1 ? undefined : process.argv[index + 1];
	};
	const version = readArgument("--version");
	const outputPath = readArgument("--output");
	// --changelog is accepted but ignored for existing release workflow callers.
	if (!version) {
		console.error(
			"Usage: node scripts/generate-release-notes.mjs --version X.Y.Z [--output file]",
		);
		process.exitCode = 1;
	} else {
		const notes = generateReleaseNotes(
			readFileSync(
				new URL("../src/data/changelog.json", import.meta.url),
				"utf8",
			),
			version,
		);
		if (!notes) {
			console.warn(`No readable changelog entry found for v${version}.`);
			process.exitCode = 2;
		} else if (outputPath) {
			mkdirSync(dirname(resolve(outputPath)), { recursive: true });
			writeFileSync(outputPath, `${notes}\n`);
			console.log(`Generated release notes for v${version}.`);
		} else console.log(notes);
	}
}
