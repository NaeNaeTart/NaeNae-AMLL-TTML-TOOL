import { afterEach, describe, expect, it, vi } from "vitest";
import { getPhonetic, getPhoneticSyllables } from "./phonetic";

const googleResponse = (romanized: string) =>
	new Response(JSON.stringify([[["", "", "", romanized]]]), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("phonetic conversion requests", () => {
	it("limits simultaneous Google transliteration requests", async () => {
		let activeRequests = 0;
		let maximumActiveRequests = 0;
		const fetchMock = vi.fn(async () => {
			activeRequests++;
			maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
			await new Promise((resolve) => setTimeout(resolve, 5));
			activeRequests--;
			return googleResponse("a");
		});
		vi.stubGlobal("fetch", fetchMock);

		await getPhoneticSyllables(
			["一", "二", "三", "四", "五", "六", "七", "八"],
			"ja",
		);

		expect(fetchMock).toHaveBeenCalledTimes(9);
		expect(maximumActiveRequests).toBeLessThanOrEqual(4);
	});

	it("retries Google after a temporary fallback", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(googleResponse("retry"));
		vi.stubGlobal("fetch", fetchMock);

		expect(await getPhonetic("重新嘗試獨特文字", "yue")).toBe("");
		expect(await getPhonetic("重新嘗試獨特文字", "yue")).toBe("retry");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("reuses successful Google results", async () => {
		const fetchMock = vi.fn(async () => googleResponse("cached"));
		vi.stubGlobal("fetch", fetchMock);

		expect(await getPhonetic("成功快取獨特文字", "yue")).toBe("cached");
		expect(await getPhonetic("成功快取獨特文字", "yue")).toBe("cached");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
