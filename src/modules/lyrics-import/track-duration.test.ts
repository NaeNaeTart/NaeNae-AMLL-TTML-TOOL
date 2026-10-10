import { describe, expect, it } from "vitest";
import {
	formatTrackDuration,
	matchesAudioDuration,
	prioritizeMatchingTracks,
} from "./track-duration";

describe("online import durations", () => {
	it("matches within two seconds inclusively and rejects unknown durations", () => {
		for (const duration of [178, 180, 182])
			expect(matchesAudioDuration(duration, 180)).toBe(true);
		for (const duration of [undefined, 0, Number.NaN, 177.9, 182.1])
			expect(matchesAudioDuration(duration, 180)).toBe(false);
		expect(matchesAudioDuration(180, 0)).toBe(false);
	});
	it("puts matches first while preserving relevance order and the input", () => {
		const tracks = [
			{ id: "fast", duration: 160 },
			{ id: "match", duration: 180 },
			{ id: "unknown" },
			{ id: "match2", duration: 182 },
		];
		expect(
			prioritizeMatchingTracks(tracks, 180).map((track) => track.id),
		).toEqual(["match", "match2", "fast", "unknown"]);
		expect(tracks[0].id).toBe("fast");
		expect(prioritizeMatchingTracks(tracks, 0)).toEqual(tracks);
	});
	it("formats seconds and carries rounded seconds into minutes", () => {
		expect(formatTrackDuration(181)).toBe("3:01");
		expect(formatTrackDuration(179.8)).toBe("3:00");
	});
});
