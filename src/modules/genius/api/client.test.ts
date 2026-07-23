import { describe, expect, it } from "vitest";
import { extractLyricsFromEmbed } from "./client";

describe("extractLyricsFromEmbed", () => {
	it("extracts lyrics from Genius's escaped embed payload without evaluating it", () => {
		const embedScript = String.raw`document.write(JSON.parse('\"<div class=\\\"rg_embed_body\\\">First line<br>\\nSecond line\\nI\'m here<\\/div>\"'))`;

		expect(extractLyricsFromEmbed(embedScript)).toBe("First line\nSecond line\nI'm here");
	});

	it("rejects embed responses that do not contain lyrics", () => {
		expect(() => extractLyricsFromEmbed("document.write('nope')")).toThrow(
			"Lyrics were not present",
		);
	});
});
