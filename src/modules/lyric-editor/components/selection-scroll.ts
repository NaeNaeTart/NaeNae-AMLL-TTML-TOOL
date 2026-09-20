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

export interface ResolveAnchorParams {
	syncTabPosition: boolean;
	toolMode: ToolMode;
	modeAnchor: number;
	sharedAnchor: number;
	selectedLineIds: Set<string>;
	currentTime: number;
	lines: any[];
	previousMode: ToolMode;
	syncFocusMainLine: boolean;
	findCurrentLineIndex: (
		lines: any[],
		currentTime: number,
		focusMainLine: boolean,
	) => number;
}

export const resolveAnchorLineIndex = ({
	syncTabPosition,
	modeAnchor,
	sharedAnchor,
	selectedLineIds,
	currentTime,
	lines,
	previousMode,
	syncFocusMainLine,
	findCurrentLineIndex,
}: ResolveAnchorParams): number => {
	if (!syncTabPosition) {
		return modeAnchor;
	}

	let targetLineIndex = -1;
	if (previousMode === ToolMode.Preview && currentTime > 0) {
		targetLineIndex = findCurrentLineIndex(lines, currentTime, syncFocusMainLine);
		if (targetLineIndex === -1) {
			const upcoming = lines.findIndex((l) => l.startTime >= currentTime);
			if (upcoming !== -1) targetLineIndex = upcoming;
		}
	} else {
		if (selectedLineIds.size > 0) {
			targetLineIndex = lines.findIndex((l) => selectedLineIds.has(l.id));
		}
		if (targetLineIndex === -1 && currentTime > 0) {
			targetLineIndex = findCurrentLineIndex(lines, currentTime, syncFocusMainLine);
			if (targetLineIndex === -1) {
				const upcoming = lines.findIndex((l) => l.startTime >= currentTime);
				if (upcoming !== -1) targetLineIndex = upcoming;
			}
		}
	}

	if (targetLineIndex === -1) {
		targetLineIndex = sharedAnchor;
	}

	return targetLineIndex;
};

