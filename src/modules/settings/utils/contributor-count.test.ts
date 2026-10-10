import { describe, expect, it } from "vitest";
import { getContributors } from "./contributor-count";

describe("getContributors", () => {
	it("ships a generated list sorted by contributions", () => {
		const contributors = getContributors();
		expect(contributors.length).toBeGreaterThan(0);
		for (const contributor of contributors) {
			expect(contributor.login).not.toBe("");
			expect(contributor.profileUrl).toBe(
				`https://github.com/${contributor.login}`,
			);
			expect(contributor.contributions).toBeGreaterThan(0);
		}
		const counts = contributors.map((c) => c.contributions);
		expect(counts).toEqual([...counts].sort((a, b) => b - a));
	});
});
