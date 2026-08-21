import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "../../../types/ttml";
import { appendParentBeforeNestedLines } from "./ttml-parser";

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
