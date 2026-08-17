export type ScheduleFrame = (callback: () => void) => unknown;

/** Prevents full-project history renders from stacking faster than the UI can paint. */
export function createHistoryActionGate(scheduleFrame: ScheduleFrame) {
	let pending = false;

	return (action: () => void): boolean => {
		if (pending) return false;

		pending = true;
		try {
			action();
		} catch (error) {
			pending = false;
			throw error;
		}

		scheduleFrame(() => {
			scheduleFrame(() => {
				pending = false;
			});
		});
		return true;
	};
}
