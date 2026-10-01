import { beforeEach, describe, expect, it, vi } from "vitest";

const atoms = vi.hoisted(() => ({
	activeProjectDirAtom: { name: "dir" },
	activeProjectManifestAtom: { name: "manifest" },
	projectAudioFileAtom: { name: "audio" },
	lyricLinesAtom: { name: "lyric" },
	saveFileNameAtom: { name: "saveFileName" },
	markLyricsSavedAtom: { name: "markSaved" },
}));
const fs = vi.hoisted(() => ({
	exists: vi.fn(async () => true),
	mkdir: vi.fn(),
	readDir: vi.fn(async () => [] as { name: string }[]),
	remove: vi.fn(),
	writeTextFile: vi.fn(),
}));
const lyricIo = vi.hoisted(() => ({
	generateProjectTtmlText: vi.fn(() => "<tt/>"),
	writeProjectLyricFile: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/plugin-fs", () => fs);
vi.mock("react-toastify", () => ({
	toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock("uid", () => ({ uid: () => "id" }));
vi.mock("$/modules/audio/audio-engine", () => ({ audioEngine: {} }));
vi.mock("$/modules/project/logic/metadata-filename", () => ({
	getSuggestedTtmlFileName: () => ({ baseName: "Artist - Title" }),
}));
vi.mock("$/modules/settings/states", () => ({
	allowConsecutiveBackgroundLinesAtom: {},
	lyricTextNormalizationOptionsAtom: {},
}));
vi.mock("$/states/dialogs", () => ({ confirmDialogAtom: {} }));
vi.mock("$/states/main", () => ({
	isDirtyAtom: {},
	lyricLinesAtom: atoms.lyricLinesAtom,
	markLyricsSavedAtom: atoms.markLyricsSavedAtom,
	newLyricLinesAtom: {},
	projectIdAtom: {},
	saveFileNameAtom: atoms.saveFileNameAtom,
	startFreshLyricDocumentAtom: {},
}));
vi.mock("$/utils/logging", () => ({ error: vi.fn(), log: vi.fn() }));
vi.mock("./audio-io", () => ({ writeProjectAudioFile: vi.fn() }));
vi.mock("./lyric-io", () => lyricIo);
vi.mock("./project-folder-sync", () => ({ syncProjectFolderName: vi.fn() }));
vi.mock("./project-naming", () => ({ getSongInfo: () => ({}) }));
vi.mock("./project-open", () => ({ loadProjectFromDir: vi.fn() }));
vi.mock("./recent-projects", () => ({ upsertRecentProject: vi.fn() }));
vi.mock("./state", () => ({
	activeProjectDirAtom: atoms.activeProjectDirAtom,
	activeProjectManifestAtom: atoms.activeProjectManifestAtom,
	projectAudioFileAtom: atoms.projectAudioFileAtom,
}));
vi.mock("./workspace", () => ({
	pickProjectFolder: vi.fn(),
	rememberProjectWorkspace: vi.fn(),
}));

import { saveLyricsOnly, saveProject } from "./project-save";

const lyric = { lyricLines: [{ id: "l1" }], metadata: [] };

function makeStore(manifest: Record<string, unknown>) {
	const values = new Map<unknown, unknown>([
		[atoms.activeProjectDirAtom, "C:/Music/Song"],
		[atoms.activeProjectManifestAtom, manifest],
		[atoms.projectAudioFileAtom, null],
		[atoms.lyricLinesAtom, lyric],
		[atoms.saveFileNameAtom, "new.ttml"],
	]);
	return {
		get: (atom: unknown) => values.get(atom),
		set: vi.fn((atom: unknown, value?: unknown) => values.set(atom, value)),
	};
}

const baseManifest = {
	version: 1,
	name: "Custom Name",
	audioFile: "",
	lyricFile: "old.ttml",
};

describe("folder project saves", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("keeps the original lyric file when writing the replacement fails", async () => {
		lyricIo.writeProjectLyricFile.mockRejectedValueOnce(new Error("disk full"));
		const store = makeStore(baseManifest);
		await saveLyricsOnly(store as never, (k) => k);
		expect(fs.remove).not.toHaveBeenCalled();
		expect(store.set).not.toHaveBeenCalledWith(
			atoms.markLyricsSavedAtom,
			expect.anything(),
		);
	});

	it("removes the replaced lyric file only after the manifest is written", async () => {
		const store = makeStore(baseManifest);
		await saveLyricsOnly(store as never, (k) => k);
		expect(fs.remove).toHaveBeenCalledWith("C:/Music/Song/old.ttml");
		const removeOrder = fs.remove.mock.invocationCallOrder[0];
		expect(
			lyricIo.writeProjectLyricFile.mock.invocationCallOrder[0],
		).toBeLessThan(removeOrder);
		expect(fs.writeTextFile.mock.invocationCallOrder[0]).toBeLessThan(
			removeOrder,
		);
		expect(store.set).toHaveBeenCalledWith(atoms.markLyricsSavedAtom, lyric);
	});

	it("keeps the file on a case-only rename when the filesystem is case-insensitive", async () => {
		fs.readDir.mockResolvedValueOnce([{ name: "old.ttml" }]);
		const store = makeStore(baseManifest);
		store.set(atoms.saveFileNameAtom, "OLD.ttml");
		await saveLyricsOnly(store as never, (k) => k);
		expect(fs.remove).not.toHaveBeenCalled();
	});

	it("removes the stale file on a case-only rename when the filesystem is case-sensitive", async () => {
		fs.readDir.mockResolvedValueOnce([
			{ name: "old.ttml" },
			{ name: "OLD.ttml" },
		]);
		const store = makeStore(baseManifest);
		store.set(atoms.saveFileNameAtom, "OLD.ttml");
		await saveLyricsOnly(store as never, (k) => k);
		expect(fs.remove).toHaveBeenCalledWith("C:/Music/Song/old.ttml");
	});

	it("preserves a user-edited project name over metadata", async () => {
		const store = makeStore({ ...baseManifest, nameEdited: true });
		await saveProject(store as never, (k) => k);
		expect(store.get(atoms.activeProjectManifestAtom)).toMatchObject({
			name: "Custom Name",
		});
	});

	it("still derives the name from metadata until the user renames", async () => {
		const store = makeStore(baseManifest);
		await saveProject(store as never, (k) => k);
		expect(store.get(atoms.activeProjectManifestAtom)).toMatchObject({
			name: "Artist - Title",
		});
	});
});
