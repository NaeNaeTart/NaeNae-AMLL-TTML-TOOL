import type {
	UnisonIdentityKeyPair,
	UnisonLyricsResponse,
	UnisonPublishParams,
	UnisonSearchResponse,
	UnisonSubmitPayload,
	UnisonSubmitResponse,
	UnisonTrack,
} from "../types";
import { getOrCreateUnisonIdentity, signUnisonPayload } from "../utils/crypto";

const DIRECT_BASE_URL = "https://unison.boidu.dev";
const LOCAL_PROXY_PREFIX = "/api/unison";

/**
 * Handles communication with Unison API with automatic proxy / fallback handling
 */
async function fetchUnison(
	endpoint: string,
	init?: RequestInit,
): Promise<Response> {
	// If in browser environment with HTTP/HTTPS, try local/serverless proxy first to bypass CORS preflight restrictions
	if (
		typeof window !== "undefined" &&
		window.location?.protocol?.startsWith("http")
	) {
		try {
			const proxyRes = await fetch(`${LOCAL_PROXY_PREFIX}${endpoint}`, init);
			const contentType = proxyRes.headers.get("content-type") || "";
			// If proxy request succeeded or returned a valid upstream JSON response, use it
			if (
				proxyRes.ok ||
				(contentType.includes("application/json") && proxyRes.status !== 404)
			) {
				return proxyRes;
			}
			// If proxy returned 404 HTML (e.g. unconfigured host), fall through to direct fetch
		} catch {
			// Fall through to direct fetch
		}
	}

	return await fetch(`${DIRECT_BASE_URL}${endpoint}`, init);
}

export const UnisonApi = {
	/**
	 * Search for lyrics in the Unison database
	 * @param query Search keywords (e.g. "Song Name Artist")
	 */
	async search(query: string): Promise<UnisonTrack[]> {
		if (!query.trim()) return [];

		try {
			const response = await fetchUnison(
				`/lyrics/search?q=${encodeURIComponent(query)}`,
			);
			if (!response.ok) {
				throw new Error(`Unison Search failed: ${response.statusText}`);
			}
			const json = (await response.json()) as UnisonSearchResponse;
			if (!json.success || !json.data) {
				return [];
			}
			return json.data;
		} catch (error) {
			console.error("Unison search error:", error);
			throw error;
		}
	},

	/**
	 * Retrieve lyrics by YouTube Video ID
	 */
	async getByVideoId(videoId: string): Promise<UnisonTrack | null> {
		if (!videoId.trim()) return null;

		try {
			const response = await fetchUnison(
				`/lyrics?v=${encodeURIComponent(videoId.trim())}`,
			);
			if (response.status === 404) return null;
			if (!response.ok) {
				throw new Error(`Unison get by videoId failed: ${response.statusText}`);
			}
			const json = (await response.json()) as UnisonLyricsResponse;
			return json.data ?? null;
		} catch (error) {
			console.error("Unison getByVideoId error:", error);
			return null;
		}
	},

	/**
	 * Retrieve lyrics by track metadata
	 */
	async getByMetadata(params: {
		song: string;
		artist: string;
		album?: string;
		duration?: number;
	}): Promise<UnisonTrack | null> {
		const query = new URLSearchParams({
			song: params.song,
			artist: params.artist,
		});
		if (params.album) query.set("album", params.album);
		if (params.duration) query.set("duration", Math.round(params.duration).toString());

		try {
			const response = await fetchUnison(`/lyrics?${query.toString()}`);
			if (response.status === 404) return null;
			if (!response.ok) {
				throw new Error(`Unison get by metadata failed: ${response.statusText}`);
			}
			const json = (await response.json()) as UnisonLyricsResponse;
			return json.data ?? null;
		} catch (error) {
			console.error("Unison getByMetadata error:", error);
			return null;
		}
	},

	/**
	 * Sign and publish lyrics to Unison
	 */
	async publish(
		params: UnisonPublishParams,
		customIdentity?: UnisonIdentityKeyPair,
	): Promise<UnisonSubmitResponse> {
		if (!params.song.trim() || !params.artist.trim()) {
			throw new Error("Song name and artist are required.");
		}
		if (!params.lyrics.trim()) {
			throw new Error("Lyrics content cannot be empty.");
		}
		if (!params.duration || params.duration <= 0) {
			throw new Error("A valid song duration is required.");
		}

		const identity = customIdentity ?? (await getOrCreateUnisonIdentity());
		const nonce =
			typeof crypto.randomUUID === "function"
				? crypto.randomUUID()
				: Math.random().toString(36).substring(2) + Date.now().toString(36);
		const timestamp = Date.now();

		const payload: UnisonSubmitPayload = {
			keyId: identity.keyId,
			timestamp,
			nonce,
			song: params.song.trim(),
			artist: params.artist.trim(),
			duration: Math.round(params.duration),
			lyrics: params.lyrics,
			format: params.format,
		};

		if (params.album?.trim()) payload.album = params.album.trim();
		if (params.language?.trim()) payload.language = params.language.trim();
		if (params.videoId?.trim()) payload.videoId = params.videoId.trim();
		if (params.isrc?.trim()) payload.isrc = params.isrc.trim();

		const signedBody = await signUnisonPayload(payload, identity);

		try {
			const response = await fetchUnison("/lyrics/submit", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Key-ID": identity.keyId,
				},
				body: JSON.stringify(signedBody),
			});

			const json = (await response.json()) as UnisonSubmitResponse;

			if (!response.ok || !json.success) {
				const errMsg =
					json.hint ||
					json.error ||
					`Unison Publish failed (${response.status}): ${response.statusText}`;
				throw new Error(errMsg);
			}

			return json;
		} catch (error) {
			console.error("Unison publish error:", error);
			throw error;
		}
	},
};
