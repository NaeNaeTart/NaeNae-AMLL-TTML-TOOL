// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "../../../types/ttml";
import { appendParentBeforeNestedLines, parseLyric } from "./ttml-parser";

describe("appendParentBeforeNestedLines", () => {
	it("keeps every nested background line after its parent", () => {
		const existing = { ...newLyricLine(), id: "existing" };
		const parent = { ...newLyricLine(), id: "main" };
		parent.words = [{ ...newLyricWord(), word: "Main" }];
		const lines = [
			existing,
			{ ...newLyricLine(), id: "bg-1", isBG: true },
			{ ...newLyricLine(), id: "bg-2", isBG: true },
			{ ...newLyricLine(), id: "bg-3", isBG: true },
		];

		appendParentBeforeNestedLines(lines, 1, parent);

		expect(lines.map((line) => line.id)).toEqual([
			"existing",
			"main",
			"bg-1",
			"bg-2",
			"bg-3",
		]);
	});

	it("does not create an empty parent for a standalone background line", () => {
		const parent = { ...newLyricLine(), id: "empty-main" };
		const lines = [{ ...newLyricLine(), id: "standalone-bg", isBG: true }];

		appendParentBeforeNestedLines(lines, 0, parent);

		expect(lines.map((line) => line.id)).toEqual(["standalone-bg"]);
	});
});

describe("parseLyric timing calculation", () => {
	it("derives lead line endTime from its own words instead of inheriting the container end with background", () => {
		const ttml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <body>
    <div>
      <p begin="00:10.000" end="00:16.000">
        <span begin="00:10.000" end="00:10.800">Check </span>
        <span begin="00:10.800" end="00:11.200">it </span>
        <span begin="00:11.200" end="00:12.000">out</span>
        <span ttm:role="x-bg" begin="00:11.500" end="00:16.000">
          <span begin="00:11.500" end="00:16.000">(background vocal)</span>
        </span>
      </p>
    </div>
  </body>
</tt>`;

		const parsed = parseLyric(ttml);

		expect(parsed.lyricLines.length).toBe(2);
		const leadLine = parsed.lyricLines[0];
		const bgLine = parsed.lyricLines[1];

		expect(leadLine.isBG).toBe(false);
		expect(leadLine.startTime).toBe(10_000);
		expect(leadLine.endTime).toBe(12_000);

		expect(bgLine.isBG).toBe(true);
		expect(bgLine.startTime).toBe(11_500);
		expect(bgLine.endTime).toBe(16_000);
	});
});
