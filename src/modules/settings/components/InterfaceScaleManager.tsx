import { useAtom } from "jotai";
import { useEffect } from "react";
import { error } from "$/utils/logging";
import {
	getInterfaceScaleForShortcut,
	normalizeInterfaceScale,
} from "../logic/interface-scale";
import { interfaceScaleAtom } from "../states";

export function InterfaceScaleManager() {
	const [interfaceScale, setInterfaceScale] = useAtom(interfaceScaleAtom);
	const normalizedScale = normalizeInterfaceScale(interfaceScale);
	const isTauri = Boolean(import.meta.env.TAURI_ENV_PLATFORM);

	useEffect(() => {
		if (!isTauri) return;

		if (normalizedScale !== interfaceScale) {
			setInterfaceScale(normalizedScale);
		}

		import("@tauri-apps/api/webview")
			.then(({ getCurrentWebview }) =>
				getCurrentWebview().setZoom(normalizedScale),
			)
			.catch((reason) => error("Failed to update interface scale", reason));
	}, [interfaceScale, isTauri, normalizedScale, setInterfaceScale]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

			const nextScale = getInterfaceScaleForShortcut(
				interfaceScale,
				event.key,
				isTauri,
			);
			if (nextScale === undefined) return;

			event.preventDefault();
			setInterfaceScale(nextScale);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [interfaceScale, isTauri, setInterfaceScale]);

	return null;
}
