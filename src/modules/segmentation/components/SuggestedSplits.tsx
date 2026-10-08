import { Box, Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { useAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	segmentLyricLines,
	segmentWord,
} from "$/modules/segmentation/utils/segmentation.ts";
import { suggestedSplitsDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main";
import type { LyricWord } from "$/types/ttml";
import { useSegmentationConfig } from "../utils/useSegmentationConfig";

export const SuggestedSplitsDialog = memo(() => {
	const [dialog, setDialog] = useAtom(suggestedSplitsDialogAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const { t } = useTranslation();
	const { config, isLoading } = useSegmentationConfig();
	const store = useStore();

	const targetLine = useMemo(() => {
		if (!dialog.open || !dialog.lineId) return null;
		const lines = store.get(lyricLinesAtom).lyricLines;
		return lines.find((l) => l.id === dialog.lineId);
	}, [dialog.open, dialog.lineId, store]);

	const suggestions = useMemo(() => {
		if (!targetLine) return [];
		if (dialog.wordIndex !== undefined) {
			const word = targetLine.words[dialog.wordIndex];
			if (!word) return [];
			const result = segmentWord(word, config);
			// Only suggest if it actually splits into more than 1 part or changes something
			if (
				result.length > 1 ||
				(result.length === 1 && result[0].word !== word.word)
			) {
				return [result];
			}
			return [];
		} else {
			// Whole line suggestion
			const resultLine = segmentLyricLines([targetLine], config)[0];
			// Only suggest if the number of words changed or contents changed
			const wordsChanged =
				resultLine.words.length !== targetLine.words.length ||
				resultLine.words.some((w, i) => w.word !== targetLine.words[i]?.word);
			if (wordsChanged) {
				return [resultLine.words];
			}
			return [];
		}
	}, [targetLine, dialog.wordIndex, config]);

	const handleApply = (words: LyricWord[]) => {
		editLyricLines((state) => {
			const line = state.lyricLines.find((l) => l.id === dialog.lineId);
			if (!line) return;
			if (dialog.wordIndex !== undefined) {
				line.words.splice(dialog.wordIndex, 1, ...words);
			} else {
				line.words = words;
			}
		});
		setDialog({ open: false });
	};

	return (
		<Dialog.Root
			open={dialog.open}
			onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
		>
			<Dialog.Content size="3">
				<Dialog.Title>
					{t("suggestedSplits.title", "Suggested Splits")}
				</Dialog.Title>
				<Dialog.Description>
					{t(
						"suggestedSplits.description",
						"Choose a suggested split pattern for this {type}.",
						{
							type: dialog.wordIndex !== undefined ? "word" : "line",
						},
					)}
				</Dialog.Description>
				<Flex direction="column" gap="4" mt="4">
					{isLoading ? (
						<Text color="gray" align="center">
							{t("common.loading", "Loading...")}
						</Text>
					) : (
						<>
							{suggestions.map((option, _i) => (
								<Box
									key={`suggestion-${option.map((w) => w.id).join("-")}`}
									p="3"
									style={{
										border: "1px solid var(--gray-5)",
										borderRadius: "var(--radius-3)",
									}}
								>
									<Flex direction="row" gap="2" wrap="wrap" mb="3">
										{option.map((w) => (
											<Box
												key={w.id}
												p="1"
												px="2"
												style={{
													backgroundColor: "var(--accent-3)",
													borderRadius: "var(--radius-2)",
												}}
											>
												<Text size="1">{w.word}</Text>
											</Box>
										))}
									</Flex>
									<Button size="1" onClick={() => handleApply(option)}>
										{t("suggestedSplits.apply", "Apply Suggestion")}
									</Button>
								</Box>
							))}
							{suggestions.length === 0 && (
								<Text color="gray" align="center">
									{t(
										"suggestedSplits.noSuggestions",
										"No automated split suggestions available for this content.",
									)}
								</Text>
							)}
						</>
					)}
				</Flex>
				<Flex justify="end" mt="4">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
