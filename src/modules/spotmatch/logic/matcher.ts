import { SpotifyApiClient, type SpotifyAuthCredentials } from "../api/client";
import type {
	SpotifyTrack,
	SpotMatchCandidate,
	SpotMatchOptions,
} from "../types";
import {
	extractTrackId,
	scoreCandidate,
	similarity,
} from "../utils/similarity";

export type MatcherProgressCallback = (
	message: string,
	current: number,
	total: number,
) => void;

export interface FindMatchesResult {
	source: SpotifyTrack;
	matches: SpotMatchCandidate[];
	totalQueried: number;
}

export async function findMatches(
	sourceInput: string,
	options: SpotMatchOptions,
	progress?: MatcherProgressCallback,
	credentials?: SpotifyAuthCredentials,
): Promise<FindMatchesResult> {
	let source: SpotifyTrack | null = null;
	const trackId = extractTrackId(sourceInput);

	if (trackId) {
		progress?.("Reading source track...", 0, 1);
		try {
			source = await SpotifyApiClient.getTrack(trackId, credentials);
		} catch (err: unknown) {
			console.warn(
				`getTrack failed for ID "${trackId}", trying search fallback:`,
				err,
			);
			const searchRes = await SpotifyApiClient.searchTracks(sourceInput, {
				limit: 1,
				credentials,
			});
			if (searchRes.tracks.length > 0) {
				source = searchRes.tracks[0];
			} else {
				throw new Error(
					`Spotify track ID "${trackId}" was not found (404). Please verify the Spotify track URL or ID.`,
				);
			}
		}
		progress?.("Reading source track...", 1, 1);
	} else {
		// Treat input as search query to find the source track
		progress?.("Searching for source track...", 0, 1);
		const searchRes = await SpotifyApiClient.searchTracks(sourceInput, {
			limit: 1,
			credentials,
		});
		if (searchRes.tracks.length === 0) {
			throw new Error("No source track found with the provided input.");
		}
		source = searchRes.tracks[0];
		progress?.("Reading source track...", 1, 1);
	}

	const artistNames = source.artists.map((a) => a.name).join(" ");
	const primaryArtist = source.artists[0]?.name || "";
	const albumName = source.album?.name || "";

	const baseQueries = [
		source.name,
		`${source.name} ${primaryArtist}`,
		`${source.name} ${artistNames}`,
		`${source.name} ${albumName}`,
	];

	const variantTerms = [
		"cover",
		"remix",
		"instrumental",
		"live",
		"remaster",
		"karaoke",
		"sped up",
		"slowed",
	];

	const allQueriesList: string[] = [
		...baseQueries,
		...(options.variant_queries
			? variantTerms.map((term) => `${source?.name} ${term}`)
			: []),
	];

	// Deduplicate non-empty queries preserving order
	const queries = Array.from(
		new Set(allQueriesList.map((q) => q.trim()).filter(Boolean)),
	);

	const candidates = new Map<string, SpotMatchCandidate>();
	let totalQueried = 0;

	// 1. Text searches
	const repeats = Math.min(queries.length, options.search_repeats);
	for (let i = 0; i < repeats; i++) {
		const q = queries[i];
		progress?.(
			`Search pass (${i + 1}/${repeats}): "${q}"`,
			i + 1,
			repeats + options.releases_per_artist + 2,
		);
		for (let page = 0; page < options.search_pages; page++) {
			const offset = page * 50;
			try {
				const res = await SpotifyApiClient.searchTracks(q, {
					offset,
					limit: 50,
					credentials,
				});
				totalQueried += res.tracks.length;
				for (const track of res.tracks) {
					if (!track || track.id === source.id) continue;
					if (candidates.has(track.id)) continue;
					candidates.set(track.id, scoreCandidate(source, track));
				}
				if (res.tracks.length < 50) break;
			} catch (e) {
				console.warn(`Search page ${page} failed for query "${q}":`, e);
				break;
			}
		}
	}

	// 2. Artist releases (discography)
	if (options.releases_per_artist > 0) {
		const releaseArtists = source.artists.slice(0, 3);
		const discoveredAlbumIds = new Set<string>();

		for (let i = 0; i < releaseArtists.length; i++) {
			const artist = releaseArtists[i];
			progress?.(
				`Reading credited-artist discographies (${i + 1}/${releaseArtists.length})`,
				i + 1,
				releaseArtists.length,
			);
			try {
				const albumIds = await SpotifyApiClient.getArtistDiscography(
					artist.id,
					options.releases_per_artist,
					credentials,
				);
				for (const id of albumIds) {
					discoveredAlbumIds.add(id);
				}
			} catch (e) {
				console.warn(`Discography fetch failed for ${artist.name}:`, e);
			}
		}

		const albumIdList = Array.from(discoveredAlbumIds).slice(
			0,
			options.releases_per_artist,
		);
		for (let i = 0; i < albumIdList.length; i++) {
			const albId = albumIdList[i];
			progress?.(
				`Reading albums (${i + 1}/${albumIdList.length})`,
				i + 1,
				albumIdList.length,
			);
			try {
				const albumTracks = await SpotifyApiClient.getAlbumTracks(
					albId,
					credentials,
				);
				totalQueried += albumTracks.length;
				for (const track of albumTracks) {
					if (!track || track.id === source.id) continue;
					if (candidates.has(track.id)) continue;
					candidates.set(track.id, scoreCandidate(source, track));
				}
			} catch (e) {
				console.warn(`Album fetch failed for ${albId}:`, e);
			}
		}
	}

	// 3. Global albums & playlists if requested
	if (options.global_albums > 0) {
		progress?.("Searching global albums...", 1, 2);
		try {
			const globalAlbumIds = await SpotifyApiClient.searchAlbums(
				`${source.name} ${primaryArtist}`,
				options.global_albums,
				credentials,
			);
			for (const albId of globalAlbumIds) {
				const albTracks = await SpotifyApiClient.getAlbumTracks(
					albId,
					credentials,
				);
				totalQueried += albTracks.length;
				for (const track of albTracks) {
					if (!track || track.id === source.id) continue;
					if (candidates.has(track.id)) continue;
					candidates.set(track.id, scoreCandidate(source, track));
				}
			}
		} catch (e) {
			console.warn("Global albums search failed:", e);
		}
	}

	// Filter and rank matches
	const maxDurationDeltaMs = options.maximum_duration_seconds * 1000;
	const titleFloorRatio = options.minimum_title_similarity / 100;

	const filteredMatches = Array.from(candidates.values())
		.filter((candidate) => {
			if (candidate.score < options.minimum_score) return false;
			if (candidate.duration_delta_ms > maxDurationDeltaMs) return false;
			const titleSim = similarity(source?.name || "", candidate.title);
			if (titleSim < titleFloorRatio) return false;
			if (options.exact_title && titleSim < 0.99) return false;
			return true;
		})
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return a.duration_delta_ms - b.duration_delta_ms;
		})
		.slice(0, 100);

	return {
		source,
		matches: filteredMatches,
		totalQueried,
	};
}
