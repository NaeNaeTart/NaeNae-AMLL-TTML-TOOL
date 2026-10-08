import { getShortcutKey } from "$/utils/keybindings";
import type { KeyBindingCommand, KeyBindingsConfig } from "./types";

export function findKeyBindingConflicts(
	bindings: Array<{ command: KeyBindingCommand; keys: KeyBindingsConfig }>,
): Map<string, KeyBindingCommand[]> {
	const conflicts = new Map<string, KeyBindingCommand[]>();
	for (const { command, keys } of bindings) {
		if (keys.length === 0) continue;
		const shortcut = getShortcutKey(keys);
		const matches = bindings.filter(
			(other) =>
				other.command.id !== command.id &&
				other.keys.length > 0 &&
				getShortcutKey(other.keys) === shortcut &&
				command.modes.some((mode) => other.command.modes.includes(mode)),
		);
		if (matches.length > 0) {
			conflicts.set(
				command.id,
				matches.map((match) => match.command),
			);
		}
	}
	return conflicts;
}
