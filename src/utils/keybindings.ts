import { atom, type createStore, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { type DependencyList, useEffect } from "react";
import { warn } from "./logging.ts";

export type KeyBindingsConfig = string[];
export interface KeyBindingEvent {
	downTime: number;
	downTimeOffset: number;
	triggerTime: number;
}
export type KeyBindingCallback = (evt: KeyBindingEvent) => void;

/**
 * 触发模式枚举
 */
export enum KeyBindingTriggerMode {
	KeyDown = "keydown",
	KeyUp = "keyup",
}

/**
 * 用于在事件监听器中快速读取当前模式
 */
let currentTriggerMode: KeyBindingTriggerMode = KeyBindingTriggerMode.KeyDown;

// TODO: 把这个组件变成 hook 这样就可以直接读取 atom 而不是手动解析 localStorage 了
if (typeof localStorage !== "undefined") {
	const raw = localStorage.getItem("keyBindingTriggerMode");
	if (raw) {
		try {
			const parsed = JSON.parse(raw);
			currentTriggerMode = parsed as KeyBindingTriggerMode;
		} catch {
			currentTriggerMode = raw as KeyBindingTriggerMode;
		}
	}
}

if (
	currentTriggerMode !== KeyBindingTriggerMode.KeyDown &&
	currentTriggerMode !== KeyBindingTriggerMode.KeyUp
) {
	currentTriggerMode = KeyBindingTriggerMode.KeyDown;
}

const internalTriggerModeAtom = atomWithStorage<KeyBindingTriggerMode>(
	"keyBindingTriggerMode",
	currentTriggerMode,
	undefined,
	{ getOnInit: true },
);

export const keyBindingTriggerModeAtom = atom(
	(get) => get(internalTriggerModeAtom),
	(_get, set, newValue: KeyBindingTriggerMode) => {
		set(internalTriggerModeAtom, newValue);
		currentTriggerMode = newValue;
	},
);

export function formatKeyBindings(cfg: KeyBindingsConfig): string {
	return formatKeyBindingsAsArray(cfg).join(
		navigator.userAgent.includes("Mac") ? " " : " + ",
	);
}

export function formatKeyBindingsAsArray(cfg: KeyBindingsConfig): string[] {
	const sorted = normalizeKeyBindings(cfg).sort((a, b) => {
		const indexA = MODIFIER_ORDER.indexOf(a);
		const indexB = MODIFIER_ORDER.indexOf(b);
		if (indexA !== -1 && indexB !== -1) return indexA - indexB;
		if (indexA !== -1) return -1;
		if (indexB !== -1) return 1;
		return a.localeCompare(b);
	});
	return sorted.map((key) => {
		const labels: Record<string, string> = {
			ArrowLeft: "←",
			ArrowRight: "→",
			ArrowUp: "↑",
			ArrowDown: "↓",
			BracketLeft: "[",
			BracketRight: "]",
		};
		if (labels[key]) return labels[key];
		if (key.startsWith("Key")) return key.substring(3);
		if (navigator.userAgent.includes("Mac")) {
			if (key === "Control") return "⌃";
			if (key === "Alt") return "⌥";
			if (key === "Shift") return "⇧";
			if (key === "Meta") return "⌘";
		} else if (navigator.userAgent.includes("Windows")) {
			if (key.startsWith("Control")) return "Ctrl";
			if (key === "Meta") return "Win";
		}
		return key;
	});
}

export const RESET_KEYBINDING = Symbol("reset-keybinding");

export function atomWithKeybindingStorage(
	storageName: string,
	defaultValue: KeyBindingsConfig,
) {
	const key = `keybindings:${storageName}`;
	const keyAtom = atomWithStorage(key, defaultValue);
	return atom(
		(get) => get(keyAtom),
		async (_get, set, update?: KeyBindingsConfig | typeof RESET_KEYBINDING) => {
			if (update) {
				if (update === RESET_KEYBINDING) set(keyAtom, defaultValue);
				else set(keyAtom, update);
			} else {
				try {
					set(keyAtom, await recordShortcut());
				} catch {
					// Canceling recording leaves the current binding intact.
				}
			}
		},
	);
}

export function normalizeKeyCode(code: string): string {
	if (code === "KeyHome") return "Home";
	if (code === "KeyEnd") return "End";
	return code.replace(/^(Control|Meta|Alt|Shift)(Left|Right)$/, "$1");
}

export function normalizeKeyBindings(cfg: Iterable<string>): KeyBindingsConfig {
	return [...new Set([...cfg].map(normalizeKeyCode))];
}

const pressingKeys = new Set<string>();
const registeredKeyBindings = new Map<string, Set<KeyBindingCallback>>();
const registeredAtomBindings = new Map<
	ReturnType<typeof atomWithKeybindingStorage>,
	Set<KeyBindingCallback>
>();
let downTime = 0;

const MODIFIER_ORDER = ["Control", "Meta", "Alt", "Shift"];
export function getShortcutKey(cfg: KeyBindingsConfig | Set<string>) {
	const keys = normalizeKeyBindings(cfg);
	keys.sort((a, b) => {
		const indexA = MODIFIER_ORDER.indexOf(a);
		const indexB = MODIFIER_ORDER.indexOf(b);
		if (indexA !== -1 && indexB !== -1) return indexA - indexB;
		if (indexA !== -1) return -1;
		if (indexB !== -1) return 1;
		return a.localeCompare(b);
	});
	return keys.join(" + ");
}

function triggerCallbacks(
	joinedKey: string,
	evt: KeyboardEvent,
	targetTime: number,
) {
	const callbacks = registeredKeyBindings.get(joinedKey);
	if (callbacks) {
		const downTimeOffset = evt.timeStamp - targetTime;
		const e: KeyBindingEvent = {
			downTime: targetTime,
			downTimeOffset,
			triggerTime: evt.timeStamp,
		};
		for (const cb of callbacks) {
			try {
				cb(e);
			} catch (err) {
				warn("Error in key binding ", joinedKey, "callback", err);
			}
		}
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();
	}
}

window.addEventListener("keydown", (evt) => {
	if (evt.repeat) return;
	if (isEditing(evt)) {
		pressingKeys.clear();
		return;
	}
	if (pressingKeys.size === 0) {
		downTime = evt.timeStamp;
	}

	const code = normalizeKeyCode(evt.code);

	// 阻止空格滚动
	if (
		(evt.code === "Space" || evt.code === "Home" || evt.code === "End") &&
		evt.target === document.body
	) {
		evt.preventDefault();
		evt.stopPropagation();
	}

	pressingKeys.add(code);

	if (currentTriggerMode === KeyBindingTriggerMode.KeyDown) {
		const joined = getShortcutKey(pressingKeys);
		triggerCallbacks(joined, evt, downTime);
	}
});

window.addEventListener("keyup", (evt) => {
	if (isEditing(evt)) {
		pressingKeys.clear();
		return;
	}

	const code = normalizeKeyCode(evt.code);

	if (currentTriggerMode === KeyBindingTriggerMode.KeyUp) {
		const joined = getShortcutKey(pressingKeys);
		triggerCallbacks(joined, evt, downTime);
	}

	pressingKeys.delete(code);
});
window.addEventListener("blur", () => {
	pressingKeys.clear();
});
window.addEventListener("focus", () => {
	pressingKeys.clear();
});

export function forceInvokeKeyBindingAtom(
	store: ReturnType<typeof createStore>,
	thisAtom: ReturnType<typeof atomWithKeybindingStorage>,
	evt?: MouseEvent | KeyboardEvent | TouchEvent,
) {
	const keyBinding = store.get(thisAtom);
	const joined = getShortcutKey(keyBinding);
	const callbacks = registeredAtomBindings.get(thisAtom);

	if (callbacks) {
		const downTimeOffset = 0;
		const eventTime = evt?.timeStamp ?? performance.now();

		const e: KeyBindingEvent = {
			downTime: eventTime,
			downTimeOffset,
			triggerTime: eventTime,
		};
		for (const cb of callbacks) {
			try {
				cb(e);
			} catch (err) {
				warn("Error in key binding ", joined, "callback", err);
			}
		}
		evt?.preventDefault();
		evt?.stopPropagation();
		evt?.stopImmediatePropagation();
	}
}

// From https://wangchujiang.com/hotkeys-js/
export function isEditing(event: KeyboardEvent | MouseEvent) {
	const checkElement = (target: HTMLElement | null) => {
		const tagName = target?.tagName;
		return (
			target?.isContentEditable ||
			tagName === "INPUT" ||
			tagName === "SELECT" ||
			tagName === "TEXTAREA" ||
			!!currentKeyDownEvent ||
			!!currentKeyUpEvent
		);
	};
	return (
		checkElement((event.target || event.srcElement) as HTMLElement | null) ||
		checkElement(document.activeElement as HTMLElement | null)
	);
}

export function isInteracting(event: KeyboardEvent | MouseEvent) {
	const checkElement = (target: HTMLElement | null) => {
		const tagName = target?.tagName;
		return (
			target?.isContentEditable ||
			tagName === "INPUT" ||
			tagName === "SELECT" ||
			tagName === "TEXTAREA" ||
			tagName === "BUTTON" ||
			!!currentKeyDownEvent ||
			!!currentKeyUpEvent
		);
	};
	return (
		checkElement((event.target || event.srcElement) as HTMLElement | null) ||
		checkElement(document.activeElement as HTMLElement | null)
	);
}

export function registerKeyBindings(
	cfg: KeyBindingsConfig,
	callback: KeyBindingCallback,
) {
	if (cfg.length === 0) {
		return () => {};
	}
	const joined = getShortcutKey(cfg);
	let set = registeredKeyBindings.get(joined);
	if (!set) {
		set = new Set();
		registeredKeyBindings.set(joined, set);
	}
	set.add(callback);
	return () => {
		set?.delete(callback);
		if (set?.size === 0) registeredKeyBindings.delete(joined);
	};
}

export function useKeyBinding(
	cfg: KeyBindingsConfig,
	callback: KeyBindingCallback,
	deps?: DependencyList,
) {
	useEffect(() => {
		return registerKeyBindings(cfg, callback);
	}, [cfg, callback, ...(deps || [])]);
}

export function registerKeyBindingAtom(
	thisAtom: ReturnType<typeof atomWithKeybindingStorage>,
	cfg: KeyBindingsConfig,
	callback: KeyBindingCallback,
) {
	// On-screen timing controls invoke an action even when its shortcut is unbound.
	let callbacks = registeredAtomBindings.get(thisAtom);
	if (!callbacks) {
		callbacks = new Set();
		registeredAtomBindings.set(thisAtom, callbacks);
	}
	callbacks.add(callback);
	const unregisterShortcut = registerKeyBindings(cfg, callback);
	return () => {
		unregisterShortcut();
		callbacks?.delete(callback);
		if (callbacks?.size === 0) registeredAtomBindings.delete(thisAtom);
	};
}

/**
 * @deprecated 请使用 useCommand
 */
export function useKeyBindingAtom(
	thisAtom: ReturnType<typeof atomWithKeybindingStorage>,
	callback: KeyBindingCallback,
	deps?: DependencyList,
): KeyBindingsConfig {
	const keyBindings = useAtomValue(thisAtom);
	useEffect(() => {
		return registerKeyBindingAtom(thisAtom, keyBindings, callback);
	}, [thisAtom, keyBindings, callback, ...(deps || [])]);
	return keyBindings;
}

export function useDoubleKeyBindingAtom(
	thisAtom: ReturnType<typeof atomWithKeybindingStorage>,
	callback: KeyBindingCallback,
	deps?: DependencyList,
	enabled = true,
): KeyBindingsConfig {
	const keyBindings = useAtomValue(thisAtom);
	useEffect(() => {
		if (!enabled) return;
		return registerDoubleKeyBindings(keyBindings, callback);
	}, [keyBindings, callback, enabled, ...(deps || [])]);
	return keyBindings;
}

export function registerDoubleKeyBindings(
	cfg: KeyBindingsConfig,
	callback: KeyBindingCallback,
) {
	let lastPressTime = -Infinity;
	let pending: { code: string; downTime: number } | undefined;
	const joinedKey = getShortcutKey(cfg);
	const reset = () => {
		lastPressTime = -Infinity;
		pending = undefined;
	};
	const trigger = (evt: KeyboardEvent, keyDownTime: number) => {
		if (evt.timeStamp - lastPressTime <= 350) {
			callback({
				downTime: keyDownTime,
				downTimeOffset: evt.timeStamp - keyDownTime,
				triggerTime: evt.timeStamp,
			});
			// This capture listener consumes the event before the dispatcher sees it.
			if (evt.type === "keyup") pressingKeys.delete(normalizeKeyCode(evt.code));
			evt.preventDefault();
			evt.stopPropagation();
			evt.stopImmediatePropagation();
			lastPressTime = -Infinity;
		} else {
			lastPressTime = evt.timeStamp;
		}
	};
	const onKeyDown = (evt: KeyboardEvent) => {
		if (isEditing(evt)) {
			reset();
			return;
		}
		if (evt.repeat) return;
		const keys = [
			...(evt.ctrlKey ? ["Control"] : []),
			...(evt.metaKey ? ["Meta"] : []),
			...(evt.altKey ? ["Alt"] : []),
			...(evt.shiftKey ? ["Shift"] : []),
			normalizeKeyCode(evt.code),
		];
		if (getShortcutKey(keys) !== joinedKey) {
			const code = normalizeKeyCode(evt.code);
			if (
				MODIFIER_ORDER.includes(code) &&
				normalizeKeyBindings(cfg).includes(code)
			)
				return;
			reset();
			return;
		}
		if (currentTriggerMode === KeyBindingTriggerMode.KeyDown) {
			trigger(evt, evt.timeStamp);
		} else {
			pending = { code: evt.code, downTime: evt.timeStamp };
		}
	};
	const onKeyUp = (evt: KeyboardEvent) => {
		if (isEditing(evt)) {
			reset();
			return;
		}
		if (pending?.code !== evt.code) return;
		if (currentTriggerMode === KeyBindingTriggerMode.KeyUp) {
			trigger(evt, pending.downTime);
		}
		pending = undefined;
	};
	window.addEventListener("keydown", onKeyDown, { capture: true });
	window.addEventListener("keyup", onKeyUp, { capture: true });
	window.addEventListener("blur", reset);
	return () => {
		window.removeEventListener("keydown", onKeyDown, { capture: true });
		window.removeEventListener("keyup", onKeyUp, { capture: true });
		window.removeEventListener("blur", reset);
	};
}

let currentKeyDownEvent: ((evt: KeyboardEvent) => void) | undefined;
let currentKeyUpEvent: ((evt: KeyboardEvent) => void) | undefined;
let currentRecordingReject: ((reason: Error) => void) | undefined;

export function stopRecordingShortcut() {
	if (currentKeyDownEvent) {
		window.removeEventListener("keydown", currentKeyDownEvent, {
			capture: true,
		});
		currentKeyDownEvent = undefined;
	}
	if (currentKeyUpEvent) {
		window.removeEventListener("keyup", currentKeyUpEvent, { capture: true });
		currentKeyUpEvent = undefined;
	}
	pressingKeys.clear();
	currentRecordingReject?.(new Error("User canceled"));
	currentRecordingReject = undefined;
}

export function recordShortcut(): Promise<KeyBindingsConfig> {
	return new Promise((resolve, reject) => {
		stopRecordingShortcut();
		const recorded = new Set<string>();
		const stack = new Set<string>();
		const onKeyDown = (evt: KeyboardEvent) => {
			recorded.add(normalizeKeyCode(evt.code));
			stack.add(evt.code);
			evt.preventDefault();
			evt.stopPropagation();
			evt.stopImmediatePropagation();
		};
		const onKeyUp = (evt: KeyboardEvent) => {
			if (!stack.has(evt.code)) return;
			stack.delete(evt.code);
			if (stack.size === 0) {
				currentRecordingReject = undefined;
				stopRecordingShortcut();
				if (recorded.size === 1 && recorded.has("Escape")) {
					reject(new Error("User canceled"));
				} else {
					resolve([...recorded]);
				}
			}
			evt.preventDefault();
			evt.stopPropagation();
			evt.stopImmediatePropagation();
		};
		currentKeyDownEvent = onKeyDown;
		currentKeyUpEvent = onKeyUp;
		currentRecordingReject = reject;
		// Capture before dialog Escape handlers so canceling keeps Preferences open.
		window.addEventListener("keydown", onKeyDown, { capture: true });
		window.addEventListener("keyup", onKeyUp, { capture: true });
	});
}
