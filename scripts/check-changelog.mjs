import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function needsChangeNote(changed, added, labels) {
	return (
		!labels.some((label) => label.name === "no-changelog") &&
		changed.some((file) => /^(src|src-tauri)\//.test(file)) &&
		!added.some(
			(file) =>
				/^changes\/[^/]+\.md$/.test(file) && file !== "changes/README.md",
		)
	);
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const { pull_request: pr } = JSON.parse(
		readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"),
	);
	const diff = (filter) =>
		execFileSync(
			"git",
			[
				"diff",
				"--name-only",
				"-z",
				...filter,
				`${pr.base.sha}...${pr.head.sha}`,
			],
			{ encoding: "utf8" },
		)
			.split("\0")
			.filter(Boolean);
	if (needsChangeNote(diff([]), diff(["--diff-filter=A"]), pr.labels)) {
		console.error(
			"Add changes/<short-slug>.md with type, impact (1-5), highlight, and a user-facing title (see changes/README.md). If this PR has no user-visible changes, apply the no-changelog label.",
		);
		process.exitCode = 1;
	} else console.log("Changelog check passed.");
}
