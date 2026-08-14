import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";

export interface OpenFileOptions {
	filters?: { name: string; extensions: string[] }[];
	multiple?: boolean;
}

export async function openFileWithDialog(
	options: OpenFileOptions,
): Promise<File | File[] | null> {
	if (import.meta.env.TAURI_ENV_PLATFORM) {
		const selected = await open({
			multiple: options.multiple,
			filters: options.filters,
		});
		if (!selected) return null;

		if (Array.isArray(selected)) {
			const { readFile } = await import("@tauri-apps/plugin-fs");
			const files = await Promise.all(
				selected.map(async (path) => {
					const data = await readFile(path);
					const fileName = path.split(/[/\\]/).pop() || "unknown";
					const ext = fileName.split('.').pop()?.toLowerCase();
					
					let mime = "application/octet-stream";
					if (ext === "ttml") mime = "application/ttml+xml";
					else if (ext === "mp3") mime = "audio/mpeg";
					else if (ext === "wav") mime = "audio/wav";
					else if (ext === "flac") mime = "audio/flac";
					else if (ext === "ogg") mime = "audio/ogg";
					
					const blob = new Blob([data], { type: mime });
					const file = new File([blob], fileName, { type: mime });
					(file as any).path = path;
					return file;
				}),
			);
			return files;
		} else {
			const { readFile } = await import("@tauri-apps/plugin-fs");
			const path = selected;
			const data = await readFile(path);
			const fileName = path.split(/[/\\]/).pop() || "unknown";
			const ext = fileName.split('.').pop()?.toLowerCase();
			
			let mime = "application/octet-stream";
			if (ext === "ttml") mime = "application/ttml+xml";
			else if (ext === "mp3") mime = "audio/mpeg";
			else if (ext === "wav") mime = "audio/wav";
			else if (ext === "flac") mime = "audio/flac";
			else if (ext === "ogg") mime = "audio/ogg";
			
			const blob = new Blob([data], { type: mime });
			const file = new File([blob], fileName, { type: mime });
			(file as any).path = path;
			return file;
		}
	} else {
		return new Promise((resolve) => {
			const inputEl = document.createElement("input");
			inputEl.type = "file";
			if (options.multiple) inputEl.multiple = true;
			if (options.filters) {
				const exts = options.filters.flatMap((f) =>
					f.extensions.map((e) => `.${e}`),
				);
				inputEl.accept = exts.join(",") + ",*/*";
			}
			inputEl.addEventListener(
				"change",
				() => {
					const files = Array.from(inputEl.files || []);
					if (files.length === 0) resolve(null);
					else if (options.multiple) resolve(files);
					else resolve(files[0]);
				},
				{ once: true },
			);
			inputEl.click();
		});
	}
}
