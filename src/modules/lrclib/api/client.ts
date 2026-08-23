import type {
	LrcLibChallengeResponse,
	LrcLibPublishParams,
	LrcLibTrack,
} from "../types";

const DIRECT_BASE_URL = "https://lrclib.net/api";
const LOCAL_PROXY_PREFIX = "/api/lrclib";

async function fetchLrcLib(
	endpoint: string,
	init?: RequestInit,
): Promise<Response> {
	// If in browser environment with HTTP/HTTPS, try local proxy first to bypass CORS preflight restrictions
	if (
		typeof window !== "undefined" &&
		window.location?.protocol?.startsWith("http")
	) {
		try {
			const proxyRes = await fetch(`${LOCAL_PROXY_PREFIX}${endpoint}`, init);
			if (proxyRes.status !== 502 && proxyRes.status !== 504) {
				return proxyRes;
			}
		} catch {
			// Fall through to direct fetch
		}
	}

	return await fetch(`${DIRECT_BASE_URL}${endpoint}`, init);
}

export const LrcLibApi = {
	/**
	 * 搜索歌曲
	 * @param query 搜索关键词 (如 "歌名 歌手")
	 * @returns @see {@link LrcLibTrack}
	 * @throws 在 API 请求失败时抛出错误
	 */
	async search(query: string): Promise<LrcLibTrack[]> {
		if (!query.trim()) return [];

		try {
			const response = await fetchLrcLib(
				`/search?q=${encodeURIComponent(query)}`,
			);
			if (!response.ok) {
				throw new Error(`LRCLIB Search failed: ${response.statusText}`);
			}
			const data = (await response.json()) as LrcLibTrack[];
			return data;
		} catch (error) {
			console.error("LRCLIB API Error:", error);
			throw error;
		}
	},

	/**
	 * 根据 ID 获取歌曲详情
	 * @param id 歌曲 ID
	 * @returns @see {@link LrcLibTrack}
	 * @throws 在 API 请求失败时抛出错误
	 */
	async getById(id: number): Promise<LrcLibTrack> {
		try {
			const response = await fetchLrcLib(`/get/${id}`);
			if (!response.ok) {
				throw new Error(`LRCLIB Get failed: ${response.statusText}`);
			}
			return (await response.json()) as LrcLibTrack;
		} catch (error) {
			console.error("LRCLIB API Error:", error);
			throw error;
		}
	},

	/**
	 * 请求 LRCLIB 挑战 (Proof-of-Work Challenge)
	 */
	async requestChallenge(): Promise<LrcLibChallengeResponse> {
		try {
			const response = await fetchLrcLib("/request-challenge", {
				method: "POST",
			});
			if (!response.ok) {
				throw new Error(
					`Failed to request LRCLIB challenge: ${response.status} ${response.statusText}`,
				);
			}
			return (await response.json()) as LrcLibChallengeResponse;
		} catch (error) {
			console.error("LRCLIB request-challenge Error:", error);
			throw error;
		}
	},

	/**
	 * 上传歌词 / Lyricsfile 到 LRCLIB
	 * @param params 歌曲元数据与歌词内容
	 * @param token 计算出的发布凭证 (${prefix}:${nonce})
	 */
	async publish(params: LrcLibPublishParams, token: string): Promise<void> {
		try {
			const response = await fetchLrcLib("/publish", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Publish-Token": token,
				},
				body: JSON.stringify(params),
			});
			if (!response.ok) {
				let errDetail = response.statusText;
				try {
					const json = await response.json();
					if (json.message) errDetail = json.message;
					else if (json.error) errDetail = json.error;
				} catch {
					// ignore json parse error
				}
				throw new Error(
					`LRCLIB Publish failed (${response.status}): ${errDetail}`,
				);
			}
		} catch (error) {
			console.error("LRCLIB publish Error:", error);
			throw error;
		}
	},
};


