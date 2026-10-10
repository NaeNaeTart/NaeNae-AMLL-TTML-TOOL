import { describe, expect, it } from "vitest";
import { SyncJudgeMode } from "$/modules/settings/states";
import { calculateJudgeTime } from "./judge-time";

describe("sync judge time", () => {
	it.each(
		Object.values(SyncJudgeMode),
	)("uses the paused playhead plus offset in %s", (mode) => {
		for (const processingDelay of [0, 4, 75]) {
			for (const downTimeOffset of [0, 100, 999]) {
				expect(
					calculateJudgeTime({
						playheadSeconds: 20,
						playing: false,
						rate: 0.5,
						processingDelay,
						downTimeOffset,
						syncOffset: -25,
						mode,
					}),
				).toBe(19975);
			}
		}
	});
	it.each([
		[SyncJudgeMode.FirstKeyDownTime, 19940],
		[SyncJudgeMode.FirstKeyDownTimeLegacy, 19890],
		[SyncJudgeMode.LastKeyUpTime, 19990],
		[SyncJudgeMode.MiddleKeyTime, 19965],
	])("retains playing compensation in %s", (mode, expected) => {
		expect(
			calculateJudgeTime({
				playheadSeconds: 20,
				playing: true,
				rate: 0.5,
				processingDelay: 20,
				downTimeOffset: 100,
				syncOffset: 0,
				mode,
			}),
		).toBe(expected);
	});
	it("clamps a paused offset before zero", () => {
		expect(
			calculateJudgeTime({
				playheadSeconds: 0.01,
				playing: false,
				rate: 1,
				processingDelay: 5,
				downTimeOffset: 50,
				syncOffset: -100,
				mode: SyncJudgeMode.FirstKeyDownTimeLegacy,
			}),
		).toBe(0);
	});
});
