import { useAtom } from "jotai";
import { useEffect } from "react";
import {
	cmdInterfaceScaleDown,
	cmdInterfaceScaleReset,
	cmdInterfaceScaleUp,
	cmdInterfaceScaleUpAlternate,
} from "$/modules/keyboard/commands";
import { useCommand } from "$/modules/keyboard/hooks";
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

	const changeScale = (key: string) => {
		setInterfaceScale(
			(scale) => getInterfaceScaleForShortcut(scale, key) ?? scale,
		);
	};
	useCommand(cmdInterfaceScaleUp, () => changeScale("+"), [], isTauri);
	useCommand(cmdInterfaceScaleUpAlternate, () => changeScale("+"), [], isTauri);
	useCommand(cmdInterfaceScaleDown, () => changeScale("-"), [], isTauri);
	useCommand(cmdInterfaceScaleReset, () => changeScale("0"), [], isTauri);

	return null;
}
