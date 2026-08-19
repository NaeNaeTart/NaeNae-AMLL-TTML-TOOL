import type { SpotifyTrack } from "../types";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export interface SpotifyAuthCredentials {
	clientId?: string;
	clientSecret?: string;
	accessToken?: string;
}

const DEFAULT_BOOTSTRAP_ID = "4uLU6hMCjMI75M1A2tKUQC";
const SEARCH_SHA256 =
	"eff59fa0a3d026b88b56fddbcf4bdfa16a186b8175a5c1a358c072e053c2e5b0";
const GET_TRACK_SHA256 =
	"612585ae06ba435ad26369870deaae23b5c8800a256cd8a57e08eddc25a37294";

/**
 * Universal text fetcher supporting direct fetch, local Vite proxy, and CORS fallbacks.
 */
async function fetchTextWithFallback(
	url: string,
	init?: RequestInit,
	localProxyPath?: string,
): Promise<string> {
	// 1. Try local proxy first if available (avoids browser CORS restrictions completely)
	if (typeof window !== "undefined" && localProxyPath) {
		const isHttp =
			window.location && window.location.protocol.startsWith("http");
		if (isHttp) {
			try {
				const proxyRes = await fetch(localProxyPath, init);
				if (proxyRes.ok || proxyRes.status === 404) {
					return await proxyRes.text();
				}
			} catch {
				// Fall through
			}
		}
	}

	// 2. Direct fetch
	try {
		const directRes = await fetch(url, init);
		if (directRes.ok || directRes.status === 404) {
			return await directRes.text();
		}
	} catch (err) {
		console.warn(`Direct fetch to ${url} failed:`, err);
	}

	// 3. CORS Proxies as fallback
	const corsProxies = [
		(u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
		(u: string) =>
			`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
	];

	for (const proxyFn of corsProxies) {
		try {
			const proxyUrl = proxyFn(url);
			const proxyResponse = await fetch(proxyUrl, init);
			if (proxyResponse.ok || proxyResponse.status === 404) {
				return await proxyResponse.text();
			}
		} catch {
			// Try next proxy
		}
	}

	throw new Error(
		`Failed to fetch from ${url}. Check internet connection or CORS settings.`,
	);
}

/**
 * Extract track metadata and/or anonymous token from Spotify's public embed page.
 */
async function fetchEmbedData(trackId = DEFAULT_BOOTSTRAP_ID): Promise<{
	track?: SpotifyTrack;
	token?: string;
	expiresAt?: number;
}> {
	const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
	const localPath = `/api/spotify-embed/track/${trackId}`;

	const html = await fetchTextWithFallback(embedUrl, undefined, localPath);
	const match = html.match(
		/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
	);
	if (!match) {
		throw new Error("Unable to parse Spotify embed page data.");
	}

	let data: any;
	try {
		data = JSON.parse(match[1]);
	} catch (e) {
		throw new Error("Malformed JSON in Spotify embed page.");
	}

	const pageProps = data?.props?.pageProps;
	if (pageProps?.status === 404 || pageProps?.status === 400) {
		throw new Error(`Spotify track ID "${trackId}" not found (404).`);
	}

	const state = pageProps?.state;
	const entity = state?.data?.entity;
	const session = state?.data?.session || state?.settings?.session;

	const token = session?.accessToken;
	const expiresAt = session?.accessTokenExpirationTimestampMs;

	if (token && expiresAt) {
		cachedToken = token;
		tokenExpiresAt = expiresAt;
	}

	let track: SpotifyTrack | undefined;
	if (entity && entity.name) {
		track = {
			id: entity.id || trackId,
			name: entity.name,
			artists: (entity.artists || []).map((a: any) => ({
				id: a.uri ? a.uri.split(":").pop() || "" : "",
				name: a.name,
			})),
			duration_ms: entity.duration || 0,
			album: {
				id: "",
				name: "",
				images: (entity.visualIdentity?.image || []).map((img: any) => ({
					url: img.url || "",
					height: img.maxHeight || 300,
					width: img.maxWidth || 300,
				})),
			},
			external_urls: {
				spotify: `https://open.spotify.com/track/${trackId}`,
			},
		};
	}

	return { track, token, expiresAt };
}

export const SpotifyApiClient = {
	/**
	 * Gets an access token. If no credentials given, bootstraps an anonymous token from Spotify's embed page.
	 */
	async getAccessToken(credentials?: SpotifyAuthCredentials): Promise<string> {
		if (credentials?.accessToken && credentials.accessToken.trim()) {
			return credentials.accessToken.trim();
		}

		const now = Date.now();
		if (cachedToken && tokenExpiresAt > now + 60000) {
			return cachedToken;
		}

		// 1. If user provided Client ID & Client Secret, use Developer API token flow
		if (
			credentials?.clientId &&
			credentials?.clientSecret &&
			credentials.clientId.trim() &&
			credentials.clientSecret.trim()
		) {
			const clientId = credentials.clientId.trim();
			const clientSecret = credentials.clientSecret.trim();

			const body = new URLSearchParams({
				grant_type: "client_credentials",
			});

			const authHeader =
				typeof btoa === "function"
					? btoa(`${clientId}:${clientSecret}`)
					: Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

			const res = await fetch("https://accounts.spotify.com/api/token", {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Authorization: `Basic ${authHeader}`,
				},
				body: body.toString(),
			});

			if (res.ok) {
				const data = (await res.json()) as {
					access_token: string;
					expires_in: number;
				};
				cachedToken = data.access_token;
				tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
				return cachedToken;
			}
		}

		// 2. Anonymous token bootstrap from embed page (Identical to SpotMatch / SpotifyScraper)
		try {
			const { token } = await fetchEmbedData(DEFAULT_BOOTSTRAP_ID);
			if (token) {
				return token;
			}
		} catch (err) {
			console.warn("Embed token bootstrap failed, trying fallback:", err);
		}

		if (cachedToken) return cachedToken;
		throw new Error(
			"Unable to retrieve Spotify session. Please check your internet connection.",
		);
	},

	/**
	 * Fetch a Spotify track by ID.
	 * First tries public embed page (no auth/rate limits), then falls back to Pathfinder GraphQL / Web API.
	 */
	async getTrack(
		trackId: string,
		credentials?: SpotifyAuthCredentials,
	): Promise<SpotifyTrack> {
		// 1. If no custom developer credentials, get track directly from public Embed page (zero auth needed!)
		if (!credentials?.clientId && !credentials?.accessToken) {
			try {
				const embedResult = await fetchEmbedData(trackId);
				if (embedResult.track) {
					return embedResult.track;
				}
			} catch (e: any) {
				if (e.message?.includes("404")) {
					throw e;
				}
				console.warn("Embed track fetch fallback to Pathfinder GraphQL:", e);
			}
		}

		// 2. Try Pathfinder GraphQL getTrack
		try {
			const token = await this.getAccessToken(credentials);
			const variables = JSON.stringify({ uri: `spotify:track:${trackId}` });
			const extensions = JSON.stringify({
				persistedQuery: {
					version: 1,
					sha256Hash: GET_TRACK_SHA256,
				},
			});

			const queryUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=getTrack&variables=${encodeURIComponent(
				variables,
			)}&extensions=${encodeURIComponent(extensions)}`;
			const localPath = `/api/spotify-pathfinder/v1/query?operationName=getTrack&variables=${encodeURIComponent(
				variables,
			)}&extensions=${encodeURIComponent(extensions)}`;

			const text = await fetchTextWithFallback(
				queryUrl,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						"App-Platform": "WebPlayer",
					},
				},
				localPath,
			);

			const json = JSON.parse(text);
			const trackUnion = json?.data?.trackUnion;
			if (trackUnion && trackUnion.name) {
				const artists =
					trackUnion.firstArtist?.items?.map((a: any) => ({
						id: a.uri ? a.uri.split(":").pop() || "" : "",
						name: a.profile?.name || a.name || "",
					})) ||
					(trackUnion.otherArtists?.items || []).map((a: any) => ({
						id: a.uri ? a.uri.split(":").pop() || "" : "",
						name: a.profile?.name || a.name || "",
					})) ||
					[];

				return {
					id: trackUnion.id || trackId,
					name: trackUnion.name,
					artists:
						artists.length > 0 ? artists : [{ id: "", name: "Unknown Artist" }],
					duration_ms: trackUnion.duration?.totalMilliseconds || 0,
					album: {
						id: trackUnion.albumOfTrack?.uri
							? trackUnion.albumOfTrack.uri.split(":").pop() || ""
							: "",
						name: trackUnion.albumOfTrack?.name || "",
						images: (trackUnion.albumOfTrack?.coverArt?.sources || []).map(
							(s: any) => ({
								url: s.url,
								height: s.height,
								width: s.width,
							}),
						),
					},
					external_urls: {
						spotify: `https://open.spotify.com/track/${trackId}`,
					},
				};
			}
		} catch (err) {
			console.warn("Pathfinder getTrack failed, falling back to Web API:", err);
		}

		// 3. Fallback to official Web API
		const token = await this.getAccessToken(credentials);
		const webApiUrl = `https://api.spotify.com/v1/tracks/${trackId}`;
		const localWebApi = `/api/spotify-api/v1/tracks/${trackId}`;
		const resText = await fetchTextWithFallback(
			webApiUrl,
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
			},
			localWebApi,
		);

		return JSON.parse(resText) as SpotifyTrack;
	},

	/**
	 * Search for tracks on Spotify using Pathfinder GraphQL (searchDesktop) or Web API.
	 */
	async searchTracks(
		query: string,
		options: {
			limit?: number;
			offset?: number;
			credentials?: SpotifyAuthCredentials;
		} = {},
	): Promise<{ tracks: SpotifyTrack[]; total: number }> {
		if (!query.trim()) return { tracks: [], total: 0 };
		const limit = options.limit || 50;
		const offset = options.offset || 0;
		const token = await this.getAccessToken(options.credentials);

		// 1. Pathfinder GraphQL searchDesktop (no Premium needed, same as Spotify Web Player and SpotMatch desktop)
		try {
			const variables = JSON.stringify({
				searchTerm: query,
				offset,
				limit,
				numberOfTopResults: 5,
				includeAudiobooks: false,
				includePreReleases: false,
				includeAlbumPreReleases: false,
				includeAuthors: false,
				includeEpisodeContentRatingsV2: false,
			});
			const extensions = JSON.stringify({
				persistedQuery: {
					version: 1,
					sha256Hash: SEARCH_SHA256,
				},
			});

			const queryUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=searchDesktop&variables=${encodeURIComponent(
				variables,
			)}&extensions=${encodeURIComponent(extensions)}`;
			const localPath = `/api/spotify-pathfinder/v1/query?operationName=searchDesktop&variables=${encodeURIComponent(
				variables,
			)}&extensions=${encodeURIComponent(extensions)}`;

			const text = await fetchTextWithFallback(
				queryUrl,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						"App-Platform": "WebPlayer",
					},
				},
				localPath,
			);

			const json = JSON.parse(text);
			const items = json?.data?.searchV2?.tracksV2?.items || [];
			const tracks: SpotifyTrack[] = items
				.map((it: any) => {
					const d = it?.item?.data;
					if (!d || !d.id) return null;
					return {
						id: d.id,
						name: d.name,
						artists: (d.artists?.items || []).map((a: any) => ({
							id: a.uri ? a.uri.split(":").pop() || "" : "",
							name: a.profile?.name || a.name || "",
						})),
						duration_ms: d.duration?.totalMilliseconds || 0,
						album: {
							id: d.albumOfTrack?.uri
								? d.albumOfTrack.uri.split(":").pop() || ""
								: "",
							name: d.albumOfTrack?.name || "",
							images: (d.albumOfTrack?.coverArt?.sources || []).map(
								(s: any) => ({
									url: s.url,
									height: s.height,
									width: s.width,
								}),
							),
						},
						external_urls: {
							spotify: `https://open.spotify.com/track/${d.id}`,
						},
					};
				})
				.filter(Boolean) as SpotifyTrack[];

			const total = json?.data?.searchV2?.tracksV2?.totalCount || tracks.length;
			return { tracks, total };
		} catch (err) {
			console.warn(
				"Pathfinder search failed, falling back to Web API search:",
				err,
			);
		}

		// 2. Fallback to official Web API search
		const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
			query,
		)}&type=track&limit=${limit}&offset=${offset}`;
		const localWebApi = `/api/spotify-api/v1/search?q=${encodeURIComponent(
			query,
		)}&type=track&limit=${limit}&offset=${offset}`;

		const resText = await fetchTextWithFallback(
			searchUrl,
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
			},
			localWebApi,
		);

		const data = JSON.parse(resText) as {
			tracks?: { items: SpotifyTrack[]; total: number };
		};
		return {
			tracks: data.tracks?.items || [],
			total: data.tracks?.total || 0,
		};
	},

	/**
	 * Search Spotify and return tracks, album IDs, and playlist IDs.
	 */
	async searchEntities(
		query: string,
		options: { limit?: number; credentials?: SpotifyAuthCredentials } = {},
	): Promise<{
		tracks: SpotifyTrack[];
		albumIds: string[];
		playlistIds: string[];
	}> {
		if (!query.trim()) return { tracks: [], albumIds: [], playlistIds: [] };
		const limit = options.limit || 50;
		const token = await this.getAccessToken(options.credentials);

		try {
			const variables = JSON.stringify({
				searchTerm: query,
				offset: 0,
				limit,
				numberOfTopResults: 5,
				includeAudiobooks: false,
				includePreReleases: false,
				includeAlbumPreReleases: false,
				includeAuthors: false,
				includeEpisodeContentRatingsV2: false,
			});
			const extensions = JSON.stringify({
				persistedQuery: {
					version: 1,
					sha256Hash: SEARCH_SHA256,
				},
			});

			const queryUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=searchDesktop&variables=${encodeURIComponent(
				variables,
			)}&extensions=${encodeURIComponent(extensions)}`;
			const localPath = `/api/spotify-pathfinder/v1/query?operationName=searchDesktop&variables=${encodeURIComponent(
				variables,
			)}&extensions=${encodeURIComponent(extensions)}`;

			const text = await fetchTextWithFallback(
				queryUrl,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						"App-Platform": "WebPlayer",
					},
				},
				localPath,
			);

			const json = JSON.parse(text);
			const trackItems = json?.data?.searchV2?.tracksV2?.items || [];
			const tracks: SpotifyTrack[] = trackItems
				.map((it: any) => {
					const d = it?.item?.data;
					if (!d || !d.id) return null;
					return {
						id: d.id,
						name: d.name,
						artists: (d.artists?.items || []).map((a: any) => ({
							id: a.uri ? a.uri.split(":").pop() || "" : "",
							name: a.profile?.name || a.name || "",
						})),
						duration_ms: d.duration?.totalMilliseconds || 0,
						album: {
							id: d.albumOfTrack?.uri
								? d.albumOfTrack.uri.split(":").pop() || ""
								: "",
							name: d.albumOfTrack?.name || "",
							images: (d.albumOfTrack?.coverArt?.sources || []).map(
								(s: any) => ({
									url: s.url,
									height: s.height,
									width: s.width,
								}),
							),
						},
						external_urls: {
							spotify: `https://open.spotify.com/track/${d.id}`,
						},
					};
				})
				.filter(Boolean) as SpotifyTrack[];

			const albumItems = json?.data?.searchV2?.albumsV2?.items || [];
			const albumIds: string[] = albumItems
				.map((it: any) => it?.data?.uri?.split(":").pop())
				.filter(Boolean);

			const playlistItems = json?.data?.searchV2?.playlists?.items || [];
			const playlistIds: string[] = playlistItems
				.map((it: any) => it?.data?.uri?.split(":").pop())
				.filter(Boolean);

			return { tracks, albumIds, playlistIds };
		} catch (err) {
			console.warn("Pathfinder searchEntities failed:", err);
			const fallback = await this.searchTracks(query, options);
			return { tracks: fallback.tracks, albumIds: [], playlistIds: [] };
		}
	},

	/**
	 * Get artist discography album IDs.
	 */
	async getArtistDiscography(
		artistId: string,
		limit = 50,
		credentials?: SpotifyAuthCredentials,
	): Promise<string[]> {
		if (!artistId) return [];
		const token = await this.getAccessToken(credentials);
		try {
			const variables = JSON.stringify({
				uri: `spotify:artist:${artistId}`,
				offset: 0,
				limit: Math.min(limit, 50),
			});
			const extensions = JSON.stringify({
				persistedQuery: {
					version: 1,
					sha256Hash:
						"5e07d323febb57b4a56a42abbf781490e58764aa45feb6e3dc0591564fc56599",
				},
			});

			const queryUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=queryArtistDiscographyAll&variables=${encodeURIComponent(
				variables,
			)}&extensions=${encodeURIComponent(extensions)}`;
			const localPath = `/api/spotify-pathfinder/v1/query?operationName=queryArtistDiscographyAll&variables=${encodeURIComponent(
				variables,
			)}&extensions=${encodeURIComponent(extensions)}`;

			const text = await fetchTextWithFallback(
				queryUrl,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						"App-Platform": "WebPlayer",
					},
				},
				localPath,
			);

			const json = JSON.parse(text);
			const items = json?.data?.artistUnion?.discography?.all?.items || [];
			const albumIds: string[] = [];
			for (const item of items) {
				const id = item?.releases?.items?.[0]?.id;
				if (id) albumIds.push(id);
			}
			return albumIds;
		} catch (err) {
			console.warn(`getArtistDiscography failed for ${artistId}:`, err);
			return [];
		}
	},

	/**
	 * Get tracks in an album.
	 */
	async getAlbumTracks(
		albumId: string,
		credentials?: SpotifyAuthCredentials,
	): Promise<SpotifyTrack[]> {
		if (!albumId) return [];
		const token = await this.getAccessToken(credentials);
		try {
			const variables = JSON.stringify({
				uri: `spotify:album:${albumId}`,
				locale: "",
				offset: 0,
				limit: 50,
			});
			const extensions = JSON.stringify({
				persistedQuery: {
					version: 1,
					sha256Hash:
						"b9bfabef66ed756e5e13f68a942deb60bd4125ec1f1be8cc42769dc0259b4b10",
				},
			});

			const queryUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=getAlbum&variables=${encodeURIComponent(
				variables,
			)}&extensions=${encodeURIComponent(extensions)}`;
			const localPath = `/api/spotify-pathfinder/v1/query?operationName=getAlbum&variables=${encodeURIComponent(
				variables,
			)}&extensions=${encodeURIComponent(extensions)}`;

			const text = await fetchTextWithFallback(
				queryUrl,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						"App-Platform": "WebPlayer",
					},
				},
				localPath,
			);

			const json = JSON.parse(text);
			const albumName = json?.data?.albumUnion?.name || "";
			const items = json?.data?.albumUnion?.tracksV2?.items || [];
			return items
				.map((it: any) => {
					const t = it?.track;
					if (!t || !t.uri) return null;
					const id = t.uri.split(":").pop() || "";
					return {
						id,
						name: t.name,
						artists: (t.artists?.items || []).map((a: any) => ({
							id: a.uri ? a.uri.split(":").pop() || "" : "",
							name: a.profile?.name || a.name || "",
						})),
						duration_ms: t.duration?.totalMilliseconds || 0,
						album: {
							id: albumId,
							name: albumName,
						},
						external_urls: {
							spotify: `https://open.spotify.com/track/${id}`,
						},
					};
				})
				.filter(Boolean) as SpotifyTrack[];
		} catch (err) {
			console.warn(`getAlbumTracks failed for ${albumId}:`, err);
			return [];
		}
	},
};
