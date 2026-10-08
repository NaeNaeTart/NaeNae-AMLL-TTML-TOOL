import saveFileFromLib from "save-file";
import { error } from "./logging";

export interface SaveFileOptions {
	suggestedName?: string;
	types?: {
		description: string;
		accept: Record<string, string[]>;
	}[];
}

export async function saveFile(
	content: Blob | string,
	options: SaveFileOptions | string,
) {
	const suggestedName =
		typeof options === "string" ? options : options.suggestedName;
	const types = typeof options === "string" ? undefined : options.types;

	if ("showSaveFilePicker" in window) {
		try {
			// @ts-ignore
			const handle = await window.showSaveFilePicker({
				suggestedName,
				types,
			});
			const writable = await handle.createWritable();
			await writable.write(content);
			await writable.close();
			return handle.name as string;
		} catch (e: any) {
			if (e.name === "AbortError") return null;
			error("Failed to save file via File System Access API", e);
		}
	}

	const b =
		typeof content === "string"
			? new Blob([content], { type: "text/plain" })
			: content;
	await saveFileFromLib(b, suggestedName || "file");
	return suggestedName;
}
