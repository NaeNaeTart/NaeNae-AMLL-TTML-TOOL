import { type LazyExoticComponent, lazy as reactLazy } from "react";

type LazyComponent = Awaited<
	ReturnType<Parameters<typeof reactLazy>[0]>
>["default"];

/**
 * A wrapper around React.lazy that attempts to reload the page if a dynamic import fails.
 * This is common in single-page applications when a new version is deployed and asset hashes change.
 */
export function lazy<T extends LazyComponent>(
	factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
	return reactLazy(() =>
		factory().catch((error) => {
			// Check if it's a dynamic import failure (network error or 404 for a JS chunk)
			if (
				error instanceof TypeError ||
				error.name === "ChunkLoadError" ||
				/failed to fetch/i.test(error.message) ||
				/loading chunk/i.test(error.message)
			) {
				console.error(
					"Dynamic import failed. Forcing page refresh to get latest version.",
					error,
				);

				// Optional: Check if we've already tried to reload in the last few seconds to avoid loops
				const lastReload = sessionStorage.getItem("last-lazy-reload");
				const now = Date.now();

				if (!lastReload || now - Number(lastReload) > 10000) {
					sessionStorage.setItem("last-lazy-reload", String(now));
					window.location.reload();
				}
			}
			throw error;
		}),
	);
}
