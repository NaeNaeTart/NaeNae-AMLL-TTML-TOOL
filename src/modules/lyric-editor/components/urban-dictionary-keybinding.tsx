import { useStore, useAtomValue } from "jotai";
import { type FC, useCallback } from "react";
import {
	keyUrbanDictionaryAtom,
	keyUrbanDictionarySyncAtom,
} from "$/states/keybindings.ts";
import {
	lyricLinesAtom,
	selectedWordsAtom,
	toolModeAtom,
	ToolMode,
} from "$/states/main.ts";
import {
	useKeyBindingAtom,
} from "$/utils/keybindings.ts";
import { urbanDictionaryDialogAtom } from "$/states/urban-dictionary";

export const UrbanDictionaryKeybinding: FC = () => {
	const store = useStore();
	const toolMode = useAtomValue(toolModeAtom);

	const handleUrbanDictionary = useCallback(() => {
		const selectedWords = store.get(selectedWordsAtom);
		if (selectedWords.size === 0) return;

		const lines = store.get(lyricLinesAtom);
		const selectedWordsList: string[] = [];
		const remainingIds = new Set(selectedWords);

		for (const line of lines.lyricLines) {
			if (remainingIds.size === 0) break;
			for (const word of line.words) {
				if (remainingIds.has(word.id)) {
					selectedWordsList.push(word.word.trim());
					remainingIds.delete(word.id);
				}
			}
		}

		if (selectedWordsList.length > 0) {
			const targetWord = selectedWordsList.join("");
			store.set(urbanDictionaryDialogAtom, {
				open: true,
				word: targetWord,
			});
		}
	}, [store]);

	useKeyBindingAtom(keyUrbanDictionaryAtom, () => {
		if (toolMode === ToolMode.Edit) {
			handleUrbanDictionary();
		}
	}, [toolMode, handleUrbanDictionary]);

	useKeyBindingAtom(keyUrbanDictionarySyncAtom, () => {
		if (toolMode === ToolMode.Sync) {
			handleUrbanDictionary();
		}
	}, [toolMode, handleUrbanDictionary]);

	return null;
};
