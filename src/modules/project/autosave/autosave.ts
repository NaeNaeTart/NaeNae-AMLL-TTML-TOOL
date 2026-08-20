import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import { identifyProject } from "$/modules/project/logic/project-info";
import type { TTMLLyric } from "$/types/ttml";

const DB_NAME = "amll-autosave-db";
const DB_VERSION = 2;


interface LegacySnapshot {
	id?: number;
	timestamp: number;
	lyrics: TTMLLyric;
}


export interface ProjectInfo {
	
	id: string;
	
	name: string;
	
	lastModified: number;
	
	preview?: string;
	
	latestState: TTMLLyric;
	
	isUntitled?: boolean;
}


export interface ProjectVersion {
	
	id?: number;
	
	projectId: string;
	
	timestamp: number;
	
	data: TTMLLyric;
}


interface AutosaveDBSchema extends DBSchema {
	
	projects: {
		key: string;
		value: ProjectInfo;
		indexes: { "by-last-modified": number };
	};
	
	versions: {
		key: number;
		value: ProjectVersion;
		indexes: {
			
			"by-project": string;
			
			"by-project-date": [string, number];
		};
	};
}

let dbPromise: Promise<IDBPDatabase<AutosaveDBSchema>> | null = null;


function getDB() {
	if (!dbPromise) {
		dbPromise = openDB<AutosaveDBSchema>(DB_NAME, DB_VERSION, {
			async upgrade(db, oldVersion, _newVersion, transaction) {
				if (!db.objectStoreNames.contains("projects")) {
					const projectStore = db.createObjectStore("projects", {
						keyPath: "id",
					});
					projectStore.createIndex("by-last-modified", "lastModified");
				}

				if (!db.objectStoreNames.contains("versions")) {
					const versionStore = db.createObjectStore("versions", {
						keyPath: "id",
						autoIncrement: true,
					});
					versionStore.createIndex("by-project", "projectId");
					versionStore.createIndex("by-project-date", [
						"projectId",
						"timestamp",
					]);
				}

				if (
					oldVersion < 2 &&
					// biome-ignore lint/suspicious/noExplicitAny: 旧版本的快照
					db.objectStoreNames.contains("snapshots" as any)
				) {
					const legacyProjectId = "legacy_autosave_archive";
					// biome-ignore lint/suspicious/noExplicitAny: 旧版本的快照，应该存在
					const oldStore = transaction.objectStore("snapshots" as any);
					const oldSnapshots = (await oldStore.getAll()) as LegacySnapshot[];

					if (oldSnapshots && oldSnapshots.length > 0) {
						oldSnapshots.sort((a, b) => a.timestamp - b.timestamp);
						const latestSnapshot = oldSnapshots[oldSnapshots.length - 1];
						const projectStore = transaction.objectStore("projects");
						await projectStore.put({
							id: legacyProjectId,
							name: "Legacy Snapshots Archive",
							lastModified: latestSnapshot.timestamp,
							latestState: latestSnapshot.lyrics,
							preview: "(来自旧版自动保存的历史数据)",
						});
						const versionStore = transaction.objectStore("versions");
						for (const snap of oldSnapshots) {
							await versionStore.add({
								projectId: legacyProjectId,
								timestamp: snap.timestamp,
								data: snap.lyrics,
							});
						}
					}
					// biome-ignore lint/suspicious/noExplicitAny: 旧版本的快照，应该存在
					db.deleteObjectStore("snapshots" as any);
				}
			},
		});
	}
	return dbPromise;
}


export async function autoSaveProject(
	projectId: string,
	lyrics: TTMLLyric,
	limit: number,
	saveInterval: number,
) {
	const db = await getDB();

	const identity = identifyProject(lyrics);
	const now = Date.now();

	const tx = db.transaction(["projects", "versions"], "readwrite");
	const projectStore = tx.objectStore("projects");
	const versionStore = tx.objectStore("versions");

	await projectStore.put({
		id: projectId,
		name: identity.displayName,
		lastModified: now,
		latestState: lyrics,
		preview: lyrics.lyricLines[0]?.words.map((w) => w.word).join("") || "",
		isUntitled: identity.isUntitled,
	});

	let lastVersionTime = 0;
	const index = versionStore.index("by-project-date");
	const range = IDBKeyRange.bound([projectId, 0], [projectId, Infinity]);
	const cursor = await index.openCursor(range, "prev");

	if (cursor) {
		lastVersionTime = cursor.value.timestamp;
	}

	if (now - lastVersionTime > saveInterval) {
		await versionStore.add({
			projectId: projectId,
			timestamp: now,
			data: lyrics,
		});

		const allVersionKeys = await index.getAllKeys(range);
		if (allVersionKeys.length > limit) {
			const keysToDelete = allVersionKeys.slice(
				0,
				allVersionKeys.length - limit,
			);
			await Promise.all(keysToDelete.map((key) => versionStore.delete(key)));
		}
	}

	await tx.done;
}


export async function getProjectList(): Promise<ProjectInfo[]> {
	const db = await getDB();
	const projects = await db.getAllFromIndex("projects", "by-last-modified");
	return projects.reverse();
}


export async function getProjectVersions(
	projectId: string,
): Promise<ProjectVersion[]> {
	const db = await getDB();
	const range = IDBKeyRange.bound([projectId, 0], [projectId, Infinity]);
	const versions = await db.getAllFromIndex(
		"versions",
		"by-project-date",
		range,
	);
	return versions.reverse();
}


export async function getProjectLatestState(
	projectId: string,
): Promise<TTMLLyric | undefined> {
	const db = await getDB();
	const project = await db.get("projects", projectId);
	return project?.latestState;
}


export async function exportAllProjectsData(): Promise<{
	projects: ProjectInfo[];
	versions: ProjectVersion[];
}> {
	const db = await getDB();
	const [projects, versions] = await Promise.all([
		db.getAll("projects"),
		db.getAll("versions"),
	]);
	return { projects, versions };
}


export async function restoreProjectsData(
	projects: ProjectInfo[],
	versions: Omit<ProjectVersion, "id">[],
): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(["projects", "versions"], "readwrite");
	const projectStore = tx.objectStore("projects");
	const versionStore = tx.objectStore("versions");
	const versionIndex = versionStore.index("by-project");

	for (const project of projects) {
		await projectStore.put(project);
		const existingKeys = await versionIndex.getAllKeys(project.id);
		await Promise.all(existingKeys.map((key) => versionStore.delete(key)));
	}

	for (const version of versions) {
		const { id: _ignored, ...rest } = version as ProjectVersion;
		await versionStore.add(rest);
	}

	await tx.done;
}


export async function deleteProject(projectId: string): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(["projects", "versions"], "readwrite");
	await tx.objectStore("projects").delete(projectId);

	const versionStore = tx.objectStore("versions");
	const index = versionStore.index("by-project");
	const keys = await index.getAllKeys(projectId);

	await Promise.all(keys.map((k) => versionStore.delete(k)));

	await tx.done;
}

export async function clearAllProjects(): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(["projects", "versions"], "readwrite");
	await tx.objectStore("projects").clear();
	await tx.objectStore("versions").clear();
	await tx.done;
}
