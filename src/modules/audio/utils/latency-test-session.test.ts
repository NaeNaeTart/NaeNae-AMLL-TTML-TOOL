import { describe, expect, it, vi } from "vitest";
import { subscribeLatencyTestTaps } from "./latency-test-session";

describe("latency test tap lifecycle", () => {
	it("does not subscribe while closed or stopped", () => {
		const subscribe = vi.fn(() => vi.fn());
		expect(subscribeLatencyTestTaps(false, subscribe, vi.fn())).toBeUndefined();
		expect(subscribe).not.toHaveBeenCalled();
	});
	it("unregisters on close/unmount and rejects a queued tap after cleanup", () => {
		let callback = (_event: number) => {};
		const unsubscribe = vi.fn();
		const onTap = vi.fn();
		const cleanup = subscribeLatencyTestTaps(
			true,
			(listener) => {
				callback = listener;
				return unsubscribe;
			},
			onTap,
		);
		callback(10);
		expect(onTap).toHaveBeenCalledWith(10);
		cleanup?.();
		callback(20);
		expect(unsubscribe).toHaveBeenCalledOnce();
		expect(onTap).toHaveBeenCalledTimes(1);
	});
});
