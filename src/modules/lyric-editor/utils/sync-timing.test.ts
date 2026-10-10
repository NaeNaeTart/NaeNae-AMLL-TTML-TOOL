import { describe, expect, it } from "vitest";
import { SyncJudgeMode } from "$/modules/settings/states";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { calculateSyncTime, setPendingUnitTimeCloned } from "./sync-timing";

const baseOptions = {
	audioTimeSeconds: 10,
	playbackRate: 1,
	isPlaying: true,
	event: { downTimeOffset: 200, triggerTime: 1_000 },
	syncTimeOffset: 0,
	performanceTime: 1_050,
};

describe("calculateSyncTime", () => {
	it("removes callback delay and uses the first key-down instant", () => {
		expect(
			calculateSyncTime({
				...baseOptions,
				judgeMode: SyncJudgeMode.FirstKeyDownTime,
			}),
		).toBe(9_750);
	});

	it("uses the key-up or midpoint instant when configured", () => {
		expect(
			calculateSyncTime({
				...baseOptions,
				judgeMode: SyncJudgeMode.LastKeyUpTime,
			}),
		).toBe(9_950);
		expect(
			calculateSyncTime({
				...baseOptions,
				judgeMode: SyncJudgeMode.MiddleKeyTime,
			}),
		).toBe(9_850);
	});

	it("scales real-time delays by playback rate", () => {
		expect(
			calculateSyncTime({
				...baseOptions,
				playbackRate: 0.5,
				judgeMode: SyncJudgeMode.FirstKeyDownTime,
			}),
		).toBe(9_875);
	});

	it("preserves legacy key-down adjustment while playback is paused", () => {
		expect(
			calculateSyncTime({
				...baseOptions,
				isPlaying: false,
				judgeMode: SyncJudgeMode.FirstKeyDownTimeLegacy,
			}),
		).toBe(9_750);
	});

	it("normalizes epoch-based event timestamps", () => {
		expect(
			calculateSyncTime({
				...baseOptions,
				event: {
					downTimeOffset: 0,
					triggerTime: 1_700_000_001_000,
				},
				performanceTimeOrigin: 1_700_000_000_000,
				judgeMode: SyncJudgeMode.LastKeyUpTime,
			}),
		).toBe(9_950);
	});

	it("applies action offsets before clamping the final result", () => {
		expect(
			calculateSyncTime({
				...baseOptions,
				audioTimeSeconds: 0.1,
				event: { downTimeOffset: 0, triggerTime: 1_050 },
				judgeMode: SyncJudgeMode.LastKeyUpTime,
				actionOffset: -500,
			}),
		).toBe(0);
	});
});

describe("setPendingUnitTimeCloned", () => {
	it("replaces a stale next-word end with the new shared boundary", () => {
		const word = {
			...newLyricWord(),
			word: "to",
			startTime: 1_000,
			endTime: 1_500,
		};
		const line = { ...newLyricLine(), words: [word] };
		setPendingUnitTimeCloned(line, 0, undefined, 2_000);
		expect(line.words[0]).toMatchObject({ startTime: 2_000, endTime: 2_000 });
		expect(line.words[0]).not.toBe(word);
	});

	it("updates a pending ruby unit and recalculates its parent bounds", () => {
		const line = {
			...newLyricLine(),
			words: [
				{
					...newLyricWord(),
					word: "word",
					startTime: 1_000,
					endTime: 1_800,
					ruby: [
						{ word: "a", startTime: 1_000, endTime: 1_400 },
						{ word: "b", startTime: 1_400, endTime: 1_800 },
					],
				},
			],
		};
		setPendingUnitTimeCloned(line, 0, 1, 2_000);
		expect(line.words[0].ruby?.[1]).toMatchObject({
			startTime: 2_000,
			endTime: 2_000,
		});
		expect(line.words[0]).toMatchObject({ startTime: 1_000, endTime: 2_000 });
	});
});
