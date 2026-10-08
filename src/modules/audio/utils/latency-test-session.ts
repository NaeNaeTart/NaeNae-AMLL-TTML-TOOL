/** Register only during an open, running test; ignore any queued callback after cleanup. */
export function subscribeLatencyTestTaps<Event>(
	active: boolean,
	subscribe: (callback: (event: Event) => void) => () => void,
	onTap: (event: Event) => void,
): (() => void) | undefined {
	if (!active) return;
	let closed = false;
	const unsubscribe = subscribe((event) => {
		if (!closed) onTap(event);
	});
	return () => {
		closed = true;
		unsubscribe();
	};
}
