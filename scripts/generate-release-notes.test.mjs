import { describe, expect, it } from "vitest";
import { generateReleaseNotes } from "./generate-release-notes.mjs";

const changelog = `
<Box>
  <Heading>v0.7.3 Updates</Heading>
  <Flex>
    <Text><strong>Desktop Update Fix:</strong> Use <code>latest.json</code> for updates.</Text>
    <Text><strong>Formatting:</strong> Keep <em>important</em> notes readable.</Text>
  </Flex>
</Box>`;

describe("generateReleaseNotes", () => {
	it("converts the matching changelog section to Markdown", () => {
		expect(generateReleaseNotes(changelog, "0.7.3")).toBe(
			"- **Desktop Update Fix:** Use `latest.json` for updates.\n- **Formatting:** Keep *important* notes readable.",
		);
	});

	it("returns null when the tagged version is missing", () => {
		expect(generateReleaseNotes(changelog, "0.7.4")).toBeNull();
	});

	it("returns null when a changelog entry has an unreadable expression", () => {
		expect(
			generateReleaseNotes(
				"<Box><Heading>v0.7.3 Updates</Heading><Flex><Text>{notes}</Text></Flex></Box>",
				"0.7.3",
			),
		).toBeNull();
	});
});
