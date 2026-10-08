/** Missing fields in older presets leave the current appearance untouched. Null is intentional. */
export function applyDefinedPresetSettings<Settings extends object>(
	settings: Partial<Settings>,
	setters: Partial<{ [Key in keyof Settings]: (value: Settings[Key]) => void }>,
): void {
	for (const key of Object.keys(setters) as (keyof Settings)[]) {
		const value = settings[key];
		if (value !== undefined) setters[key]?.(value);
	}
}
