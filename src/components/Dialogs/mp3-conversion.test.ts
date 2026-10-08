import { Children, isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	remember: false,
	setMode: vi.fn(),
	setDialog: vi.fn(),
	onConvert: vi.fn(),
	onSkip: vi.fn(),
}));
vi.mock("jotai", async (importOriginal) => ({
	...(await importOriginal<typeof import("jotai")>()),
	useAtom: () => [
		{
			open: true,
			fileName: "song.mp3",
			onConvert: state.onConvert,
			onSkip: state.onSkip,
		},
		state.setDialog,
	],
	useSetAtom: () => state.setMode,
}));
vi.mock("react", async (importOriginal) => ({
	...(await importOriginal<typeof import("react")>()),
	useState: () => [
		state.remember,
		(value: boolean) => {
			state.remember = value;
		},
	],
	useEffect: vi.fn(),
}));
vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

import { Mp3ConversionMode } from "$/modules/settings/states";
import { Mp3ConversionDialog } from "./mp3-conversion";

function findAction(node: ReactNode, label: string): (() => void) | undefined {
	let action: (() => void) | undefined;
	Children.forEach(node, (child) => {
		if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child))
			return;
		if (child.props.children === label) action = child.props.onClick;
		else action ??= findAction(child.props.children, label);
	});
	return action;
}

beforeEach(() => {
	vi.clearAllMocks();
	state.remember = false;
});
describe("MP3 don't-show-again choice", () => {
	it.each([
		["convert", Mp3ConversionMode.Always],
		["skip", Mp3ConversionMode.Never],
	] as const)("remembers %s in the Audio preference before completing the import", (choice, mode) => {
		state.remember = true;
		const action = findAction(
			Mp3ConversionDialog(),
			`dialog.mp3Conversion.${choice}`,
		);
		expect(action).toBeDefined();
		action?.();
		expect(state.setMode).toHaveBeenCalledWith(mode);
		const callback = choice === "convert" ? state.onConvert : state.onSkip;
		expect(callback).toHaveBeenCalledOnce();
		expect(state.setMode.mock.invocationCallOrder[0]).toBeLessThan(
			callback.mock.invocationCallOrder[0],
		);
		expect(state.setDialog).toHaveBeenCalledWith(
			expect.objectContaining({ open: false }),
		);
	});
	it.each([
		"convert",
		"skip",
	])("keeps Ask unchanged for a one-off %s", (choice) => {
		findAction(Mp3ConversionDialog(), `dialog.mp3Conversion.${choice}`)?.();
		expect(state.setMode).not.toHaveBeenCalled();
	});
});
