import { describe, expect, it } from "vitest";
import { AUDIO_EXTS, MAX_AUDIO_BYTES } from "./audio-io";
import {
	assertSafePath,
	ensureExtension,
	getFileExtension,
	getFileNameFromPath,
	isProjectManifest,
	isSafeProjectFileName,
	sanitizeFileName,
} from "./manifest";
import {
	isRecentProjectEntry,
	MAX_RECENT_PROJECTS,
	parseRecentProjectsRaw,
} from "./recent-projects";
import { PROJECT_MANIFEST_FILENAME } from "./types";

describe("isProjectManifest", () => {
	it("accepts a complete manifest", () => {
		expect(
			isProjectManifest({
				version: 1,
				name: "Song",
				audioFile: "audio.mp3",
				lyricFile: "lyric.ttml",
				coverFile: "cover.png",
				createdAt: 1,
				updatedAt: 2,
			}),
		).toBe(true);
	});

	it("accepts manifests with empty audio and lyric files", () => {
		expect(
			isProjectManifest({
				version: 1,
				name: "Song",
				audioFile: "",
				lyricFile: "",
			}),
		).toBe(true);
	});

	it("rejects wrong or missing versions", () => {
		expect(
			isProjectManifest({ name: "Song", audioFile: "", lyricFile: "" }),
		).toBe(false);
		expect(
			isProjectManifest({
				version: 2,
				name: "Song",
				audioFile: "",
				lyricFile: "",
			}),
		).toBe(false);
		expect(
			isProjectManifest({
				version: 0,
				name: "Song",
				audioFile: "",
				lyricFile: "",
			}),
		).toBe(false);
	});

	it("rejects non-objects, empty or whitespace names", () => {
		expect(isProjectManifest(null)).toBe(false);
		expect(isProjectManifest(undefined)).toBe(false);
		expect(isProjectManifest("project.json")).toBe(false);
		expect(
			isProjectManifest({
				version: 1,
				name: "",
				audioFile: "",
				lyricFile: "",
			}),
		).toBe(false);
		expect(
			isProjectManifest({
				version: 1,
				name: "   ",
				audioFile: "",
				lyricFile: "",
			}),
		).toBe(false);
	});

	it("rejects manifests with unsafe audio or lyric filenames", () => {
		expect(
			isProjectManifest({
				version: 1,
				name: "Song",
				audioFile: "../evil.mp3",
				lyricFile: "lyric.ttml",
			}),
		).toBe(false);
		expect(
			isProjectManifest({
				version: 1,
				name: "Song",
				audioFile: "audio.mp3",
				lyricFile: "sub/dir/lyric.ttml",
			}),
		).toBe(false);
		expect(
			isProjectManifest({
				version: 1,
				name: "Song",
				audioFile: "audio.mp3",
				lyricFile: "lyric.ttml",
				coverFile: "/root/cover.jpg",
			}),
		).toBe(false);
	});

	it("rejects manifests with NaN timestamps", () => {
		expect(
			isProjectManifest({
				version: 1,
				name: "Song",
				audioFile: "audio.mp3",
				lyricFile: "lyric.ttml",
				createdAt: Number.NaN,
			}),
		).toBe(false);
		expect(
			isProjectManifest({
				version: 1,
				name: "Song",
				audioFile: "audio.mp3",
				lyricFile: "lyric.ttml",
				updatedAt: "invalid",
			}),
		).toBe(false);
	});

	it("uses project.json as manifest filename", () => {
		expect(PROJECT_MANIFEST_FILENAME).toBe("project.json");
	});
});

describe("isSafeProjectFileName", () => {
	it("accepts ordinary names", () => {
		expect(isSafeProjectFileName("lyric.ttml")).toBe(true);
		expect(isSafeProjectFileName("audio file (1).mp3")).toBe(true);
	});

	it("rejects traversal and absolute paths", () => {
		expect(isSafeProjectFileName("..")).toBe(false);
		expect(isSafeProjectFileName("../secret.ttml")).toBe(false);
		expect(isSafeProjectFileName("sub/dir.ttml")).toBe(false);
		expect(isSafeProjectFileName("sub\\dir.ttml")).toBe(false);
		expect(isSafeProjectFileName("/abs.ttml")).toBe(false);
		expect(isSafeProjectFileName("C:evil.ttml")).toBe(false);
		expect(isSafeProjectFileName("a..b.ttml")).toBe(false);
	});

	it("rejects illegal characters and control codes", () => {
		expect(isSafeProjectFileName('a"b.ttml')).toBe(false);
		expect(isSafeProjectFileName("a<b.ttml")).toBe(false);
		expect(isSafeProjectFileName("")).toBe(false);
		expect(isSafeProjectFileName("a\u0007b.ttml")).toBe(false);
	});

	it("rejects Windows DOS reserved device names", () => {
		expect(isSafeProjectFileName("CON")).toBe(false);
		expect(isSafeProjectFileName("con.ttml")).toBe(false);
		expect(isSafeProjectFileName("PRN.mp3")).toBe(false);
		expect(isSafeProjectFileName("AUX")).toBe(false);
		expect(isSafeProjectFileName("NUL.txt")).toBe(false);
		expect(isSafeProjectFileName("com1.wav")).toBe(false);
		expect(isSafeProjectFileName("lpt9.flac")).toBe(false);
	});

	it("rejects hidden dotfiles and trailing characters", () => {
		expect(isSafeProjectFileName(".git")).toBe(false);
		expect(isSafeProjectFileName(".env")).toBe(false);
		expect(isSafeProjectFileName(".DS_Store")).toBe(false);
		expect(isSafeProjectFileName("song.ttml.")).toBe(false);
		expect(isSafeProjectFileName("audio ")).toBe(false);
	});

	it("rejects project.json as audio or lyric filename", () => {
		expect(isSafeProjectFileName("project.json")).toBe(false);
		expect(isSafeProjectFileName("PROJECT.JSON")).toBe(false);
	});
});

describe("assertSafePath", () => {
	const base = "C:/Users/Artist/Music/Project";

	it("resolves safe relative filenames inside the base directory", () => {
		expect(assertSafePath(base, "project.json")).toBe(
			"C:/Users/Artist/Music/Project/project.json",
		);
		expect(assertSafePath(base, "audio.mp3")).toBe(
			"C:/Users/Artist/Music/Project/audio.mp3",
		);
		expect(assertSafePath(base, "lyrics.ttml")).toBe(
			"C:/Users/Artist/Music/Project/lyrics.ttml",
		);
	});

	it("rejects parent traversal attempts", () => {
		expect(() => assertSafePath(base, "..")).toThrow(/Path traversal attempt/);
		expect(() => assertSafePath(base, "../other.json")).toThrow(
			/Path traversal attempt/,
		);
		expect(() => assertSafePath(base, "sub/../../other.json")).toThrow(
			/Path traversal attempt/,
		);
	});

	it("rejects absolute paths and drive letters", () => {
		expect(() => assertSafePath(base, "/etc/passwd")).toThrow(
			/Path traversal attempt/,
		);
		expect(() => assertSafePath(base, "\\Windows\\System32")).toThrow(
			/Path traversal attempt/,
		);
		expect(() => assertSafePath(base, "D:/evil/path.json")).toThrow(
			/Path traversal attempt/,
		);
		expect(() => assertSafePath(base, "C:evil.json")).toThrow(
			/Path traversal attempt/,
		);
	});

	it("rejects empty or control-character paths", () => {
		expect(() => assertSafePath(base, "")).toThrow(/cannot be empty/);
		expect(() => assertSafePath(base, "file\u0000.ttml")).toThrow(
			/control characters/,
		);
	});

	it("rejects URL-encoded traversal attempts", () => {
		expect(() => assertSafePath(base, "%2e%2e/evil.ttml")).toThrow(
			/Path traversal attempt/,
		);
		expect(() => assertSafePath(base, "%2e%2e%2fevil.ttml")).toThrow(
			/Path traversal attempt/,
		);
		expect(() => assertSafePath(base, "..%2fevil.ttml")).toThrow(
			/Path traversal attempt/,
		);
	});

	it("rejects Windows reserved device segments", () => {
		expect(() => assertSafePath(base, "CON")).toThrow(/reserved device name/);
		expect(() => assertSafePath(base, "NUL.ttml")).toThrow(
			/reserved device name/,
		);
	});
});

describe("filename helpers", () => {
	it("sanitizes illegal characters", () => {
		expect(sanitizeFileName("a/b:c")).toBe("a_b_c");
		expect(sanitizeFileName("   ")).toBe("Untitled");
	});

	it("ensures the extension once", () => {
		expect(ensureExtension("lyric", "ttml")).toBe("lyric.ttml");
		expect(ensureExtension("lyric.ttml", "ttml")).toBe("lyric.ttml");
		expect(ensureExtension("lyric.TTML", ".ttml")).toBe("lyric.TTML");
	});

	it("reads names and extensions from paths", () => {
		expect(getFileNameFromPath("C:\\music\\song.mp3")).toBe("song.mp3");
		expect(getFileNameFromPath("/music/song.mp3")).toBe("song.mp3");
		expect(getFileExtension("song.MP3")).toBe("mp3");
		expect(getFileExtension("noext")).toBe("");
	});
});

describe("recent projects LRU and deduplication", () => {
	it("validates recent project entries", () => {
		expect(
			isRecentProjectEntry({
				dir: "C:/Projects/Song",
				name: "Song",
				audioFile: "audio.mp3",
				lyricFile: "lyric.ttml",
				lastOpened: 123456,
			}),
		).toBe(true);

		expect(
			isRecentProjectEntry({
				dir: "",
				name: "Song",
				audioFile: "",
				lyricFile: "",
				lastOpened: 123456,
			}),
		).toBe(false);

		expect(
			isRecentProjectEntry({
				dir: "C:/Projects/Song",
				name: "Song",
				audioFile: "../evil.mp3",
				lyricFile: "lyric.ttml",
				lastOpened: 123456,
			}),
		).toBe(false);

		expect(
			isRecentProjectEntry({
				dir: "C:/Projects/Song",
				name: "Song",
				audioFile: "audio.mp3",
				lyricFile: "CON.ttml",
				lastOpened: 123456,
			}),
		).toBe(false);
	});

	it("parses and normalizes raw JSON safely", () => {
		expect(parseRecentProjectsRaw(null)).toEqual([]);
		expect(parseRecentProjectsRaw("invalid-json")).toEqual([]);
		expect(parseRecentProjectsRaw("{}")).toEqual([]);

		const list = parseRecentProjectsRaw(
			JSON.stringify([
				{
					dir: "C:/Projects/Song1",
					name: "Song 1",
					audioFile: "1.mp3",
					lyricFile: "1.ttml",
					lastOpened: 100,
				},
				{
					dir: "C:/Projects/Song2",
					name: "Song 2",
					audioFile: "2.mp3",
					lyricFile: "2.ttml",
					updatedAt: 200,
				},
			]),
		);
		expect(list.length).toBe(2);
		expect(list[0]?.name).toBe("Song 1");
		expect(list[1]?.name).toBe("Song 2");
		expect(list[1]?.lastOpened).toBe(200);
	});

	it("caps maximum recent projects to 50", () => {
		expect(MAX_RECENT_PROJECTS).toBe(50);
	});
});

describe("audio size boundary checks", () => {
	it("enforces 150MB safety limit", () => {
		expect(MAX_AUDIO_BYTES).toBe(150 * 1024 * 1024);
	});

	it("supports standard audio extensions", () => {
		expect(AUDIO_EXTS.has("flac")).toBe(true);
		expect(AUDIO_EXTS.has("wav")).toBe(true);
		expect(AUDIO_EXTS.has("mp3")).toBe(true);
		expect(AUDIO_EXTS.has("m4a")).toBe(true);
		expect(AUDIO_EXTS.has("ogg")).toBe(true);
		expect(AUDIO_EXTS.has("opus")).toBe(true);
	});
});
