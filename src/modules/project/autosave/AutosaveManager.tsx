import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { autoSaveProject } from "$/modules/project/autosave/autosave";
import { activeProjectDirAtom } from "$/modules/project/folder-project/state";
import { useFolderProject } from "$/modules/project/folder-project/useFolderProject";
import {
	autosaveEnabledAtom,
	autosaveIntervalAtom,
	autosaveLimitAtom,
	folderProjectsAutosaveAtom,
	folderProjectsEnabledAtom,
} from "$/modules/settings/states";
import {
	isDirtyAtom,
	lastSavedTimeAtom,
	lyricLinesAtom,
	projectIdAtom,
	SaveStatus,
	saveStatusAtom,
} from "$/states/main";
import { log, error as logError } from "$/utils/logging";

export const AutosaveManager = () => {
	const lyricLines = useAtomValue(lyricLinesAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const enabled = useAtomValue(autosaveEnabledAtom);
	const limit = useAtomValue(autosaveLimitAtom);
	const intervalMinutes = useAtomValue(autosaveIntervalAtom);
	const projectId = useAtomValue(projectIdAtom);
	const activeDir = useAtomValue(activeProjectDirAtom);
	const folderProjectsEnabled = useAtomValue(folderProjectsEnabledAtom);
	const folderProjectsAutosave = useAtomValue(folderProjectsAutosaveAtom);
	const { saveLyricsOnly } = useFolderProject();

	const setSaveStatus = useSetAtom(saveStatusAtom);
	const setLastSavedTime = useSetAtom(lastSavedTimeAtom);

	const writeProjectFile = folderProjectsEnabled && folderProjectsAutosave;

	useEffect(() => {
		if (!enabled) return;

		if (!isDirty) {
			setSaveStatus(SaveStatus.Saved);
			return;
		}

		if (lyricLines.lyricLines.length === 0) {
			setSaveStatus(SaveStatus.Saved);
			return;
		}

		setSaveStatus(SaveStatus.Pending);

		const timer = setTimeout(() => {
			if (lyricLines.lyricLines.length > 0) {
				setSaveStatus(SaveStatus.Saving);
				log("Auto-saving project...", projectId);

				autoSaveProject(
					projectId,
					lyricLines,
					limit,
					intervalMinutes * 60 * 1000,
				)
					.then(async () => {
						if (activeDir && writeProjectFile) {
							try {
								await saveLyricsOnly({ silent: true });
							} catch (err) {
								logError("Failed to write project file on auto save", err);
							}
						}
						setSaveStatus(SaveStatus.Saved);
						setLastSavedTime(Date.now());
					})
					.catch((err) => {
						logError("Failed to autosave project", err);
						setSaveStatus(SaveStatus.Pending);
					});
			}
		}, 3000);

		return () => {
			clearTimeout(timer);
		};
	}, [
		lyricLines,
		isDirty,
		enabled,
		limit,
		projectId,
		setSaveStatus,
		setLastSavedTime,
		intervalMinutes,
		activeDir,
		writeProjectFile,
		saveLyricsOnly,
	]);

	return null;
};
