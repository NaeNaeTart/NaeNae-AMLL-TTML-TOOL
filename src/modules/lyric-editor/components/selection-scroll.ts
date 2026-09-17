import { ToolMode } from "$/states/main.ts";

export const AUTO_SCROLL_PAUSE_MS = 3500;

export const shouldAutoCenterSelection = (toolMode: ToolMode) =>
	toolMode === ToolMode.Sync;

export interface RenderedLinePosition {
	index: number;
	top: number;
	height: number;
}

export const findClosestLineToViewportCenter = (
	viewportCenter: number,
	lines: RenderedLinePosition[],
) => {
	let closestIndex = -1;
	let closestDistance = Number.POSITIVE_INFINITY;
	for (const line of lines) {
		const distance = Math.abs(line.top + line.height / 2 - viewportCenter);
		if (distance < closestDistance) {
			closestDistance = distance;
			closestIndex = line.index;
		}
	}
	return closestIndex;
};

export const calculateScrollDuration = (
	distance: number,
	explicitDuration?: number,
): number => {
	if (explicitDuration !== undefined) return explicitDuration;
	const absDistance = Math.abs(distance);
	return Math.round(
		Math.min(750, Math.max(280, 240 + Math.sqrt(absDistance) * 8)),
	);
};

export const easeInOutSine = (t: number): number =>
	-(Math.cos(Math.PI * t) - 1) / 2;
