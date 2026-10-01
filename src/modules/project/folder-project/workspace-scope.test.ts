import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
const { open } = vi.hoisted(() => ({ open: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({
	invoke,
	isTauri: () => true,
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));
vi.mock("react-toastify", () => ({
	toast: {
		error: vi.fn(),
		info: vi.fn(),
		success: vi.fn(),
		warning: vi.fn(),
	},
}));
vi.mock("$/states/dialogs", () => ({ confirmDialogAtom: {} }));
vi.mock("$/states/main", () => ({ isDirtyAtom: {} }));
vi.mock("./state", () => ({
	workspaceDirAtom: {},
	workspaceProjectsAtom: {},
	workspaceScanningAtom: {},
}));
vi.mock("./workspace-scan", () => ({
	scanProjectWorkspace: vi.fn(async () => []),
}));
vi.mock("$/utils/logging", () => ({ error: vi.fn(), log: vi.fn() }));

import { openWorkspaceDialog, pickProjectFolder } from "./workspace";
import { scanProjectWorkspace } from "./workspace-scan";

describe("openWorkspaceDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("relies on the native dialog's recursive grant and invokes no scope command", async () => {
		open.mockResolvedValueOnce("C:/Projects");
		const store = { get: () => false, set: vi.fn() };
		await openWorkspaceDialog(store as never, (key) => key);
		expect(open).toHaveBeenCalledWith(
			expect.objectContaining({ directory: true, recursive: true }),
		);
		expect(invoke).not.toHaveBeenCalled();
		expect(scanProjectWorkspace).toHaveBeenCalledWith("C:/Projects");
	});

	it("scans nothing when the dialog is dismissed", async () => {
		open.mockResolvedValueOnce(null);
		const store = { get: () => false, set: vi.fn() };
		await openWorkspaceDialog(store as never, (key) => key);
		expect(invoke).not.toHaveBeenCalled();
		expect(scanProjectWorkspace).not.toHaveBeenCalled();
	});
});

describe("pickProjectFolder", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("delegates the pick to the backend and passes only a title", async () => {
		invoke.mockResolvedValueOnce("C:/Projects/Song");
		await expect(pickProjectFolder("Pick")).resolves.toBe("C:/Projects/Song");
		expect(invoke).toHaveBeenCalledWith("pick_project_folder", {
			title: "Pick",
		});
	});

	it("returns null when the backend picker is dismissed", async () => {
		invoke.mockResolvedValueOnce(null);
		await expect(pickProjectFolder("Pick")).resolves.toBeNull();
	});
});
