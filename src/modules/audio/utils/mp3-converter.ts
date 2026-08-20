import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

const ffmpeg = new FFmpeg();

let loaded = false;
let loadPromise: Promise<void> | null = null;

async function loadFfmpeg(): Promise<void> {
	if (loaded) return;
	if (loadPromise) return loadPromise;

	loadPromise = (async () => {
		const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

		await ffmpeg.load({
			coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
			wasmURL: await toBlobURL(
				`${baseURL}/ffmpeg-core.wasm`,
				"application/wasm",
			),
		});
		loaded = true;
	})();

	return loadPromise;
}

export async function convertMp3ToFlac(
	mp3Data: Uint8Array,
	_fileName: string,
): Promise<Uint8Array> {
	await loadFfmpeg();

	await ffmpeg.writeFile("input.mp3", mp3Data);

	const messages: string[] = [];

	ffmpeg.on("log", ({ message }) => {
		messages.push(message);
	});

	try {
		await ffmpeg.exec([
			"-i",
			"input.mp3",
			"-codec:a",
			"flac",
			"-y",
			"output.flac",
		]);
	} catch {
		throw new Error(`FFmpeg failed: ${messages.join(", ")}`);
	}

	const data = await ffmpeg.readFile("output.flac");

	await ffmpeg.deleteFile("input.mp3");
	await ffmpeg.deleteFile("output.flac");

	return new Uint8Array(data as Uint8Array);
}
