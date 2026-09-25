import { describe, expect, it, vi } from "vitest";

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

import { beforeEach } from "vitest";
import { openWorkspaceDialog } from "./workspace";
import { scanProjectWorkspace } from "./workspace-scan";

describe("openWorkspaceDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("grants scope for the explicitly picked workspace before scanning", async () => {
		open.mockResolvedValueOnce("C:/Projects");
		const store = { get: () => false, set: vi.fn() };
		await openWorkspaceDialog(store as never, (key) => key);
		expect(invoke).toHaveBeenCalledWith("grant_workspace_scope", {
			workspaceDir: "C:/Projects",
		});
		expect(scanProjectWorkspace).toHaveBeenCalledWith("C:/Projects");
	});

	it("grants nothing when the dialog is dismissed", async () => {
		open.mockResolvedValueOnce(null);
		const store = { get: () => false, set: vi.fn() };
		await openWorkspaceDialog(store as never, (key) => key);
		expect(invoke).not.toHaveBeenCalled();
		expect(scanProjectWorkspace).not.toHaveBeenCalled();
	});
});
