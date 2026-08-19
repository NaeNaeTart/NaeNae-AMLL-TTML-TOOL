import { describe, expect, it } from "vitest";
import type { SpotifyTrack } from "../types";
import {
	extractTrackId,
	formatDuration,
	normalize,
	scoreCandidate,
	sequenceMatcherRatio,
	similarity,
} from "./similarity";

describe("SpotMatch similarity utils", () => {
	it("extracts 22-character Spotify track ID from various inputs", () => {
		expect(extractTrackId("4uLU6hMCjMI75M1A2tKUQC")).toBe(
			"4uLU6hMCjMI75M1A2tKUQC",
		);
		expect(extractTrackId("spotify:track:4uLU6hMCjMI75M1A2tKUQC")).toBe(
			"4uLU6hMCjMI75M1A2tKUQC",
		);
		expect(
			extractTrackId(
				"https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=12345",
			),
		).toBe("4uLU6hMCjMI75M1A2tKUQC");
		expect(extractTrackId("invalid_id")).toBeNull();
		expect(extractTrackId("")).toBeNull();
	});

	it("normalizes text with diacritics, ampersands, and punctuation", () => {
		expect(normalize("Café & Bar!")).toBe("cafe and bar");
		expect(normalize("Beyoncé")).toBe("beyonce");
		expect(normalize("Song (Remastered 2021) - Live")).toBe(
			"song remastered 2021 live",
		);
		expect(normalize("  Artist A & Artist B  ")).toBe("artist a and artist b");
	});

	it("calculates Ratcliff-Obershelp similarity ratio", () => {
		expect(sequenceMatcherRatio("hello", "hello")).toBe(1.0);
		expect(sequenceMatcherRatio("hello", "")).toBe(0.0);
		expect(sequenceMatcherRatio("", "")).toBe(1.0);
		expect(sequenceMatcherRatio("abcd", "abce")).toBe(0.75);
		expect(
			similarity("Never Gonna Give You Up", "never gonna give you up"),
		).toBe(1.0);
		expect(similarity("Hello World", "Hello")).toBeGreaterThan(0.5);
	});

	it("formats durations accurately", () => {
		expect(formatDuration(0)).toBe("0:00");
		expect(formatDuration(65000)).toBe("1:05");
		expect(formatDuration(215000)).toBe("3:35");
	});

	it("scores candidate tracks according to SpotMatch formula", () => {
		const source: SpotifyTrack = {
			id: "source123456789012345",
			name: "Bohemian Rhapsody",
			artists: [{ id: "a1", name: "Queen" }],
			album: { id: "alb1", name: "A Night at the Opera" },
			duration_ms: 354000,
		};

		const exactMatch: SpotifyTrack = {
			id: "candidate1234567890123",
			name: "Bohemian Rhapsody",
			artists: [{ id: "a1", name: "Queen" }],
			album: { id: "alb2", name: "Greatest Hits" },
			duration_ms: 354000,
		};

		const candidateResult = scoreCandidate(source, exactMatch);
		expect(candidateResult.score).toBe(100);
		expect(candidateResult.duration_delta_ms).toBe(0);
		expect(candidateResult.album).toBe("Greatest Hits");

		const slightDiff: SpotifyTrack = {
			id: "candidate2234567890123",
			name: "Bohemian Rhapsody - Remastered 2011",
			artists: [{ id: "a1", name: "Queen" }],
			album: { id: "alb3", name: "A Night at the Opera (Deluxe Edition)" },
			duration_ms: 355000,
		};

		const diffResult = scoreCandidate(source, slightDiff);
		expect(diffResult.score).toBeGreaterThanOrEqual(70);
		expect(diffResult.duration_delta_ms).toBe(1000);
	});
});
