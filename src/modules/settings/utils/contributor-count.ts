import contributors from "$/data/contributors.json";

export interface RepositoryContributor {
	login: string;
	avatarUrl: string;
	profileUrl: string;
	contributions: number;
}

/**
 * Everyone with commits on main since the fork, most commits first. Generated
 * at release by `pnpm contributors:update` (scripts/generate-contributors.mjs),
 * so the About tab makes no network request: the GitHub fork history is
 * several megabytes and would use up the unauthenticated rate limit.
 */
export function getContributors(): readonly RepositoryContributor[] {
	return contributors;
}
