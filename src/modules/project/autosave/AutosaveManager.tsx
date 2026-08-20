import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { audioBufferAtom } from "$/modules/audio/states";
import { autoSaveProject } from "$/modules/project/autosave/autosave";
import { activeProjectDirAtom } from "$/modules/project/folder-project/state";
import { useFolderProject } from "$/modules/project/folder-project/useFolderProject";
import {
	autosaveEnabledAtom,
	autosaveIntervalAtom,
	autosaveLimitAtom,
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

// Autosave used to be a fixed 3-second debounce after every change,
// completely ignoring the "Save Interval (minutes)" setting the user
// actually configures. It also only ever wrote to the IndexedDB snapshot
// history (autosave.ts), never the real project file on disk, so a folder
// project always showed unsaved changes no matter what "Autosaved at ..."
// said. This now ticks on the configured interval and, when a folder
// project is open, writes the real lyric file too; the IndexedDB
// snapshot is kept alongside it as version history (Projects -> History).
export const AutosaveManager = () => {
	const lyricLines = useAtomValue(lyricLinesAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const enabled = useAtomValue(autosaveEnabledAtom);
	const limit = useAtomValue(autosaveLimitAtom);
	const intervalMinutes = useAtomValue(autosaveIntervalAtom);
	const projectId = useAtomValue(projectIdAtom);
	const audioBuffer = useAtomValue(audioBufferAtom);
	const activeDir = useAtomValue(activeProjectDirAtom);
	const { saveLyricsOnly } = useFolderProject();

	const setSaveStatus = useSetAtom(saveStatusAtom);
	const setLastSavedTime = useSetAtom(lastSavedTimeAtom);

	const hasLyricText = lyricLines.lyricLines.some((line) =>
		line.words.some((w) => w.word.trim().length > 0),
	);
	const hasTiming = lyricLines.lyricLines.some((line) =>
		line.words.some((w) => w.startTime > 0 || w.endTime > 0),
	);
	const hasAudio = audioBuffer !== null;
	const isAutosaveWorthy = hasLyricText && hasAudio && hasTiming;

	// Latest values read from a ref inside the interval callback, so the
	// interval itself does not need to be torn down and rebuilt on every
	// keystroke (that was the root cause of the "fires on every change"
	// symptom: the old effect's dependency array included `lyricLines`).
	const latest = useRef({
		lyricLines,
		isDirty,
		enabled,
		isAutosaveWorthy,
		limit,
		projectId,
		activeDir,
		saveLyricsOnly,
	});
	latest.current = {
		lyricLines,
		isDirty,
		enabled,
		isAutosaveWorthy,
		limit,
		projectId,
		activeDir,
		saveLyricsOnly,
	};

	useEffect(() => {
		if (!enabled) {
			setSaveStatus(SaveStatus.Saved);
			return;
		}

		const tick = async () => {
			const {
				lyricLines: currentLyricLines,
				isDirty: currentIsDirty,
				isAutosaveWorthy: currentWorthy,
				limit: currentLimit,
				projectId: currentProjectId,
				activeDir: currentActiveDir,
				saveLyricsOnly: currentSaveLyricsOnly,
			} = latest.current;

			if (!currentIsDirty || !currentWorthy) {
				setSaveStatus(SaveStatus.Saved);
				return;
			}

			setSaveStatus(SaveStatus.Saving);
			log("Auto-saving project...", currentProjectId);

			try {
				// IndexedDB snapshot history, always kept as a safety net
				// independent of whether a folder project is open.
				await autoSaveProject(
					currentProjectId,
					currentLyricLines,
					currentLimit,
					intervalMinutes * 60 * 1000,
				);

				// The actual project file on disk, when one is open. This
				// is what makes the file's unsaved-changes indicator clear.
				if (currentActiveDir) {
					await currentSaveLyricsOnly({ silent: true });
				}

				setSaveStatus(SaveStatus.Saved);
				setLastSavedTime(Date.now());
			} catch (err) {
				logError("Failed to autosave project", err);
				setSaveStatus(SaveStatus.Pending);
			}
		};

		const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
		const timer = window.setInterval(tick, intervalMs);
		return () => window.clearInterval(timer);
	}, [enabled, intervalMinutes, setSaveStatus, setLastSavedTime]);

	useEffect(() => {
		if (!enabled || !isAutosaveWorthy || !isDirty) {
			setSaveStatus(SaveStatus.Saved);
		} else {
			setSaveStatus(SaveStatus.Pending);
		}
	}, [enabled, isAutosaveWorthy, isDirty, setSaveStatus]);

	return null;
};
