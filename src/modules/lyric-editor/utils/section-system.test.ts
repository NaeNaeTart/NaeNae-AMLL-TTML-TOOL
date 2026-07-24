import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import {
	applyReviewedSections,
	assignHighConfidenceRepeatGroups,
	getOrderedSections,
	mergeSectionWithAdjacent,
	migrateLegacySections,
	moveSection,
	normalizeSectionHeader,
	removeSectionMetadata,
	splitSection,
	validateSections,
} from "./section-system";

const line = (text: string, header?: string) => ({
	...newLyricLine(),
	geniusHeader: header,
	words: [{ ...newLyricWord(), word: text }],
});

describe("section header normalization", () => {
	it("preserves labels while extracting aliases, ordinals, and vocalists", () => {
		expect(normalizeSectionHeader("[VERSE II: Guest Artist]")).toMatchObject({
			label: "[VERSE II: Guest Artist]",
			category: "verse",
			ordinal: 2,
			vocalist: "Guest Artist",
			confidence: 1,
		});
		expect(normalizeSectionHeader("[Strofa 3]")).toMatchObject({
			category: "verse",
			ordinal: 3,
		});
	});

	it("preserves unknown labels as other", () => {
		expect(normalizeSectionHeader("[Massive Drop]")).toMatchObject({
			category: "other",
			confidence: 0.35,
		});
	});
});

describe("first-class sections", () => {
	it("migrates contiguous legacy headers and applies reviewed metadata", () => {
		const lyrics = {
			metadata: [],
			lyricLines: [
				line("a", "[Verse 1]"),
				line("b", "[Verse 1]"),
				line("c", "[Chorus]"),
			],
		} as TTMLLyric;

		applyReviewedSections(lyrics, [
			{ occurrence: 0, notes: "quiet", vocalist: "Lead" },
		]);

		expect(lyrics.sections).toHaveLength(2);
		expect(lyrics.lyricLines[0].sectionId).toBe(lyrics.lyricLines[1].sectionId);
		expect(lyrics.lyricLines[2].sectionId).not.toBe(
			lyrics.lyricLines[0].sectionId,
		);
		expect(lyrics.sections?.[0]).toMatchObject({
			category: "verse",
			notes: "quiet",
			vocalist: "Lead",
		});
	});

	it("automatically links only high-confidence repeats", () => {
		const lyrics = {
			metadata: [],
			lyricLines: [
				line("same chorus", "[Chorus]"),
				line("verse", "[Verse]"),
				line("same chorus", "[Chorus]"),
			],
		} as TTMLLyric;
		migrateLegacySections(lyrics);
		assignHighConfidenceRepeatGroups(lyrics);
		expect(lyrics.sections?.[0].repeatGroupId).toBeTruthy();
		expect(lyrics.sections?.[2].repeatGroupId).toBe(
			lyrics.sections?.[0].repeatGroupId,
		);
		expect(lyrics.sections?.[1].repeatGroupId).toBeUndefined();
	});

	it("supports split, merge, move, and metadata removal", () => {
		const lyrics = {
			metadata: [],
			lyricLines: [
				line("a", "[Verse]"),
				line("b", "[Verse]"),
				line("c", "[Chorus]"),
			],
		} as TTMLLyric;
		migrateLegacySections(lyrics);
		const verseId = lyrics.sections?.[0].id ?? "";
		const chorusId = lyrics.sections?.[1].id ?? "";

		const split = splitSection(lyrics, verseId, 1);
		expect(split).toBeTruthy();
		expect(moveSection(lyrics, chorusId, "up")).toBe(true);
		expect(mergeSectionWithAdjacent(lyrics, chorusId, "next")).toBe(true);
		removeSectionMetadata(lyrics, chorusId);
		expect(lyrics.lyricLines.some((item) => item.sectionId === chorusId)).toBe(
			false,
		);
	});

	it("uses lyric order for navigation and safely rejects missing neighbors", () => {
		const lyrics = {
			metadata: [],
			lyricLines: [line("verse", "[Verse]"), line("chorus", "[Chorus]")],
		} as TTMLLyric;
		migrateLegacySections(lyrics);
		const verseId = lyrics.lyricLines[0].sectionId ?? "";
		const chorusId = lyrics.lyricLines[1].sectionId ?? "";

		expect(moveSection(lyrics, verseId, "up")).toBe(false);
		expect(moveSection(lyrics, chorusId, "down")).toBe(false);
		expect(mergeSectionWithAdjacent(lyrics, verseId, "previous")).toBe(false);
		expect(mergeSectionWithAdjacent(lyrics, chorusId, "next")).toBe(false);

		expect(moveSection(lyrics, chorusId, "up")).toBe(true);
		expect(getOrderedSections(lyrics).map((section) => section.id)).toEqual([
			chorusId,
			verseId,
		]);
	});

	it("reports broken references and low-confidence categories without throwing", () => {
		const lyrics = {
			metadata: [],
			sections: [
				{
					id: "unknown",
					label: "[Drop]",
					category: "other",
					confidence: 0.35,
				},
			],
			lyricLines: [
				{ ...line("a"), sectionId: "missing" },
				{ ...line("b"), sectionId: "unknown" },
			],
		} as TTMLLyric;

		expect(validateSections(lyrics).map((issue) => issue.code)).toEqual(
			expect.arrayContaining(["broken-reference", "low-confidence-category"]),
		);
	});
});
