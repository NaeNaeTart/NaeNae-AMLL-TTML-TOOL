import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { aiSidebarPersistKeyAtom } from "$/modules/settings/states";
import type { AiPersonality } from "./logic";

const storedApiKeyAtom = atomWithStorage("aiSidebarApiKey", "");
const sessionApiKeyAtom = atom("");

export const aiSidebarApiKeyAtom = atom(
	(get) =>
		get(aiSidebarPersistKeyAtom)
			? get(storedApiKeyAtom)
			: get(sessionApiKeyAtom),
	(get, set, value: string) => {
		set(sessionApiKeyAtom, value);
		if (get(aiSidebarPersistKeyAtom)) set(storedApiKeyAtom, value);
	},
);

export const clearStoredAiApiKeyAtom = atom(null, (_get, set) => {
	set(storedApiKeyAtom, "");
});

export const aiSidebarPersonalityAtom = atomWithStorage<AiPersonality>(
	"aiSidebarPersonality",
	"glazer",
);
