import { listen } from "@tauri-apps/api/event";
import { uid } from "uid";

type WebView2Bridge = {
	postMessageWithAdditionalObjects?: (
		message: string,
		objects: ArrayLike<unknown>,
	) => void;
};

interface DroppedFilePathsPayload {
	id: string;
	paths: string[];
}

const PATH_TIMEOUT_MS = 1000;
const DROPPED_FILES_MESSAGE_PREFIX = "amll-dropped-files:";

export async function attachDroppedFilePath(file: File): Promise<void> {
	const bridge = (window as { chrome?: { webview?: WebView2Bridge } }).chrome
		?.webview;
	const post = bridge?.postMessageWithAdditionalObjects;
	if (!import.meta.env.TAURI_ENV_PLATFORM || !post) return;

	const requestId = uid();
	const path = await new Promise<string | null>((resolve) => {
		let settled = false;
		let unlisten: (() => void) | undefined;
		const finish = (value: string | null) => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timer);
			unlisten?.();
			resolve(value);
		};
		const timer = window.setTimeout(() => finish(null), PATH_TIMEOUT_MS);
		listen<DroppedFilePathsPayload>("dropped-file-paths", (event) => {
			if (event.payload.id !== requestId) return;
			finish(event.payload.paths[0] ?? null);
		}).then(
			(stop) => {
				if (settled) {
					stop();
					return;
				}
				unlisten = stop;
				post.call(bridge, `${DROPPED_FILES_MESSAGE_PREFIX}${requestId}`, [
					file,
				]);
			},
			() => finish(null),
		);
	});
	if (path) (file as File & { path?: string }).path = path;
}
