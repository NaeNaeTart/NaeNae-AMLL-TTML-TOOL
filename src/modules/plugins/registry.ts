export type { PluginRegistryEntry } from "./types";

// Replace this with your actual registry URL
export const REMOTE_REGISTRY_URL = "https://raw.githubusercontent.com/NaeNaeTart/verycool-plugins/main/registry.json";

export const OFFICIAL_PLUGIN_REGISTRY: PluginRegistryEntry[] = [];

export async function fetchRemoteRegistry(): Promise<PluginRegistryEntry[]> {
	try {
		const res = await fetch(REMOTE_REGISTRY_URL);
		if (!res.ok) throw new Error("Failed to fetch registry");
		return await res.json();
	} catch (e) {
		console.error("Registry fetch failed, falling back to offline list:", e);
		return OFFICIAL_PLUGIN_REGISTRY;
	}
}

export const getRegistryEntry = (id: string) => OFFICIAL_PLUGIN_REGISTRY.find(e => e.id === id);
