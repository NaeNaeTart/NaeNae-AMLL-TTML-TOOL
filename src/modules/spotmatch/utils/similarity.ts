import type {
	SpotifyTrack,
	SpotMatchCandidate,
	SpotMatchOptions,
	SpotMatchPresetKey,
} from "../types";

export const TRACK_ID_RE =
	/(?:spotify:track:|open\.spotify\.com\/track\/)?([A-Za-z0-9]{22})/;

export function extractTrackId(value: string): string | null {
	if (!value) return null;
	const match = value.trim().match(TRACK_ID_RE);
	return match ? match[1] : null;
}

export function normalize(value: string): string {
	if (!value) return "";
	// NFKD normalization + strip diacritics
	const unaccented = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
	// Case fold & replace '&' with 'and'
	const lower = unaccented.toLowerCase().replace(/&/g, " and ");
	// Extract alphanumeric words
	const words = lower.match(/[a-z0-9]+/g);
	return words ? words.join(" ") : "";
}

/**
 * Calculates Gestalt pattern matching / Ratcliff-Obershelp similarity ratio
 * matching Python's `difflib.SequenceMatcher.ratio()`.
 */
export function sequenceMatcherRatio(left: string, right: string): number {
	if (left === right) return 1.0;
	if (left.length === 0 || right.length === 0) return 0.0;

	// Recursive longest common contiguous substring matching
	function getMatchingLength(
		a: string,
		aStart: number,
		aEnd: number,
		b: string,
		bStart: number,
		bEnd: number,
	): number {
		if (aStart >= aEnd || bStart >= bEnd) return 0;

		let maxLen = 0;
		let bestA = aStart;
		let bestB = bStart;

		for (let i = aStart; i < aEnd; i++) {
			for (let j = bStart; j < bEnd; j++) {
				let k = 0;
				while (
					i + k < aEnd &&
					j + k < bEnd &&
					a.charCodeAt(i + k) === b.charCodeAt(j + k)
				) {
					k++;
				}
				if (k > maxLen) {
					maxLen = k;
					bestA = i;
					bestB = j;
				}
			}
		}

		if (maxLen === 0) return 0;

		let total = maxLen;
		// Recurse left
		total += getMatchingLength(a, aStart, bestA, b, bStart, bestB);
		// Recurse right
		total += getMatchingLength(
			a,
			bestA + maxLen,
			aEnd,
			b,
			bestB + maxLen,
			bEnd,
		);

		return total;
	}

	const matchingLength = getMatchingLength(
		left,
		0,
		left.length,
		right,
		0,
		right.length,
	);
	return (2.0 * matchingLength) / (left.length + right.length);
}

export function similarity(left: string, right: string): number {
	return sequenceMatcherRatio(normalize(left), normalize(right));
}

export function formatDuration(
	milliseconds: number | null | undefined,
): string {
	const totalSeconds = Math.round((milliseconds || 0) / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function scoreCandidate(
	source: SpotifyTrack,
	candidate: SpotifyTrack,
	albumName?: string,
): SpotMatchCandidate {
	const sourceArtists = source.artists.map((a) => a.name).join(", ");
	const candidateArtists = candidate.artists.map((a) => a.name).join(", ");

	const titleScore = similarity(source.name, candidate.name);
	const artistScore = similarity(sourceArtists, candidateArtists);
	const delta = Math.abs(
		(source.duration_ms || 0) - (candidate.duration_ms || 0),
	);
	const durationScore = Math.max(0.0, 1.0 - delta / 15000);

	const score = Math.round(
		100 * (titleScore * 0.55 + artistScore * 0.3 + durationScore * 0.15),
	);

	const coverUrl =
		candidate.album?.images?.[0]?.url ||
		candidate.album?.images?.[1]?.url ||
		undefined;

	return {
		track_id: candidate.id,
		title: candidate.name,
		artists: candidateArtists,
		album: albumName || candidate.album?.name || "Unknown album",
		cover_url: coverUrl,
		duration_ms: candidate.duration_ms || 0,
		score,
		duration_delta_ms: delta,
		spotify_url:
			candidate.external_urls?.spotify ||
			`https://open.spotify.com/track/${candidate.id}`,
	};
}

export const PRESETS: Record<
	SpotMatchPresetKey,
	Omit<SpotMatchOptions, "preset">
> = {
	Quick: {
		minimum_score: 60,
		maximum_duration_seconds: 10,
		exact_title: false,
		search_pages: 1,
		search_repeats: 1,
		releases_per_artist: 0,
		global_albums: 0,
		global_playlists: 0,
		tracks_per_playlist: 0,
		minimum_title_similarity: 58,
		variant_queries: false,
	},
	Balanced: {
		minimum_score: 60,
		maximum_duration_seconds: 10,
		exact_title: false,
		search_pages: 1,
		search_repeats: 2,
		releases_per_artist: 50,
		global_albums: 0,
		global_playlists: 0,
		tracks_per_playlist: 0,
		minimum_title_similarity: 58,
		variant_queries: false,
	},
	Deep: {
		minimum_score: 60,
		maximum_duration_seconds: 10,
		exact_title: false,
		search_pages: 1,
		search_repeats: 3,
		releases_per_artist: 200,
		global_albums: 0,
		global_playlists: 0,
		tracks_per_playlist: 0,
		minimum_title_similarity: 58,
		variant_queries: false,
	},
	Exhaustive: {
		minimum_score: 60,
		maximum_duration_seconds: 10,
		exact_title: false,
		search_pages: 20,
		search_repeats: 3,
		releases_per_artist: 200,
		global_albums: 150,
		global_playlists: 60,
		tracks_per_playlist: 500,
		minimum_title_similarity: 58,
		variant_queries: true,
	},
};
