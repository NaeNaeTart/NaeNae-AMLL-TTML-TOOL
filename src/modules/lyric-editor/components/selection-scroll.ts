import { ToolMode } from "$/states/main.ts";

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
