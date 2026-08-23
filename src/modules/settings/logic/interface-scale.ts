export const MIN_INTERFACE_SCALE = 0.75;
export const MAX_INTERFACE_SCALE = 1.5;
export const DEFAULT_INTERFACE_SCALE = 1;
export const INTERFACE_SCALE_STEP = 0.05;

export function normalizeInterfaceScale(value: number): number {
	const finiteValue = Number.isFinite(value) ? value : DEFAULT_INTERFACE_SCALE;
	const rounded =
		Math.round(finiteValue / INTERFACE_SCALE_STEP) * INTERFACE_SCALE_STEP;
	return Math.min(
		MAX_INTERFACE_SCALE,
		Math.max(MIN_INTERFACE_SCALE, Number(rounded.toFixed(2))),
	);
}

export function getInterfaceScaleForShortcut(
	currentScale: number,
	key: string,
	isTauri = true,
): number | undefined {
	if (!isTauri) return undefined;
	if (key === "0") return DEFAULT_INTERFACE_SCALE;
	if (key === "+" || key === "=") {
		return normalizeInterfaceScale(currentScale + INTERFACE_SCALE_STEP);
	}
	if (key === "-" || key === "_") {
		return normalizeInterfaceScale(currentScale - INTERFACE_SCALE_STEP);
	}
	return undefined;
}
