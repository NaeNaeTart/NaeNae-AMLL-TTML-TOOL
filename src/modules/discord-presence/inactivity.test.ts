import { afterEach, describe, expect, it, vi } from "vitest";
import { InactivityTimer, shouldResetInactivity } from "./inactivity";

afterEach(() => vi.useRealTimers());

describe("InactivityTimer", () => {
	it("accepts only trusted activity from a visible document", () => {
		expect(shouldResetInactivity(true, "visible")).toBe(true);
		expect(shouldResetInactivity(false, "visible")).toBe(false);
		expect(shouldResetInactivity(true, "hidden")).toBe(false);
	});

	it("becomes inactive after the configured delay", () => {
		vi.useFakeTimers();
		const changes: boolean[] = [];
		const timer = new InactivityTimer(300_000, (inactive) =>
			changes.push(inactive),
		);
		timer.start();
		vi.advanceTimersByTime(299_999);
		expect(changes).toEqual([]);
		vi.advanceTimersByTime(1);
		expect(changes).toEqual([true]);
	});

	it("resets on activity and resumes immediately from inactivity", () => {
		vi.useFakeTimers();
		const changes: boolean[] = [];
		const timer = new InactivityTimer(100, (inactive) =>
			changes.push(inactive),
		);
		timer.start();
		vi.advanceTimersByTime(80);
		timer.activity();
		vi.advanceTimersByTime(99);
		expect(changes).toEqual([]);
		vi.advanceTimersByTime(1);
		timer.activity();
		expect(changes).toEqual([true, false]);
	});

	it("reschedules when the timeout changes and stops cleanly", () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const timer = new InactivityTimer(100, onChange);
		timer.start();
		timer.setTimeoutMs(200);
		vi.advanceTimersByTime(150);
		expect(onChange).not.toHaveBeenCalled();
		timer.stop();
		vi.advanceTimersByTime(100);
		expect(onChange).not.toHaveBeenCalled();
	});
});
