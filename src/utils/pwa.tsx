import { registerSW } from "virtual:pwa-register";
import { Button, Flex } from "@radix-ui/themes";
import { t } from "i18next";
import { toast } from "react-toastify";

const isWebsite = !import.meta.env.TAURI_ENV_PLATFORM;
let updateServiceWorker: (() => Promise<void>) | undefined;

const reloadPage = () => window.location.reload();

if (isWebsite) {
	updateServiceWorker = registerSW({
		onOfflineReady() {
			toast.info(
				t("pwa.offlineReady", "网站已成功离线缓存，后续可离线访问本网页"),
			);
		},
		onNeedRefresh() {
			toast.info(
				<Flex direction="column" gap="2" align="stretch">
					<div>
						{t("pwa.updateRefresh", "网站已更新，刷新网页以使用最新版本！")}
					</div>
					<Button
						size="2"
						onClick={() => {
							void updateServiceWorker?.();
						}}
					>
						{t("pwa.refresh", "刷新")}
					</Button>
				</Flex>,
			);
		},
	});
}

/** Check for a pending service worker update, then reload the website. */
export async function forceWebsiteRefresh() {
	if (!isWebsite || !("serviceWorker" in navigator)) {
		return false;
	}

	const registration = await navigator.serviceWorker.getRegistration();
	await registration?.update();

	if (registration?.waiting && updateServiceWorker) {
		await updateServiceWorker();
		return true;
	}

	reloadPage();
	return true;
}

/** Remove only this site's PWA Cache Storage data before reloading. */
export async function clearWebsiteCache() {
	if (!isWebsite || !("serviceWorker" in navigator) || !("caches" in window)) {
		return false;
	}

	const [registrations, cacheNames] = await Promise.all([
		navigator.serviceWorker.getRegistrations(),
		caches.keys(),
	]);

	await Promise.all([
		...registrations.map((registration) => registration.unregister()),
		...cacheNames.map((cacheName) => caches.delete(cacheName)),
	]);

	reloadPage();
	return true;
}
