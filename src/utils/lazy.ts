import { lazy as reactLazy, type ComponentType, type LazyExoticComponent } from "react";

export function lazy<T extends ComponentType<any>>(
	factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
	return reactLazy(() =>
		factory().catch((error) => {
			if (
				error instanceof TypeError ||
				error.name === "ChunkLoadError" ||
				/failed to fetch/i.test(error.message) ||
				/loading chunk/i.test(error.message)
			) {
				console.error("Dynamic import failed. Forcing page refresh to get latest version.", error);
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
