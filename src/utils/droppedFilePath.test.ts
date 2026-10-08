import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const events = vi.hoisted(() => ({
	handler: undefined as
		| ((event: { payload: { id: string; paths: string[] } }) => void)
		| undefined,
	unlisten: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
	listen: vi.fn(
		async (
			_name: string,
			handler: (event: { payload: { id: string; paths: string[] } }) => void,
		) => {
			events.handler = handler;
			return events.unlisten;
		},
	),
}));
vi.mock("uid", () => ({ uid: () => "request-1" }));

import { attachDroppedFilePath } from "./droppedFilePath";

const pathOf = (file: File) => (file as File & { path?: string }).path;

describe("attachDroppedFilePath", () => {
	let post: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubEnv("TAURI_ENV_PLATFORM", "windows");
		post = vi.fn((message: string) => {
			const id = String(message).split(":").pop() ?? "";
			events.handler?.({ payload: { id, paths: ["C:\\Music\\song.flac"] } });
		});
		vi.stubGlobal("window", {
			setTimeout,
			clearTimeout,
			chrome: { webview: { postMessageWithAdditionalObjects: post } },
		});
		events.unlisten.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("attaches the path WebView2 reports for the dropped file", async () => {
		const file = new File(["a"], "song.flac");
		await attachDroppedFilePath(file);
		expect(post).toHaveBeenCalledWith("amll-dropped-files:request-1", [file]);
		expect(pathOf(file)).toBe("C:\\Music\\song.flac");
		expect(events.unlisten).toHaveBeenCalledTimes(1);
	});

	it("ignores answers meant for another drop request", async () => {
		post.mockImplementation(() => {
			events.handler?.({
				payload: { id: "other-request", paths: ["C:\\Music\\other.flac"] },
			});
		});
		const file = new File(["a"], "song.flac");
		const pending = attachDroppedFilePath(file);
		await vi.advanceTimersByTimeAsync(1000);
		await pending;
		expect(pathOf(file)).toBeUndefined();
		expect(events.unlisten).toHaveBeenCalledTimes(1);
	});

	it("leaves the file without a path when no answer arrives", async () => {
		post.mockImplementation(() => undefined);
		const file = new File(["a"], "song.flac");
		const pending = attachDroppedFilePath(file);
		await vi.advanceTimersByTimeAsync(1000);
		await pending;
		expect(pathOf(file)).toBeUndefined();
		expect(events.unlisten).toHaveBeenCalledTimes(1);
	});

	it("does nothing outside the WebView2 desktop app", async () => {
		vi.stubGlobal("window", { setTimeout, clearTimeout });
		const file = new File(["a"], "song.flac");
		await attachDroppedFilePath(file);
		expect(pathOf(file)).toBeUndefined();
	});
});
