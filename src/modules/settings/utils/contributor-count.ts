const FORK_POINT = "5d0e3387f013f4dbfdc0d0d6111bca8a74fd9449";
const FORK_MAIN_COMPARE_API_URL = `https://api.github.com/repos/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/compare/${FORK_POINT}...main?per_page=100&page=1`;
const EXCLUDED_CONTRIBUTOR_IDS = new Set([39_523_898, 191_877_009, 55_551_133]);
const EXCLUDED_CONTRIBUTOR_LOGINS = new Set(["invalid-email-address"]);
const CONTRIBUTOR_CACHE_KEY = "fork-main-contributors-v2";
const LIVE_CACHE_DURATION = 60 * 60 * 1000;
const FALLBACK_CACHE_DURATION = 5 * 60 * 1000;

interface GitHubUser {
	id?: unknown;
	login?: unknown;
	avatar_url?: unknown;
	html_url?: unknown;
}

interface GitHubCommit {
	author?: GitHubUser | null;
}

export interface RepositoryContributor {
	login: string;
	avatarUrl: string;
	profileUrl: string;
	contributions: number;
}

// This snapshot keeps the About dialog useful when GitHub's unauthenticated
// API limit is exhausted. Successful API responses replace it in local storage.
const FALLBACK_CONTRIBUTORS: RepositoryContributor[] = [
	["VictorGugug", 24],
	["olafix52", 6],
	["bobjoerules", 5],
	["remiuku", 5],
	["Stormanzanii", 4],
	["Tman564wsGithub", 1],
	["lastforathousandyears", 1],
].map(([login, contributions]) => ({
	login: login as string,
	avatarUrl: `https://github.com/${login}.png?size=64`,
	profileUrl: `https://github.com/${login}`,
	contributions: contributions as number,
}));

interface ContributorCache {
	expiresAt: number;
	contributors: RepositoryContributor[];
}

let contributorRequest: Promise<RepositoryContributor[]> | null = null;

function isContributor(value: unknown): value is RepositoryContributor {
	return (
		typeof value === "object" &&
		value !== null &&
		"login" in value &&
		typeof value.login === "string" &&
		"avatarUrl" in value &&
		typeof value.avatarUrl === "string" &&
		"profileUrl" in value &&
		typeof value.profileUrl === "string" &&
		"contributions" in value &&
		typeof value.contributions === "number"
	);
}

function readCachedContributors() {
	try {
		const stored = localStorage.getItem(CONTRIBUTOR_CACHE_KEY);
		if (!stored) return null;
		const value: unknown = JSON.parse(stored);
		if (
			typeof value !== "object" ||
			value === null ||
			!("expiresAt" in value) ||
			typeof value.expiresAt !== "number" ||
			value.expiresAt <= Date.now() ||
			!("contributors" in value) ||
			!Array.isArray(value.contributors) ||
			!value.contributors.every(isContributor)
		) {
			localStorage.removeItem(CONTRIBUTOR_CACHE_KEY);
			return null;
		}
		return value.contributors;
	} catch {
		return null;
	}
}

function writeCachedContributors(
	contributors: RepositoryContributor[],
	duration: number,
) {
	try {
		const value: ContributorCache = {
			expiresAt: Date.now() + duration,
			contributors,
		};
		localStorage.setItem(CONTRIBUTOR_CACHE_KEY, JSON.stringify(value));
	} catch {
		// Local storage can be unavailable in private or restricted webviews.
	}
}

function getNextPage(linkHeader: string | null) {
	if (!linkHeader) return null;
	for (const link of linkHeader.split(",")) {
		if (!link.includes('rel="next"')) continue;
		return link.match(/<([^>]+)>/)?.[1] ?? null;
	}
	return null;
}

function parseGitHubUser(value: GitHubUser) {
	if (
		typeof value.id !== "number" ||
		typeof value.login !== "string" ||
		typeof value.avatar_url !== "string" ||
		typeof value.html_url !== "string"
	) {
		return null;
	}
	return {
		id: value.id,
		login: value.login,
		avatarUrl: value.avatar_url,
		profileUrl: value.html_url,
	};
}

async function loadContributors() {
	const contributors = new Map<number, RepositoryContributor>();
	let nextPage: string | null = FORK_MAIN_COMPARE_API_URL;

	while (nextPage) {
		const response = await fetch(nextPage, {
			cache: "no-store",
			headers: {
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});
		if (!response.ok) {
			throw new Error(`GitHub fork history request failed: ${response.status}`);
		}

		const comparison: unknown = await response.json();
		if (
			typeof comparison !== "object" ||
			comparison === null ||
			!("commits" in comparison) ||
			!Array.isArray(comparison.commits)
		) {
			throw new Error("GitHub fork history response had no commit list");
		}

		for (const value of comparison.commits as GitHubCommit[]) {
			if (!value.author) continue;
			const author = parseGitHubUser(value.author);
			if (
				!author ||
				EXCLUDED_CONTRIBUTOR_IDS.has(author.id) ||
				EXCLUDED_CONTRIBUTOR_LOGINS.has(author.login.toLowerCase())
			) {
				continue;
			}
			const existing = contributors.get(author.id);
			if (existing) {
				existing.contributions++;
			} else {
				contributors.set(author.id, {
					login: author.login,
					avatarUrl: author.avatarUrl,
					profileUrl: author.profileUrl,
					contributions: 1,
				});
			}
		}
		nextPage = getNextPage(response.headers.get("link"));
	}

	return [...contributors.values()].sort(
		(left, right) =>
			right.contributions - left.contributions ||
			left.login.localeCompare(right.login),
	);
}

export function fetchContributors() {
	contributorRequest ??= (async () => {
		const cached = readCachedContributors();
		if (cached) return cached;

		try {
			const contributors = await loadContributors();
			writeCachedContributors(contributors, LIVE_CACHE_DURATION);
			return contributors;
		} catch {
			const fallback = FALLBACK_CONTRIBUTORS.map((contributor) => ({
				...contributor,
			}));
			writeCachedContributors(fallback, FALLBACK_CACHE_DURATION);
			return fallback;
		}
	})();
	return contributorRequest;
}

export function resetContributorRequestForTests() {
	contributorRequest = null;
	try {
		localStorage.removeItem(CONTRIBUTOR_CACHE_KEY);
	} catch {
		// Test environments do not always provide local storage.
	}
}
