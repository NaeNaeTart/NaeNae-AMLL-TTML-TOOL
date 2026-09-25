import { useAtomValue, useStore } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
	importProjectDir as openImportProjectDir,
	openProject as openProjectFlow,
	openProjectFromDir as openProjectFromDirFlow,
} from "./project-open";
import {
	createProject as createProjectFlow,
	renameProject as renameProjectFlow,
	saveLyricsOnly as saveLyricsOnlyFlow,
	saveProject as saveProjectFlow,
} from "./project-save";
import {
	workspaceDirAtom,
	workspaceProjectsAtom,
	workspaceScanningAtom,
} from "./state";
import {
	openWorkspaceDialog,
	rescanWorkspace as rescanWorkspaceFlow,
} from "./workspace";

export const useFolderProject = () => {
	const { t: rawT } = useTranslation();
	const t = rawT as (key: string, fallback?: string) => string;
	const store = useStore();

	const workspaceProjects = useAtomValue(workspaceProjectsAtom);
	const workspaceDir = useAtomValue(workspaceDirAtom);
	const workspaceScanning = useAtomValue(workspaceScanningAtom);

	const openProject = useCallback(() => {
		return openProjectFlow(store, t);
	}, [store, t]);

	const openProjectFromDir = useCallback(
		(dir: string) => {
			return openProjectFromDirFlow(dir, store, t);
		},
		[store, t],
	);

	const importProjectDir = useCallback(
		(dir: string) => {
			return openImportProjectDir(dir, store, t);
		},
		[store, t],
	);

	const createProject = useCallback(() => {
		return createProjectFlow(store, t);
	}, [store, t]);

	const saveProject = useCallback(() => {
		return saveProjectFlow(store, t);
	}, [store, t]);

	const saveLyricsOnly = useCallback(
		(options?: { silent?: boolean }) => {
			return saveLyricsOnlyFlow(store, t, options);
		},
		[store, t],
	);

	const renameProject = useCallback(
		(nextName: string) => {
			return renameProjectFlow(store, nextName, t);
		},
		[store, t],
	);

	const openWorkspace = useCallback(() => {
		return openWorkspaceDialog(store, t);
	}, [store, t]);

	const rescanWorkspace = useCallback(() => {
		return rescanWorkspaceFlow(store, t);
	}, [store, t]);

	return {
		openProject,
		openProjectFromDir,
		importProjectDir,
		createProject,
		saveProject,
		saveLyricsOnly,
		renameProject,
		openWorkspace,
		rescanWorkspace,
		workspaceProjects,
		workspaceDir,
		workspaceScanning,
	};
};
