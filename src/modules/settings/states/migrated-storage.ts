import { atomWithStorage, createJSONStorage } from "jotai/utils";

/** Copy legacy defaults once, before any component or imperative reader uses them. */
export function atomWithMigratedStorage<
	Value extends boolean | number | string,
>(
	key: string,
	initialValue: Value,
	options: {
		legacyKey?: string;
		obsoleteKeys?: string[];
		normalize?: (value: Value) => Value;
	} = {},
) {
	const storage = createJSONStorage<Value>();
	return atomWithStorage(
		key,
		initialValue,
		{
			...storage,
			getItem: (storageKey, fallback) => {
				let value = fallback;
				try {
					const local = window.localStorage;
					const current = local.getItem(storageKey);
					const legacy = options.legacyKey
						? local.getItem(options.legacyKey)
						: null;
					const raw = current ?? legacy;
					if (raw !== null) {
						const parsed: unknown = JSON.parse(raw);
						if (typeof parsed === typeof fallback) value = parsed as Value;
					}
					if (options.normalize) value = options.normalize(value);
					// Persist the copied default so subsequent changes to the old mode stay independent.
					if (
						(current === null && options.legacyKey !== undefined) ||
						(options.normalize !== undefined && raw !== null)
					) {
						storage.setItem(storageKey, value);
					}
					for (const obsoleteKey of options.obsoleteKeys ?? [])
						local.removeItem(obsoleteKey);
				} catch {
					// Storage can be unavailable in private browsing or server-side rendering.
				}
				return value;
			},
		},
		{ getOnInit: true },
	);
}
