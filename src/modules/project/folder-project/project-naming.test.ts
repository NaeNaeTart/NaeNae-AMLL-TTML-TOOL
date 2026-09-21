import { describe, expect, it } from "vitest";
import {
	DEFAULT_PROJECT_NAME,
	getSongInfo,
	pickFolderName,
	resolveProjectName,
	toSafeFolderName,
} from "./project-naming";

const meta = (musicName?: string, artists?: string) => [
	...(musicName ? [{ key: "musicName", value: [musicName] }] : []),
	...(artists ? [{ key: "artists", value: [artists] }] : []),
];

describe("resolveProjectName", () => {
	it("prefers artist - title metadata", () => {
		expect(resolveProjectName({ metadata: meta("Song", "Artist") })).toEqual({
			name: "Artist - Song",
			isTemplate: false,
		});
	});

	it("falls back to title, lyric file, audio file, then template", () => {
		expect(resolveProjectName({ metadata: meta("Song") }).name).toBe("Song");
		expect(resolveProjectName({ lyricFileName: "cool.ttml" }).name).toBe(
			"cool",
		);
		expect(resolveProjectName({ audioFileName: "track.flac" }).name).toBe(
			"track",
		);
		expect(resolveProjectName({})).toEqual({
			name: DEFAULT_PROJECT_NAME,
			isTemplate: true,
		});
	});
});

describe("pickFolderName", () => {
	it("numbers the template from 1", () => {
		const r = resolveProjectName({});
		expect(pickFolderName(r, new Set())).toBe(`${DEFAULT_PROJECT_NAME}-1`);
		expect(pickFolderName(r, new Set([`${DEFAULT_PROJECT_NAME}-1`]))).toBe(
			`${DEFAULT_PROJECT_NAME}-2`,
		);
	});

	it("uses real names as-is and suffixes only on collision", () => {
		const r = resolveProjectName({ metadata: meta("Song", "Artist") });
		expect(pickFolderName(r, new Set())).toBe("Artist - Song");
		expect(pickFolderName(r, new Set(["artist - song"]))).toBe(
			"Artist - Song-2",
		);
	});
});

describe("toSafeFolderName", () => {
	it("rejects unsafe or empty names", () => {
		expect(toSafeFolderName("CON")).toBe("");
		expect(toSafeFolderName("...")).toBe("");
		expect(toSafeFolderName("a/b:c")).toBe("a_b_c");
		expect(toSafeFolderName("../evil")).not.toContain("..");
	});
});

describe("getSongInfo", () => {
	it("captures title, artists and audio size", () => {
		expect(getSongInfo(meta("Song", "Artist"), 42)).toEqual({
			title: "Song",
			artists: "Artist",
			audioSize: 42,
		});
	});
});
