import { describe, expect, it } from "vitest";
import { splitTextImportWords } from "./text-import-words";

describe("text import word boundaries", () => {
	it("splits after hyphens even without a separator", () => {
		expect(splitTextImportWords("la-la-la", "")).toEqual(["la-", "la-", "la"]);
	});

	it("keeps whitespace and never adds spaces", () => {
		expect(splitTextImportWords("well-known  song", "")).toEqual([
			"well-",
			"known  song",
		]);
	});

	it("splits at the separator, then at hyphens", () => {
		expect(splitTextImportWords("well-known\\song", "\\")).toEqual([
			"well-",
			"known",
			"song",
		]);
	});

	it("treats separator characters literally and drops empty segments", () => {
		expect(splitTextImportWords(".a..b.", ".")).toEqual(["a", "b"]);
		expect(splitTextImportWords("a|*b", "|*")).toEqual(["a", "b"]);
	});

	it("keeps existing backslash cleanup", () => {
		expect(splitTextImportWords("a\\b/c\\d", "/")).toEqual(["ab", "cd"]);
	});
});
