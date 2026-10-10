/** Zero is a valid start; only a zero start AND end mean no timing yet. */
export const hasNoTiming = (item: { startTime: number; endTime: number }) =>
	item.startTime === 0 && item.endTime === 0;
