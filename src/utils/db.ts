import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { WASMPlugin } from "$/modules/plugins/types";

const DB_NAME = "amll-plugins-db";
const DB_VERSION = 1;

interface PluginDBSchema extends DBSchema {
	wasm_plugins: {
		key: string;
		value: WASMPlugin;
	};
}

let dbPromise: Promise<IDBPDatabase<PluginDBSchema>> | null = null;

export async function idb() {
	if (!dbPromise) {
		dbPromise = openDB<PluginDBSchema>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains("wasm_plugins")) {
					db.createObjectStore("wasm_plugins", { keyPath: "id" });
				}
			},
		});
	}
	return dbPromise;
}
