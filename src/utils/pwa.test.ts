import { beforeEach, describe, expect, it, vi } from "vitest";

const updateServiceWorker = vi.fn();

vi.mock("virtual:pwa-register", () => ({
	registerSW: vi.fn(() => updateServiceWorker),
}));

const { clearWebsiteCache, forceWebsiteRefresh } = await import("./pwa");

describe("PWA recovery", () => {
	const reload = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		const cacheStorage = {
			keys: vi.fn(),
			delete: vi.fn(),
		};
		vi.stubGlobal("window", {
			location: { reload },
			caches: cacheStorage,
		});
		vi.stubGlobal("navigator", {
			serviceWorker: {
				getRegistration: vi.fn(),
				getRegistrations: vi.fn(),
			},
		});
		vi.stubGlobal("caches", cacheStorage);
	});

	it("activates a waiting update instead of reloading the stale worker", async () => {
		const update = vi.fn();
		const registration = { update, waiting: {} };
		vi.mocked(navigator.serviceWorker.getRegistration).mockResolvedValue(
			registration as unknown as ServiceWorkerRegistration,
		);

		await expect(forceWebsiteRefresh()).resolves.toBe(true);

		expect(update).toHaveBeenCalledOnce();
		expect(updateServiceWorker).toHaveBeenCalledOnce();
		expect(reload).not.toHaveBeenCalled();
	});

	it("reloads after checking when there is no waiting update", async () => {
		const update = vi.fn();
		vi.mocked(navigator.serviceWorker.getRegistration).mockResolvedValue({
			update,
		} as unknown as ServiceWorkerRegistration);

		await expect(forceWebsiteRefresh()).resolves.toBe(true);

		expect(update).toHaveBeenCalledOnce();
		expect(reload).toHaveBeenCalledOnce();
	});

	it("unregisters service workers and removes Cache Storage before reloading", async () => {
		const unregister = vi.fn();
		vi.mocked(navigator.serviceWorker.getRegistrations).mockResolvedValue([
			{ unregister } as unknown as ServiceWorkerRegistration,
		]);
		vi.mocked(caches.keys).mockResolvedValue(["workbox-precache", "runtime"]);

		await expect(clearWebsiteCache()).resolves.toBe(true);

		expect(unregister).toHaveBeenCalledOnce();
		expect(caches.delete).toHaveBeenCalledTimes(2);
		expect(reload).toHaveBeenCalledOnce();
	});

	it("does nothing when browser cache APIs are unavailable", async () => {
		vi.stubGlobal("navigator", {});

		await expect(clearWebsiteCache()).resolves.toBe(false);

		expect(reload).not.toHaveBeenCalled();
	});
});
