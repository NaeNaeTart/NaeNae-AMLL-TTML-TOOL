import { createStore } from "jotai";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

let keyboard: typeof import("$/utils/keybindings");
let commands: typeof import("./commands");
let registry: typeof import("./registry");
let findConflicts: typeof import("./conflicts").findKeyBindingConflicts;
const storage = new Map<string, string>();
const cleanups: Array<() => void> = [];

// Node's EventTarget does not dispatch capture listeners before bubble listeners.
// Match the browser ordering so consuming a double tap exercises dispatcher cleanup.
class KeyboardWindow extends EventTarget {
	private listeners = new Map<
		string,
		Array<{
			callback: EventListenerOrEventListenerObject;
			capture: boolean;
		}>
	>();

	override addEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	) {
		if (!callback) return;
		const capture = typeof options === "boolean" ? options : !!options?.capture;
		const listeners = this.listeners.get(type) ?? [];
		listeners.push({ callback, capture });
		this.listeners.set(type, listeners);
	}

	override removeEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: boolean | EventListenerOptions,
	) {
		const capture = typeof options === "boolean" ? options : !!options?.capture;
		this.listeners.set(
			type,
			(this.listeners.get(type) ?? []).filter(
				(listener) =>
					listener.callback !== callback || listener.capture !== capture,
			),
		);
	}

	override dispatchEvent(event: Event) {
		let stopped = false;
		const stop = event.stopImmediatePropagation.bind(event);
		event.stopImmediatePropagation = () => {
			stopped = true;
			stop();
		};
		const listeners = [...(this.listeners.get(event.type) ?? [])].sort(
			(a, b) => Number(b.capture) - Number(a.capture),
		);
		for (const { callback } of listeners) {
			if (stopped) break;
			if (typeof callback === "function") callback.call(this, event);
			else callback.handleEvent(event);
		}
		return !event.defaultPrevented;
	}
}

function key(
	type: "keydown" | "keyup",
	code: string,
	timeStamp = 0,
	modifiers: Partial<KeyboardEventInit> = {},
) {
	const event = new Event(type, { cancelable: true });
	Object.defineProperties(event, {
		code: { value: code },
		timeStamp: { value: timeStamp },
		repeat: { value: false },
		...Object.fromEntries(
			Object.entries(modifiers).map(([name, value]) => [name, { value }]),
		),
	});
	window.dispatchEvent(event);
	return event;
}

beforeAll(async () => {
	vi.stubGlobal("window", new KeyboardWindow());
	vi.stubGlobal("document", { body: {}, activeElement: null });
	vi.stubGlobal("navigator", { userAgent: "Windows" });
	const localStorage = {
		getItem: (name: string) => storage.get(name) ?? null,
		setItem: (name: string, value: string) => storage.set(name, value),
		removeItem: (name: string) => storage.delete(name),
	};
	vi.stubGlobal("localStorage", localStorage);
	Object.assign(window, { localStorage });
	keyboard = await import("$/utils/keybindings");
	commands = await import("./commands");
	registry = await import("./registry");
	({ findKeyBindingConflicts: findConflicts } = await import("./conflicts"));
});

beforeEach(() => {
	storage.clear();
	Object.assign(document, { activeElement: null });
	window.dispatchEvent(new Event("blur"));
	createStore().set(
		keyboard.keyBindingTriggerModeAtom,
		keyboard.KeyBindingTriggerMode.KeyDown,
	);
});

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	keyboard.stopRecordingShortcut();
});

describe("shortcut normalization and dispatch", () => {
	it.each([
		"ControlLeft",
		"ControlRight",
	])("matches saved %s modifiers", (modifier) => {
		const callback = vi.fn();
		cleanups.push(
			keyboard.registerKeyBindings([modifier, "ShiftLeft", "KeyS"], callback),
		);
		key("keydown", "ControlRight");
		key("keydown", "ShiftRight");
		key("keydown", "KeyS");
		expect(callback).toHaveBeenCalledOnce();
	});

	it.each([
		["KeyHome", "Home"],
		["KeyEnd", "End"],
	])("matches legacy %s as %s", (saved, code) => {
		const callback = vi.fn();
		cleanups.push(keyboard.registerKeyBindings([saved], callback));
		key("keydown", code);
		expect(callback).toHaveBeenCalledOnce();
	});

	it("keeps directional keys distinct and normalizes modifier duplicates", () => {
		expect(
			keyboard.getShortcutKey(["ControlLeft", "Control", "ArrowRight"]),
		).toBe("Control + ArrowRight");
		expect(keyboard.getShortcutKey(["ArrowLeft"])).not.toBe(
			keyboard.getShortcutKey(["ArrowRight"]),
		);
	});

	it("formats directional keys consistently in text and array labels", () => {
		for (const [code, label] of Object.entries({
			ArrowLeft: "←",
			ArrowRight: "→",
			ArrowUp: "↑",
			ArrowDown: "↓",
			BracketLeft: "[",
			BracketRight: "]",
		})) {
			expect(keyboard.formatKeyBindings([code])).toBe(label);
			expect(keyboard.formatKeyBindingsAsArray([code])).toEqual([label]);
		}
		expect(
			keyboard.formatKeyBindings(["KeyS", "ShiftRight", "ControlLeft"]),
		).toBe("Ctrl + Shift + S");
	});

	it.each([
		"INPUT",
		"TEXTAREA",
		"SELECT",
		"contenteditable",
	])("ignores shortcuts while typing in %s", (tagName) => {
		const callback = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(["Control", "Equal"], callback));
		Object.assign(document, {
			activeElement: {
				tagName,
				isContentEditable: tagName === "contenteditable",
			},
		});
		key("keydown", "ControlLeft");
		key("keydown", "Equal");
		key("keyup", "Equal");
		expect(callback).not.toHaveBeenCalled();
	});
});

describe("shortcut recording and storage", () => {
	it("unbinding a shortcut keeps its on-screen timing action available", async () => {
		const store = createStore();
		const binding = keyboard.atomWithKeybindingStorage("test", ["KeyA"]);
		await store.set(binding, []);
		const callback = vi.fn();
		cleanups.push(
			keyboard.registerKeyBindingAtom(binding, store.get(binding), callback),
		);
		key("keydown", "KeyA");
		expect(callback).not.toHaveBeenCalled();
		keyboard.forceInvokeKeyBindingAtom(store, binding);
		expect(callback).toHaveBeenCalledOnce();
	});

	it("on-screen invocation does not trigger another command sharing the shortcut", () => {
		const store = createStore();
		const first = keyboard.atomWithKeybindingStorage("first", ["KeyA"]);
		const second = keyboard.atomWithKeybindingStorage("second", ["KeyA"]);
		const firstAction = vi.fn();
		const secondAction = vi.fn();
		cleanups.push(
			keyboard.registerKeyBindingAtom(first, store.get(first), firstAction),
		);
		cleanups.push(
			keyboard.registerKeyBindingAtom(second, store.get(second), secondAction),
		);
		keyboard.forceInvokeKeyBindingAtom(store, first);
		expect(firstAction).toHaveBeenCalledOnce();
		expect(secondAction).not.toHaveBeenCalled();
	});
	it("consumes Escape before a dialog's bubble handler", async () => {
		const recording = keyboard.recordShortcut();
		const canceled = expect(recording).rejects.toThrow("User canceled");
		const dismissDialog = vi.fn();
		window.addEventListener("keydown", dismissDialog);
		cleanups.push(() => window.removeEventListener("keydown", dismissDialog));
		key("keydown", "Escape");
		key("keyup", "Escape");
		await canceled;
		expect(dismissDialog).not.toHaveBeenCalled();
	});
	it("records canonical modifiers and matches the recorded shortcut", async () => {
		const recording = keyboard.recordShortcut();
		key("keydown", "ControlLeft");
		key("keydown", "ShiftRight");
		key("keydown", "KeyS");
		key("keyup", "KeyS");
		key("keyup", "ShiftRight");
		key("keyup", "ControlLeft");
		const saved = await recording;
		expect(saved).toEqual(["Control", "Shift", "KeyS"]);
		const callback = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(saved, callback));
		key("keydown", "ControlRight");
		key("keydown", "ShiftLeft");
		key("keydown", "KeyS");
		expect(callback).toHaveBeenCalledOnce();
	});

	it("Escape alone cancels and leaves an existing custom binding intact", async () => {
		const binding = keyboard.atomWithKeybindingStorage("test", ["KeyA"]);
		const store = createStore();
		await store.set(binding, ["KeyB"]);
		const recording = store.set(binding);
		key("keydown", "Escape");
		key("keyup", "Escape");
		await recording;
		expect(store.get(binding)).toEqual(["KeyB"]);
	});

	it("can record modified Escape for Deselect All", async () => {
		const recording = keyboard.recordShortcut();
		key("keydown", "ControlLeft");
		key("keydown", "Escape");
		key("keyup", "Escape");
		key("keyup", "ControlLeft");
		expect(await recording).toEqual(["Control", "Escape"]);
	});

	it("ignores the key release that opened the recorder", async () => {
		const recording = keyboard.recordShortcut();
		key("keyup", "Enter");
		key("keydown", "KeyB");
		key("keyup", "KeyB");
		expect(await recording).toEqual(["KeyB"]);
	});

	it("clears a binding, then resets its default", async () => {
		const binding = keyboard.atomWithKeybindingStorage("test", ["KeyA"]);
		const store = createStore();
		await store.set(binding, []);
		expect(store.get(binding)).toEqual([]);
		const callback = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(store.get(binding), callback));
		key("keydown", "KeyA");
		expect(callback).not.toHaveBeenCalled();
		await store.set(binding, keyboard.RESET_KEYBINDING);
		expect(store.get(binding)).toEqual(["KeyA"]);
	});

	it("loads and dispatches legacy bindings from localStorage", () => {
		storage.set("keybindings:test", JSON.stringify(["ControlLeft", "KeyHome"]));
		const binding = keyboard.atomWithKeybindingStorage("test", ["KeyA"]);
		const store = createStore();
		cleanups.push(store.sub(binding, () => {}));
		const callback = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(store.get(binding), callback));
		key("keydown", "ControlRight");
		key("keydown", "Home");
		expect(callback).toHaveBeenCalledOnce();
	});
});

describe("double-press shortcuts", () => {
	it("does not leave the consumed key held in the key-up dispatcher", () => {
		createStore().set(
			keyboard.keyBindingTriggerModeAtom,
			keyboard.KeyBindingTriggerMode.KeyUp,
		);
		const double = vi.fn();
		const single = vi.fn();
		const next = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(["KeyE"], single));
		cleanups.push(keyboard.registerDoubleKeyBindings(["KeyE"], double));
		cleanups.push(keyboard.registerKeyBindings(["KeyD"], next));
		key("keydown", "KeyE", 10);
		key("keyup", "KeyE", 20);
		key("keydown", "KeyE", 100);
		key("keyup", "KeyE", 110);
		key("keydown", "KeyD", 150);
		key("keyup", "KeyD", 160);
		expect(single).toHaveBeenCalledOnce();
		expect(double).toHaveBeenCalledOnce();
		expect(next).toHaveBeenCalledOnce();
	});
	it.each([
		"keydown",
		"keyup",
	] as const)("triggers only on the preferred %s event", (mode) => {
		createStore().set(
			keyboard.keyBindingTriggerModeAtom,
			mode === "keyup"
				? keyboard.KeyBindingTriggerMode.KeyUp
				: keyboard.KeyBindingTriggerMode.KeyDown,
		);
		const callback = vi.fn();
		cleanups.push(keyboard.registerDoubleKeyBindings(["KeyE"], callback));
		key("keydown", "KeyE", 10);
		key("keyup", "KeyE", 30);
		expect(callback).not.toHaveBeenCalled();
		key("keydown", "KeyE", 100);
		expect(callback).toHaveBeenCalledTimes(mode === "keydown" ? 1 : 0);
		key("keyup", "KeyE", 120);
		expect(callback).toHaveBeenCalledOnce();
		expect(callback).toHaveBeenCalledWith({
			downTime: 100,
			downTimeOffset: mode === "keyup" ? 20 : 0,
			triggerTime: mode === "keyup" ? 120 : 100,
		});
	});

	it("supports remapped modifiers released between taps", () => {
		const callback = vi.fn();
		cleanups.push(
			keyboard.registerDoubleKeyBindings(["ControlLeft", "KeyE"], callback),
		);
		for (const time of [10, 100]) {
			key("keydown", "ControlRight", time);
			key("keydown", "KeyE", time + 5, { ctrlKey: true });
			key("keyup", "KeyE", time + 10, { ctrlKey: true });
			key("keyup", "ControlRight", time + 15);
		}
		expect(callback).toHaveBeenCalledOnce();
	});

	it("does not count slow taps or taps interrupted by typing", () => {
		const callback = vi.fn();
		cleanups.push(keyboard.registerDoubleKeyBindings(["KeyE"], callback));
		key("keydown", "KeyE", 0);
		key("keyup", "KeyE", 10);
		key("keydown", "KeyE", 500);
		Object.assign(document, { activeElement: { tagName: "INPUT" } });
		key("keydown", "KeyE", 510);
		Object.assign(document, { activeElement: null });
		key("keydown", "KeyE", 520);
		expect(callback).not.toHaveBeenCalled();
	});
});

describe("command defaults and conflict warnings", () => {
	it("has no default collisions in any editor mode", () => {
		expect(
			findConflicts(
				registry
					.getAllCommands()
					.map((command) => ({ command, keys: command.defaultKeys })),
			),
		).toEqual(new Map());
	});

	it("warns for normalized remaps in overlapping modes", () => {
		const result = findConflicts([
			{ command: commands.cmdRedo, keys: ["ControlLeft", "KeyHome"] },
			{ command: commands.cmdMoveFirstWordAndPlay, keys: ["Home", "Control"] },
		]);
		expect(result.get("redo")).toEqual([commands.cmdMoveFirstWordAndPlay]);
		expect(result.get("moveFirstWordAndPlay")).toEqual([commands.cmdRedo]);
	});

	it("does not warn for exclusive modes or unbound commands", () => {
		expect(
			findConflicts([
				{ command: commands.cmdUrbanDictionary, keys: ["Shift", "KeyF"] },
				{ command: commands.cmdUrbanDictionarySync, keys: ["Shift", "KeyF"] },
				{ command: commands.cmdRedo, keys: [] },
				{ command: commands.cmdUndo, keys: [] },
			]),
		).toEqual(new Map());
	});
});
