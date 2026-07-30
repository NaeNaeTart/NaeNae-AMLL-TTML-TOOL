export const DRAG_SCROLL_EDGE_SIZE = 48;
export const DRAG_SCROLL_SPEED = 600;

export type VerticalScrollDirection = -1 | 0 | 1;

export const getDragScrollDirection = (
	clientY: number,
	viewport: Pick<DOMRect, "top" | "bottom">,
	edgeSize = DRAG_SCROLL_EDGE_SIZE,
): VerticalScrollDirection => {
	if (clientY <= viewport.top + edgeSize) return -1;
	if (clientY >= viewport.bottom - edgeSize) return 1;
	return 0;
};

export const clampScrollTop = (
	scrollTop: number,
	delta: number,
	maxScrollTop: number,
) => Math.min(Math.max(scrollTop + delta, 0), Math.max(maxScrollTop, 0));

export const normalizeWheelDelta = (
	deltaY: number,
	deltaMode: number,
	lineHeight: number,
	pageHeight: number,
) => {
	if (deltaMode === 1) return deltaY * lineHeight;
	if (deltaMode === 2) return deltaY * pageHeight;
	return deltaY;
};
