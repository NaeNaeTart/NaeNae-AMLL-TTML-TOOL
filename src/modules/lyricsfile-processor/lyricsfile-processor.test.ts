import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord, type LyricSection, type LyricWord, type TTMLLyric } from "../../types/ttml";
import { parseLyricsfile } from "./parser";
import { exportLyricsfileText } from "./writer";

function word(text: string, startTime: number, endTime: number): LyricWord {
	return {
		...newLyricWord(),
		word: text,
		startTime,
		endTime,
	};
}

function section(id: string, category: LyricSection["category"], label: string): LyricSection {
	return { id, category, label };
}

function buildFullLyric(): TTMLLyric {
	const lead = newLyricLine();
	lead.words = [
		word("Hello", 0, 500),
		word(" ", 0, 0),
		word("world", 500, 1000),
	];
	lead.startTime = 0;
	lead.endTime = 1000;

	const duet = newLyricLine();
	duet.isDuet = true;
	duet.words = [word("Together", 2000, 3000)];
	duet.startTime = 2000;
	duet.endTime = 3000;
	duet.translatedLyric = "Juntos";

	const middle = newLyricLine();
	middle.isMiddle = true;
	middle.words = [word("Middle", 3500, 4200)];
	middle.startTime = 3500;
	middle.endTime = 4200;
	middle.romanLyric = "Midoru";

	const group = newLyricLine();
	group.isDuetGroup = true;
	group.words = [word("Both", 5000, 5600)];
	group.startTime = 5000;
	group.endTime = 5600;

	const bg = newLyricLine();
	bg.isBG = true;
	bg.words = [word("(echo)", 600, 900)];
	bg.startTime = 600;
	bg.endTime = 900;

	const ruby = newLyricLine();
	ruby.words = [
		{
			...word("誰", 7000, 8000),
			romanWord: "dare",
			ruby: [{ word: "誰", startTime: 7000, endTime: 7300 }],
		},
	];
	ruby.startTime = 7000;
	ruby.endTime = 8000;

	const lyric: TTMLLyric = {
		metadata: [
			{ key: "musicName", value: ["Test Song"] },
			{ key: "artists", value: ["First Artist", "Second Artist", "Third Artist"] },
			{ key: "album", value: ["Test Album"] },
			{ key: "lyricsfileCreatedByDiscord", value: ["test_user"] },
			{ key: "songwriter", value: ["Writer One"] },
			{ key: "custom", value: ["x"] },
		],
		lyricLines: [lead, duet, middle, group, bg, ruby],
		sections: [
			section("sec-1", "verse", ""),
			section("sec-2", "hook", ""),
			section("sec-3", "instrumental", "Break"),
		],
		reversedSyncLineIds: [duet.id],
	};
	lead.sectionId = "sec-1";
	duet.sectionId = "sec-1";
	middle.sectionId = "sec-2";
	group.sectionId = "sec-2";
	bg.sectionId = "sec-1";
	ruby.sectionId = "sec-3";
	return lyric;
}

describe("lyricsfile round-trip", () => {
	it("preserves flags, metadata, sections and reversed sync through export + parse", () => {
		const lyric = buildFullLyric();
		const yaml = exportLyricsfileText(lyric);
		const parsed = parseLyricsfile(yaml);

		expect(parsed.lyricLines).toHaveLength(6);
		expect(parsed.lyricLines[0].isDuet).toBe(false);
		expect(parsed.lyricLines[0].words.map((w) => w.word)).toEqual([
			"Hello ",
			"world",
		]);
		expect(parsed.lyricLines[1].isDuet).toBe(true);
		expect(parsed.lyricLines[1].translatedLyric).toBe("Juntos");
		expect(parsed.lyricLines[2].isMiddle).toBe(true);
		expect(parsed.lyricLines[2].romanLyric).toBe("Midoru");
		expect(parsed.lyricLines[3].isDuetGroup).toBe(true);
		expect(parsed.lyricLines[4].isBG).toBe(true);
		expect(parsed.lyricLines[5].words[0].romanWord).toBe("dare");
		const ruby = parsed.lyricLines[5].words[0].ruby;
		expect(ruby).toHaveLength(1);
		expect(ruby?.[0].word).toBe("誰");

		expect(parsed.metadata).toContainEqual({
			key: "artists",
			value: ["First Artist", "Second Artist", "Third Artist"],
		});
		expect(parsed.metadata).toContainEqual({
			key: "lyricsfileCreatedByDiscord",
			value: ["test_user"],
		});
		expect(parsed.metadata).toContainEqual({ key: "songwriter", value: ["Writer One"] });

		const parsedSections = parsed.sections;
		expect(parsedSections).toHaveLength(3);
		const hook = parsedSections?.find((s) => s.label === "");
		expect(hook?.category).toBe("verse");
		expect(parsedSections?.find((s) => s.category === "chorus")).toBeDefined();
		const instrumental = parsedSections?.find((s) => s.label === "Break");
		expect(instrumental?.category).toBe("instrumental");
		expect(parsed.lyricLines[5].sectionId).toBe(instrumental?.id);

		expect(parsed.reversedSyncLineIds).toEqual([parsed.lyricLines[1].id]);
	});

	it("is idempotent: export → parse → export produces identical YAML", () => {
		const yaml = exportLyricsfileText(buildFullLyric());
		const parsed = parseLyricsfile(yaml);
		expect(exportLyricsfileText(parsed)).toBe(yaml);
	});

	it("writes plain text as lines joined by newline", () => {
		const yaml = exportLyricsfileText(buildFullLyric());
		expect(yaml).toContain(
			"plain: |-\n  Hello world\n  Together\n  Middle\n  Both\n  (echo)\n  誰",
		);
	});

	it("rejects unsupported versions", () => {
		expect(() => parseLyricsfile("version: '2.0'\nlines: []")).toThrow(
			"Unsupported lyricsfile version",
		);
	});

	it("accepts version 1.1 with a lyricsfile header and parses duet vocalists", () => {
		const yaml = `lyricsfile: "1.1"
version: "1.1"
metadata:
  title: Test
  artist: Tester
  vocalists:
    - id: v1
      name: Lead
      type: person
    - id: v2
      name: Duet
      type: person
lines:
  - text: Lead line
    start_ms: 0
    end_ms: 1000
    vocalist: [v1]
  - text: Duet line
    start_ms: 1000
    end_ms: 2000
    vocalist: [v2]
`;
		const parsed = parseLyricsfile(yaml);
		expect(parsed.lyricLines).toHaveLength(2);
		expect(parsed.lyricLines[0].isDuet).toBe(false);
		expect(parsed.lyricLines[1].isDuet).toBe(true);
	});

	it("uses real vocalist names and v4/-bg ids (lyricsfile only)", () => {
		const lead = newLyricLine();
		lead.words = [word("Lead", 0, 500)];
		lead.startTime = 0;
		lead.endTime = 500;

		const duet = newLyricLine();
		duet.isDuet = true;
		duet.words = [word("Duet", 500, 1000)];
		duet.startTime = 500;
		duet.endTime = 1000;

		const harmony = newLyricLine();
		harmony.isDuetGroup = true;
		harmony.words = [word("Harmony", 1000, 1500)];
		harmony.startTime = 1000;
		harmony.endTime = 1500;

		const bg = newLyricLine();
		bg.isDuet = true;
		bg.isBG = true;
		bg.words = [word("(bg)", 1500, 2000)];
		bg.startTime = 1500;
		bg.endTime = 2000;

		const lyric: TTMLLyric = {
			metadata: [{ key: "musicName", value: ["Names Test"] }],
			lyricLines: [lead, duet, harmony, bg],
			vocalistNames: {
				v1: "Ariana",
				v2: "The Weeknd",
				v4: "Both Together",
			},
		};

		const yaml = exportLyricsfileText(lyric);
		expect(yaml).toContain("name: Ariana");
		expect(yaml).toContain("name: The Weeknd");
		expect(yaml).toContain("name: Both Together");
		expect(yaml).toContain("vocalist:\n      - v4");
		expect(yaml).toContain("vocalist:\n      - v2-bg");

		const parsed = parseLyricsfile(yaml);
		expect(parsed.vocalistNames?.v1).toBe("Ariana");
		expect(parsed.vocalistNames?.v2).toBe("The Weeknd");
		expect(parsed.vocalistNames?.v4).toBe("Both Together");
		expect(parsed.lyricLines[0].isDuet).toBe(false);
		expect(parsed.lyricLines[1].isDuet).toBe(true);
		expect(parsed.lyricLines[2].isDuetGroup).toBe(true);
		expect(parsed.lyricLines[3].isDuet).toBe(true);
		expect(parsed.lyricLines[3].isBG).toBe(true);

		// Idempotent: names and ids survive a second export unchanged.
		expect(exportLyricsfileText(parsed)).toBe(yaml);
	});

	it("creates a line-synced line when words are absent", () => {
		const lyric: TTMLLyric = {
			metadata: [],
			lyricLines: [
				{
					...newLyricLine(),
					words: [word("Whole line", 100, 900)],
					startTime: 100,
					endTime: 900,
					isLineSynced: true,
				},
			],
		};
		const yaml = exportLyricsfileText(lyric);
		expect(yaml).not.toContain("words:");
		const parsed = parseLyricsfile(yaml);
		expect(parsed.lyricLines[0].isLineSynced).toBe(true);
		expect(parsed.lyricLines[0].words.map((w) => w.word)).toEqual(["Whole line"]);
	});
});
