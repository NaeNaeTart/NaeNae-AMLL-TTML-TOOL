import { describe, expect, it } from "vitest";
import { generateReleaseNotes } from "./generate-release-notes.mjs";

const changelog = [
	{
		version: "0.7.3",
		entries: [
			{
				type: "fix",
				title: "Desktop Update Fix",
				body: "Use \x60latest.json\x60 for updates.",
			},
			{
				type: "feature",
				title: "Formatting",
				body: "Keep **important** notes readable.\nAnd [links](https://example.com).",
			},
			{ type: "fix", title: "Title only" },
		],
	},
	{ version: "0.7.30", entries: [{ title: "Another release" }] },
];
describe("generateReleaseNotes", () => {
	it("renders the exact matching JSON release as Markdown", () => {
		expect(generateReleaseNotes(changelog, "0.7.3")).toBe(
			"- **Desktop Update Fix:** Use \x60latest.json\x60 for updates.\n- **Formatting:** Keep **important** notes readable. And [links](https://example.com).\n- **Title only**",
		);
		expect(generateReleaseNotes(JSON.stringify(changelog), "0.7.3")).toBe(
			generateReleaseNotes(changelog, "0.7.3"),
		);
	});
	it("returns null for a missing or empty release", () => {
		expect(generateReleaseNotes(changelog, "0.7.4")).toBeNull();
		expect(
			generateReleaseNotes([{ version: "0.7.4", entries: [] }], "0.7.4"),
		).toBeNull();
	});
});
