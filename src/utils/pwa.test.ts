import { beforeEach, describe, expect, it, vi } from "vitest";

const updateServiceWorker = vi.fn();

vi.mock("virtual:pwa-register", () => ({
	registerSW: vi.fn(() => updateServiceWorker),
}));

const { clearWebsiteCache, forceWebsiteRefresh } = await import("./pwa");

describe("PWA recovery", () => {
	const reload = vi.fn();
	const getRegistration =
		vi.fn<
			() => Promise<
				{ update: () => Promise<void>; waiting?: object } | undefined
			>
		>();
	const getRegistrations =
		vi.fn<() => Promise<{ unregister: () => Promise<boolean> }[]>>();

	beforeEach(() => {
		vi.clearAllMocks();
		getRegistration.mockReset();
		getRegistrations.mockReset();
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
				getRegistration,
				getRegistrations,
			},
		});
		vi.stubGlobal("caches", cacheStorage);
	});

	it("activates a waiting update instead of reloading the stale worker", async () => {
		const update = vi.fn<() => Promise<void>>().mockResolvedValue();
		const registration = { update, waiting: {} };
		getRegistration.mockResolvedValue(registration);

		await expect(forceWebsiteRefresh()).resolves.toBe(true);

		expect(update).toHaveBeenCalledOnce();
		expect(updateServiceWorker).toHaveBeenCalledOnce();
		expect(reload).not.toHaveBeenCalled();
	});

	it("reloads after checking when there is no waiting update", async () => {
		const update = vi.fn<() => Promise<void>>().mockResolvedValue();
		getRegistration.mockResolvedValue({ update });

		await expect(forceWebsiteRefresh()).resolves.toBe(true);

		expect(update).toHaveBeenCalledOnce();
		expect(reload).toHaveBeenCalledOnce();
	});

	it("unregisters service workers and removes Cache Storage before reloading", async () => {
		const unregister = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
		getRegistrations.mockResolvedValue([{ unregister }]);
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
