import { describe, expect, it, vi } from "vitest";
import {
	createHistoryActionGate,
	type ScheduleFrame,
} from "./history-action-gate";

describe("history action gate", () => {
	it("allows only one history action until the UI has painted", () => {
		const frames: Array<() => void> = [];
		const scheduleFrame: ScheduleFrame = (callback) => frames.push(callback);
		const runHistoryAction = createHistoryActionGate(scheduleFrame);
		const firstAction = vi.fn();
		const blockedAction = vi.fn();

		expect(runHistoryAction(firstAction)).toBe(true);
		expect(runHistoryAction(blockedAction)).toBe(false);
		expect(firstAction).toHaveBeenCalledOnce();
		expect(blockedAction).not.toHaveBeenCalled();

		frames.shift()?.();
		expect(runHistoryAction(blockedAction)).toBe(false);

		frames.shift()?.();
		expect(runHistoryAction(blockedAction)).toBe(true);
		expect(blockedAction).toHaveBeenCalledOnce();
	});

	it("unlocks immediately when a history action throws", () => {
		const runHistoryAction = createHistoryActionGate(() => undefined);
		const nextAction = vi.fn();

		expect(() =>
			runHistoryAction(() => {
				throw new Error("undo failed");
			}),
		).toThrow("undo failed");
		expect(runHistoryAction(nextAction)).toBe(true);
		expect(nextAction).toHaveBeenCalledOnce();
	});
});
