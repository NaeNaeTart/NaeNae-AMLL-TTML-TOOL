const CONTRIBUTORS_API_URL =
	"https://api.github.com/repos/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/contributors?anon=true&per_page=1";

function getLastPage(linkHeader: string | null) {
	if (!linkHeader) return null;
	for (const link of linkHeader.split(",")) {
		if (!link.includes('rel="last"')) continue;
		const urlMatch = link.match(/<([^>]+)>/);
		if (!urlMatch) return null;
		const page = Number(new URL(urlMatch[1]).searchParams.get("page"));
		return Number.isSafeInteger(page) && page >= 0 ? page : null;
	}
	return null;
}

export async function fetchContributorCount(signal?: AbortSignal) {
	const response = await fetch(CONTRIBUTORS_API_URL, {
		signal,
		cache: "no-store",
		headers: {
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});
	if (!response.ok) {
		throw new Error(`GitHub contributors request failed: ${response.status}`);
	}

	const contributors: unknown = await response.json();
	if (!Array.isArray(contributors)) {
		throw new Error("GitHub contributors response was not an array");
	}

	return getLastPage(response.headers.get("link")) ?? contributors.length;
}
