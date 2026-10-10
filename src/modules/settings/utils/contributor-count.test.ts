import { afterEach, describe, expect, it, vi } from "vitest";
import {
	fetchContributors,
	resetContributorRequestForTests,
} from "./contributor-count";

const githubAuthor = (id: number, login: string, contributionsIgnored = 0) => ({
	id,
	login,
	avatar_url: `https://avatars.example/${login}`,
	html_url: `https://github.com/${login}`,
	contributions: contributionsIgnored,
});

describe("fetchContributors", () => {
	afterEach(() => {
		resetContributorRequestForTests();
		vi.unstubAllGlobals();
	});

	it("loads every fork-history page and counts commits by GitHub author", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						commits: [
							{ author: githubAuthor(1, "first") },
							{ author: githubAuthor(2, "second") },
						],
					}),
					{
						headers: {
							link: '<https://api.github.com/next-page>; rel="next"',
						},
					},
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						commits: [{ author: githubAuthor(1, "first") }],
					}),
				),
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(fetchContributors()).resolves.toEqual([
			{
				login: "first",
				avatarUrl: "https://avatars.example/first",
				profileUrl: "https://github.com/first",
				contributions: 2,
			},
			{
				login: "second",
				avatarUrl: "https://avatars.example/second",
				profileUrl: "https://github.com/second",
				contributions: 1,
			},
		]);
		expect(fetchMock).toHaveBeenLastCalledWith(
			"https://api.github.com/next-page",
			expect.any(Object),
		);
	});

	it("omits inherited identities, maintainers, and commits without profiles", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						commits: [
							{ author: githubAuthor(1, "valid") },
							{ author: githubAuthor(39_523_898, "Steve-xmh") },
							{ author: githubAuthor(191_877_009, "NaeNaeTart") },
							{ author: githubAuthor(55_551_133, "TheX24") },
							{ author: githubAuthor(3, "invalid-email-address") },
							{ author: null },
						],
					}),
				),
			),
		);

		const contributors = await fetchContributors();
		expect(contributors).toHaveLength(1);
		expect(contributors[0].login).toBe("valid");
	});

	it("shares one live request within an app session", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ commits: [] })));
		vi.stubGlobal("fetch", fetchMock);

		await Promise.all([fetchContributors(), fetchContributors()]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("uses the fork-only snapshot when GitHub rate limits the request", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response("rate limited", { status: 403 }));
		vi.stubGlobal("fetch", fetchMock);

		const contributors = await fetchContributors();
		expect(contributors.map(({ login }) => login)).toEqual([
			"VictorGugug",
			"olafix52",
			"bobjoerules",
			"remiuku",
			"Stormanzanii",
			"Tman564wsGithub",
			"lastforathousandyears",
		]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
