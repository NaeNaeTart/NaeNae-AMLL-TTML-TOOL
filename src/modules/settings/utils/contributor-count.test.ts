import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchContributorCount } from "./contributor-count";

describe("fetchContributorCount", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("reads the total from GitHub's last pagination link", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response('[{"login":"first"}]', {
					headers: {
						link: [
							'<https://api.github.com/repositories/1/contributors?anon=true&per_page=1&page=2>; rel="next"',
							'<https://api.github.com/repositories/1/contributors?anon=true&per_page=1&page=37>; rel="last"',
						].join(", "),
					},
				}),
			),
		);

		await expect(fetchContributorCount()).resolves.toBe(37);
	});

	it("uses the response length when pagination is unnecessary", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response('[{"login":"only"}]')),
		);

		await expect(fetchContributorCount()).resolves.toBe(1);
	});

	it("rejects failed GitHub responses", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("rate limited", { status: 403 })),
		);

		await expect(fetchContributorCount()).rejects.toThrow(
			"GitHub contributors request failed: 403",
		);
	});
});
