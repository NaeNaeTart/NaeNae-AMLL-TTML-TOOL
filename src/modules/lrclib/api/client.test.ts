import { afterEach, describe, expect, it, vi } from "vitest";
import { LrcLibApi } from "./client";

describe("LrcLibApi", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("requests challenge correctly from /api/request-challenge", async () => {
		const mockResponse = {
			prefix: "test_challenge_prefix",
			target: "000000ff00000000000000000000000000000000000000000000000000000000",
		};

		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
			ok: true,
			json: async () => mockResponse,
		} as Response);

		const result = await LrcLibApi.requestChallenge();
		expect(result).toEqual(mockResponse);
		expect(globalThis.fetch).toHaveBeenCalledWith(
			"https://lrclib.net/api/request-challenge",
			{ method: "POST" },
		);
	});

	it("publishes lyrics to /api/publish with correct headers and payload", async () => {
		let capturedUrl = "";
		let capturedOptions: RequestInit | undefined;

		vi.spyOn(globalThis, "fetch").mockImplementationOnce(
			async (url, options) => {
				capturedUrl = url.toString();
				capturedOptions = options;
				return {
					ok: true,
					json: async () => ({ status: "published" }),
				} as Response;
			},
		);

		const params = {
			trackName: "Song A",
			artistName: "Artist B",
			albumName: "Album C",
			duration: 180,
			lyricsfile: "format: lyricsfile\n...",
			syncedLyrics: "[00:01.00] Line 1",
			plainLyrics: "Line 1",
		};
		const token = "test_challenge_prefix:12345";

		await LrcLibApi.publish(params, token);

		expect(capturedUrl).toBe("https://lrclib.net/api/publish");
		expect(capturedOptions?.method).toBe("POST");
		expect(capturedOptions?.headers).toEqual({
			"Content-Type": "application/json",
			"X-Publish-Token": token,
		});
		expect(JSON.parse(capturedOptions?.body as string)).toEqual(params);
	});

	it("throws informative error when publish request fails", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
			ok: false,
			status: 400,
			statusText: "Bad Request",
			json: async () => ({ message: "Invalid challenge token" }),
		} as unknown as Response);

		await expect(
			LrcLibApi.publish(
				{
					trackName: "Song",
					artistName: "Artist",
				},
				"bad_token",
			),
		).rejects.toThrow("LRCLIB Publish failed (400): Invalid challenge token");
	});
});
