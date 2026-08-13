import { describe, expect, it } from "vitest";
import { getWordConnections } from "./word-connections.ts";

describe("getWordConnections", () => {
	it("connects consecutive words without a blank separator", () => {
		expect(getWordConnections(["Pro", "phe", "cy,"], 1)).toEqual({
			previous: true,
			next: true,
		});
	});

	it("uses blank words as visible spacing boundaries", () => {
		expect(getWordConnections(["trust", " ", "me"], 0)).toEqual({
			previous: false,
			next: false,
		});
		expect(getWordConnections(["trust", " ", "me"], 2)).toEqual({
			previous: false,
			next: false,
		});
	});

	it("separates groups at whitespace attached to a word", () => {
		const words = ["Pro", "phe", "cy, ", "Pro", "phe", "cy,"];

		expect(getWordConnections(words, 2)).toEqual({
			previous: true,
			next: false,
		});
		expect(getWordConnections(words, 3)).toEqual({
			previous: false,
			next: true,
		});
	});

	it("never connects a whitespace-only token", () => {
		expect(getWordConnections(["one", "  ", "two"], 1)).toEqual({
			previous: false,
			next: false,
		});
	});
});
