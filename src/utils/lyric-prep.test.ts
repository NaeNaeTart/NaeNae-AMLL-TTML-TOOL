import { describe, expect, it } from "vitest";
import { prepareLyricLine } from "./lyric-prep";

describe("prepareLyricLine", () => {
	it.each([
		["你,好", "你, \\好"],
		["你，好", "你，\\好"],
		["君、僕", "君、\\僕"],
		["你，Hello", "你，\\Hello"],
		["Hello、你", "Hello、\\你"],
	])("splits words after commas without spaces: %s", (input, expected) => {
		expect(prepareLyricLine(input, false)).toBe(expected);
	});

	it("splits non-BMP CJK characters by code point", () => {
		expect(prepareLyricLine("𠮷野", false)).toBe("𠮷\\野");
		expect(prepareLyricLine("𠮷，野", false)).toBe("𠮷，\\野");
	});

	it("preserves existing line features while splitting CJK text", () => {
		expect(prepareLyricLine("[Verse]你，好 (君、僕)", false)).toBe(
			"你，\\好\n<君、\\僕",
		);
	});

	it("keeps adjacent CJK and Latin word boundaries", () => {
		expect(prepareLyricLine("你Hello世界", false)).toBe("你\\Hello\\世\\界");
	});

	it("escapes literal spaces for the text importer", () => {
		expect(prepareLyricLine("你，好 world")).toBe("你，\\好\\ \\world");
	});
});
