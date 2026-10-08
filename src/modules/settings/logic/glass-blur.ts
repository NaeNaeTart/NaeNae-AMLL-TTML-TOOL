export const DEFAULT_GLASS_BLUR = 24;
export const MAX_GLASS_BLUR = 64;

export function clampGlassBlur(value: number): number {
	return Number.isFinite(value)
		? Math.min(MAX_GLASS_BLUR, Math.max(0, value))
		: DEFAULT_GLASS_BLUR;
}

/** Old presets can contain both values; glassBlur was the main control. */
export function getPresetGlassBlur(settings: {
	glassBlur?: number;
	vBackdrop?: number;
}): number | undefined {
	const value = settings.glassBlur ?? settings.vBackdrop;
	return value === undefined ? undefined : clampGlassBlur(value);
}
