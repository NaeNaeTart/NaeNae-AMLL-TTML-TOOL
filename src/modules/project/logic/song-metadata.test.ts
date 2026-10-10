import { describe, expect, it } from "vitest";
import type { TTMLMetadata } from "$/types/ttml";
import {
	fillEmptySongMetadata,
	getAudioSearchQuery,
	getImportFileName,
	songMetadataFromTags,
} from "./song-metadata";

describe("song metadata defaults", () => {
	it("reads case-insensitive container and ID3 tags", () => {
		expect(
			songMetadataFromTags({
				TITLE: " Track ",
				ARTIST: " Singer ",
				ALBUM: " Album ",
				ISRC: "GBABC2600001",
			}),
		).toEqual({
			title: "Track",
			artist: "Singer",
			album: "Album",
			isrc: "GBABC2600001",
		});
		expect(
			songMetadataFromTags({
				TIT2: "Track",
				TPE1: "Singer",
				TALB: "Album",
				TSRC: "GBABC2600001",
			}),
		).toEqual({
			title: "Track",
			artist: "Singer",
			album: "Album",
			isrc: "GBABC2600001",
		});
	});
	it("fills blank fields without replacing any user value, even duplicate keys", () => {
		const metadata: TTMLMetadata[] = [
			{ key: "musicName", value: ["", "My title"] },
			{ key: "artists", value: [" "] },
			{ key: "album", value: [] },
			{ key: "album", value: ["My album"] },
		];
		expect(
			fillEmptySongMetadata(metadata, {
				title: "Other title",
				artist: "Singer",
				album: "Other album",
				isrc: "GBABC2600001",
			}),
		).toBe(true);
		expect(metadata).toEqual([
			{ key: "musicName", value: ["", "My title"] },
			{ key: "artists", value: ["Singer"] },
			{ key: "album", value: [] },
			{ key: "album", value: ["My album"] },
			{ key: "isrc", value: ["GBABC2600001"] },
		]);
		expect(
			fillEmptySongMetadata(metadata, { artist: "Replacement", cover: " " }),
		).toBe(false);
	});
	it("prefers tags for search and strips only the filename extension", () => {
		expect(
			getAudioSearchQuery(
				{ artist: "Singer", title: "Track" },
				"wrong.version.flac",
			),
		).toBe("Singer - Track");
		expect(getAudioSearchQuery({}, "Singer - Track.live.flac")).toBe(
			"Singer - Track.live",
		);
		expect(getAudioSearchQuery({ title: "Track" }, "file.mp3")).toBe("Track");
	});
	it("suggests safe import names only for default or untitled documents", () => {
		const song = { artist: "Singer", title: "Track/Live" };
		expect(getImportFileName("lyric.ttml", song)).toBe(
			"Singer - Track-Live.ttml",
		);
		expect(getImportFileName("Untitled.ttml", song)).toBe(
			"Singer - Track-Live.ttml",
		);
		expect(getImportFileName("My project.ttml", song)).toBe("My project.ttml");
		expect(getImportFileName("lyric.ttml", {})).toBe("lyric.ttml");
	});
});
