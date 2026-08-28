import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnisonApi } from "./client";
import { generateUnisonKeypair } from "../utils/crypto";

describe("UnisonApi Client", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("search returns track list on successful response", async () => {
		const mockTracks = [
			{
				id: 123,
				song: "Test Song",
				artist: "Test Artist",
				duration: 200,
				format: "ttml" as const,
			},
		];

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ success: true, data: mockTracks }),
				headers: new Headers({ "content-type": "application/json" }),
			}),
		);

		const results = await UnisonApi.search("Test");
		expect(results).toHaveLength(1);
		expect(results[0].song).toBe("Test Song");
	});

	it("publishes valid signed payload and receives created confirmation", async () => {
		const identity = await generateUnisonKeypair();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 201,
			json: async () => ({ success: true, data: { id: 999, created: true } }),
			headers: new Headers({ "content-type": "application/json" }),
		});
		vi.stubGlobal("fetch", fetchMock);

		const res = await UnisonApi.publish(
			{
				song: "Valid Song",
				artist: "Valid Artist",
				duration: 180,
				lyrics: "Test lyrics",
				format: "ttml",
				videoId: "dQw4w9WgXcQ",
			},
			identity,
		);

		expect(res.success).toBe(true);
		expect(res.data?.id).toBe(999);
		expect(fetchMock).toHaveBeenCalled();
	});

	it("throws informative error on validation failure or failed response", async () => {
		await expect(
			UnisonApi.publish({
				song: "",
				artist: "Artist",
				duration: 100,
				lyrics: "Lyrics",
				format: "text",
			}),
		).rejects.toThrow("Song name and artist are required.");

		const identity = await generateUnisonKeypair();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 400,
				json: async () => ({
					success: false,
					error: "Formatted TTML",
					hint: "The TTML file has extra spaces.",
				}),
				headers: new Headers({ "content-type": "application/json" }),
			}),
		);

		await expect(
			UnisonApi.publish(
				{
					song: "Song",
					artist: "Artist",
					duration: 100,
					lyrics: "Lyrics",
					format: "ttml",
				},
				identity,
			),
		).rejects.toThrow("The TTML file has extra spaces.");
	});
});
