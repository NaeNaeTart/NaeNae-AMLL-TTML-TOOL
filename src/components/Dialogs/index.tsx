import { LatencyTestDialog } from "$/modules/audio/modals/LatencyTest.tsx";
import { LyricsfileConverterDialog } from "$/modules/lyricsfile-processor/LyricsfileConverterDialog.tsx";
import { GeniusImportLyricsDialog } from "$/modules/genius/modals/GeniusImportLyricsDialog.tsx";
import { GeniusSearchDialog } from "$/modules/genius/modals/GeniusSearchDialog.tsx";
import { ImportFromLRCLIB } from "$/modules/lrclib/modals/ImportDialog.tsx";
import { PublishDialog as PublishToLRCLIBDialog } from "$/modules/lrclib/modals/PublishDialog.tsx";
import { UnisonPublishDialog } from "$/modules/unison/modals/PublishDialog.tsx";
import { GrammarCheckDialog } from "$/modules/lyric-editor/modals/GrammarCheckDialog.tsx";
import { UrbanDictionaryDialog } from "$/modules/lyric-editor/modals/UrbanDictionaryDialog.tsx";
import { CombineWordsDialog } from "$/modules/lyric-editor/tools/CombineWordsDialog.tsx";
import { ReplaceRomanizationDialog } from "$/modules/lyric-editor/tools/ReplaceRomanizationDialog.tsx";
import { ReplaceWordDialog } from "$/modules/lyric-editor/tools/ReplaceWordDialog.tsx";
import { TimeShiftDialog } from "$/modules/lyric-editor/tools/TimeShift.tsx";
import { TimeStretchDialog } from "$/modules/lyric-editor/tools/TimeStretch.tsx";
import { ImportLyricsDialog } from "$/modules/lyrics-import/modals/ImportLyricsDialog.tsx";
import { HistoryRestoreDialog } from "$/modules/project/modals/HistoryRestore.tsx";
import { ImportFromText } from "$/modules/project/modals/ImportFromText.tsx";
import { MetadataEditor } from "$/modules/project/modals/MetadataEditor.tsx";
import { SubmitToAMLLDBDialog } from "$/modules/project/modals/SubmitToAmll.tsx";
import { AdvancedSegmentationDialog } from "$/modules/segmentation/components/AdvancedSegmentation.tsx";
import { AutoSegmentDialog } from "$/modules/segmentation/components/AutoSegmentDialog.tsx";
import { LearnedSplitsDialog } from "$/modules/segmentation/components/LearnedSplits.tsx";
import { SuggestedSplitsDialog } from "$/modules/segmentation/components/SuggestedSplits.tsx";
import { SplitWordDialog } from "$/modules/segmentation/components/split-word.tsx";
import { FontSelectionDialog } from "$/modules/settings/modals/FontSelectionDialog.tsx";
import { SettingsDialog } from "$/modules/settings/modals/index.tsx";
import { TTMLChecklistDialog } from "$/modules/ttml-checklist/TTMLChecklistDialog.tsx";
import { SpotMatchDialog } from "$/modules/spotmatch/modals/SpotMatchDialog.tsx";
import { SpotMatchFloatingWidget } from "$/modules/spotmatch/components/SpotMatchFloatingWidget.tsx";
import { ChangelogDialog } from "./changelog.tsx";
import { ConfirmationDialog } from "./confirmation.tsx";
import {
	ExperimentalFeaturesDialog,
	GeniusHeaderDetectionDialog,
} from "./experimental-features.tsx";
import { Mp3ConversionDialog } from "./mp3-conversion.tsx";
import { ImportLyricsChooserDialog } from "./import-lyrics-chooser.tsx";
import { WhatsNewDialog } from "./whats-new.tsx";

export const Dialogs = () => {
	return (
		<>
			<ImportLyricsChooserDialog />
			<ImportFromText />
			<ImportFromLRCLIB />
			<ImportLyricsDialog />
			<MetadataEditor />
			<SettingsDialog />
			<SplitWordDialog />
			<CombineWordsDialog />
			<ReplaceWordDialog />
			<ReplaceRomanizationDialog />
			<SubmitToAMLLDBDialog />
			<LatencyTestDialog />
			<TTMLChecklistDialog />
			<LyricsfileConverterDialog />
			<PublishToLRCLIBDialog />
			<UnisonPublishDialog />
			<ConfirmationDialog />
			<Mp3ConversionDialog />
			<HistoryRestoreDialog />
			<AdvancedSegmentationDialog />
			<AutoSegmentDialog />
			<LearnedSplitsDialog />
			<TimeShiftDialog />
			<TimeStretchDialog />
			<GrammarCheckDialog />

			<SpotMatchDialog />
			<SpotMatchFloatingWidget />
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
