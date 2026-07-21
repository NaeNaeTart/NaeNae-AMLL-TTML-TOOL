import { LatencyTestDialog } from "$/modules/audio/modals/LatencyTest.tsx";
import { GeniusSearchDialog } from "$/modules/genius/modals/GeniusSearchDialog.tsx";
import { GeniusImportLyricsDialog } from "$/modules/genius/modals/GeniusImportLyricsDialog.tsx";
import { ImportFromLRCLIB } from "$/modules/lrclib/modals/ImportDialog.tsx";
import { LyricallyImportDialog } from "$/modules/lyrically/modals/LyricallyImportDialog.tsx";
import { ReplaceWordDialog } from "$/modules/lyric-editor/tools/ReplaceWordDialog.tsx";
import { TimeShiftDialog } from "$/modules/lyric-editor/tools/TimeShift.tsx";
import { TimeStretchDialog } from "$/modules/lyric-editor/tools/TimeStretch.tsx";
import { GrammarCheckDialog } from "$/modules/lyric-editor/modals/GrammarCheckDialog.tsx";

import { HistoryRestoreDialog } from "$/modules/project/modals/HistoryRestore.tsx";
import { ImportFromText } from "$/modules/project/modals/ImportFromText.tsx";
import { MetadataEditor } from "$/modules/project/modals/MetadataEditor.tsx";
import { SubmitToAMLLDBDialog } from "$/modules/project/modals/SubmitToAmll.tsx";
import { AdvancedSegmentationDialog } from "$/modules/segmentation/components/AdvancedSegmentation.tsx";
import { SplitWordDialog } from "$/modules/segmentation/components/split-word.tsx";
import { SettingsDialog } from "$/modules/settings/modals/index.tsx";
import { ChangelogDialog } from "./changelog.tsx";
import { WhatsNewDialog } from "./whats-new.tsx";
import { ConfirmationDialog } from "./confirmation.tsx";
import { Mp3ConversionDialog } from "./mp3-conversion.tsx";
import { FontSelectionDialog } from "$/modules/settings/modals/FontSelectionDialog.tsx";
import { UrbanDictionaryDialog } from "$/modules/lyric-editor/modals/UrbanDictionaryDialog.tsx";
import { SuggestedSplitsDialog } from "$/modules/segmentation/components/SuggestedSplits.tsx";
import { ExperimentalFeaturesDialog, GeniusHeaderDetectionDialog } from "./experimental-features.tsx";

export const Dialogs = () => {
	return (
		<>
			<ImportFromText />
			<ImportFromLRCLIB />
			<LyricallyImportDialog />
			<MetadataEditor />
			<SettingsDialog />
			<SplitWordDialog />
			<ReplaceWordDialog />
			<SubmitToAMLLDBDialog />
			<LatencyTestDialog />
			<ConfirmationDialog />
			<Mp3ConversionDialog />
			<HistoryRestoreDialog />
			<AdvancedSegmentationDialog />
			<TimeShiftDialog />
			<TimeStretchDialog />
			<GrammarCheckDialog />

			<GeniusSearchDialog />
			<GeniusImportLyricsDialog />
			<ChangelogDialog />
			<WhatsNewDialog />
			<FontSelectionDialog />
			<UrbanDictionaryDialog />
			<SuggestedSplitsDialog />
			<ExperimentalFeaturesDialog />
			<GeniusHeaderDetectionDialog />
		</>
	);
};

export default Dialogs;
