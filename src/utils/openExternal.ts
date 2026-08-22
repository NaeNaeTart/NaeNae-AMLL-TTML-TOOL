import { invoke } from "@tauri-apps/api/core";

export const openExternal = async (url: string) => {
	try {
		await invoke("plugin:shell|open", { path: url });
	} catch {
		window.open(url, "_blank", "noopener,noreferrer");
	}
};
