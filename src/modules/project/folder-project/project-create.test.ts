import { beforeEach, describe, expect, it, vi } from "vitest";

const atoms = vi.hoisted(() => ({
	activeProjectDirAtom: { name: "dir" },
	activeProjectManifestAtom: { name: "manifest" },
	createProjectPromptAtom: { name: "prompt" },
	dismissedProjectPromptKeyAtom: { name: "dismissed" },
	pendingAudioFileAtom: { name: "pendingAudio" },
	pendingAudioPathAtom: { name: "pendingAudioPath" },
	pendingLyricSourceAtom: { name: "pendingLyricSource" },
	projectAudioFileAtom: { name: "audio" },
	lyricLinesAtom: { name: "lyric" },
	saveFileNameAtom: { name: "saveFileName" },
}));
const dialog = vi.hoisted(() => ({
	open: vi.fn(async () => "E:/Picked/picked.flac"),
	save: vi.fn(async () => "D:/Picked/picked.ttml"),
}));
const tauriApi = vi.hoisted(() => ({
	isTauri: () => true,
	invoke: vi.fn(async () => undefined),
}));
const fs = vi.hoisted(() => ({
	mkdir: vi.fn(),
	readDir: vi.fn(async () => [] as { name: string }[]),
	writeTextFile: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
const recent = vi.hoisted(() => ({ upsertRecentProject: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => tauriApi);
vi.mock("@tauri-apps/plugin-dialog", () => dialog);
vi.mock("@tauri-apps/plugin-fs", () => fs);
vi.mock("react-toastify", () => ({ toast }));
vi.mock("uid", () => ({ uid: () => "id" }));
vi.mock("$/modules/audio/audio-engine", () => ({ audioEngine: {} }));
vi.mock("$/modules/settings/states", () => ({ folderProjectsEnabledAtom: {} }));
vi.mock("$/states/main", () => ({
	lyricLinesAtom: atoms.lyricLinesAtom,
	saveFileNameAtom: atoms.saveFileNameAtom,
}));
vi.mock("$/utils/logging", () => ({ error: vi.fn(), log: vi.fn() }));
vi.mock("./audio-io", () => ({ AUDIO_EXTS: new Set(["flac"]) }));
vi.mock("./linked-projects", () => ({
	getLinkedProjectDir: async (id: string) => `C:/AppData/projects/${id}`,
}));
vi.mock("./project-naming", () => ({
	getSongInfo: () => ({}),
	pickFolderName: vi.fn(),
	resolveProjectName: () => ({ name: "Song" }),
}));
vi.mock("./recent-projects", () => recent);
vi.mock("./state", () => atoms);

import { createLinkedProjectFromCurrent } from "./project-create";

function makeStore(lineIds: string[]) {
	const values = new Map<unknown, unknown>([
		[atoms.pendingAudioFileAtom, new File(["a"], "song.flac")],
		[atoms.pendingAudioPathAtom, "E:/Audio/song.flac"],
		[
			atoms.pendingLyricSourceAtom,
			{ path: "D:/Lyrics/song.ttml", lineIds: ["l1", "l2"] },
		],
		[
			atoms.lyricLinesAtom,
			{ lyricLines: lineIds.map((id) => ({ id })), metadata: [] },
		],
		[atoms.saveFileNameAtom, "song.ttml"],
	]);
	return {
		get: (atom: unknown) => values.get(atom),
		set: vi.fn((atom: unknown, value?: unknown) => values.set(atom, value)),
	};
}

describe("linked project creation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("links the opened files without showing any dialog", async () => {
		const store = makeStore(["l1", "l2"]);
		expect(await createLinkedProjectFromCurrent(store as never, (k) => k)).toBe(
			true,
		);
		expect(dialog.open).not.toHaveBeenCalled();
		expect(dialog.save).not.toHaveBeenCalled();
		expect(store.get(atoms.activeProjectManifestAtom)).toMatchObject({
			linked: {
				lyricPath: "D:/Lyrics/song.ttml",
				audioPath: "E:/Audio/song.flac",
			},
		});
		expect(store.get(atoms.activeProjectDirAtom)).toBe(
			"C:/AppData/projects/id",
		);
	});

	it("only writes the app-owned manifest, never the user's files", async () => {
		const store = makeStore(["l1", "l2"]);
		await createLinkedProjectFromCurrent(store as never, (k) => k);
		expect(fs.writeTextFile).toHaveBeenCalledTimes(1);
		expect(fs.writeTextFile).toHaveBeenCalledWith(
			"C:/AppData/projects/id/project.json",
			expect.stringContaining("D:/Lyrics/song.ttml"),
		);
	});

	it("grants filesystem scope for the dropped files once they are linked", async () => {
		const store = makeStore(["l1", "l2"]);
		await createLinkedProjectFromCurrent(store as never, (k) => k);
		expect(tauriApi.invoke).toHaveBeenCalledWith("allow_dropped_file", {
			path: "E:/Audio/song.flac",
		});
		expect(tauriApi.invoke).toHaveBeenCalledWith("allow_dropped_file", {
			path: "D:/Lyrics/song.ttml",
		});
	});

	it("asks for the TTML location when the lyrics no longer come from the opened file", async () => {
		const store = makeStore(["imported"]);
		await createLinkedProjectFromCurrent(store as never, (k) => k);
		expect(dialog.save).toHaveBeenCalledTimes(1);
		expect(dialog.open).not.toHaveBeenCalled();
		expect(store.get(atoms.activeProjectManifestAtom)).toMatchObject({
			linked: { lyricPath: "D:/Picked/picked.ttml" },
		});
	});

	it("asks for the audio file when its path is unknown", async () => {
		const store = makeStore(["l1"]);
		store.set(atoms.pendingAudioPathAtom, null);
		await createLinkedProjectFromCurrent(store as never, (k) => k);
		expect(dialog.open).toHaveBeenCalledTimes(1);
		expect(dialog.save).not.toHaveBeenCalled();
		expect(store.get(atoms.activeProjectManifestAtom)).toMatchObject({
			linked: { audioPath: "E:/Picked/picked.flac" },
		});
	});

	it("rejects network shares with a dedicated error", async () => {
		dialog.save.mockResolvedValueOnce("//server/share/song.ttml");
		const store = makeStore(["imported"]);
		expect(await createLinkedProjectFromCurrent(store as never, (k) => k)).toBe(
			false,
		);
		expect(store.get(atoms.activeProjectManifestAtom)).toBeUndefined();
		expect(fs.writeTextFile).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalled();
	});
});
