import { Button, Checkbox, Dialog, Flex, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useSetImmerAtom } from "jotai-immer";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { combineWordsDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom, selectedWordsAtom } from "$/states/main";
import {
	combineMatchingWordSequences,
	combineSelectedWords,
	getCombineWordSelection,
} from "../utils/combine-words";

const combineWordsApplyToAllAtom = atomWithStorage(
	"lyricEditor.combineWords.applyToAll",
	false,
);
const combineWordsIgnoreCaseAtom = atomWithStorage(
	"lyricEditor.combineWords.ignoreCase",
	true,
);

export const CombineWordsDialog = memo(() => {
	const { t } = useTranslation();
	const [dialogState, setDialogState] = useAtom(combineWordsDialogAtom);
	const [applyToAll, setApplyToAll] = useAtom(combineWordsApplyToAllAtom);
	const [ignoreCase, setIgnoreCase] = useAtom(combineWordsIgnoreCaseAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const selectedWordIds = useAtomValue(selectedWordsAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	const selection = useMemo(() => {
		const line = lyricLines.lyricLines[dialogState.lineIndex];
		return line ? getCombineWordSelection(line.words, selectedWordIds) : null;
	}, [dialogState.lineIndex, lyricLines, selectedWordIds]);

	const canApplyToAll = selection?.isContiguous ?? false;
	const effectiveApplyToAll = canApplyToAll && applyToAll;

	const closeDialog = () => {
		setDialogState((current) => ({ ...current, open: false }));
	};

	const handleConfirm = () => {
		editLyricLines((state) => {
			const sourceLine = state.lyricLines[dialogState.lineIndex];
			if (!sourceLine) return;

			const currentSelection = getCombineWordSelection(
				sourceLine.words,
				selectedWordIds,
			);
			if (!currentSelection) return;

			if (effectiveApplyToAll && currentSelection.isContiguous) {
				for (const line of state.lyricLines) {
					line.words = combineMatchingWordSequences(
						line.words,
						currentSelection.words,
						ignoreCase,
					);
				}
			} else {
				sourceLine.words = combineSelectedWords(
					sourceLine.words,
					selectedWordIds,
				);
			}
		});
		closeDialog();
	};

	const sourceText =
		selection?.words.map((word) => word.word).join(" + ") ?? "";
	const resultText = selection?.words.map((word) => word.word).join("") ?? "";

	return (
		<Dialog.Root
			open={dialogState.open}
			onOpenChange={(open) =>
				setDialogState((current) => ({ ...current, open }))
			}
		>
			<Dialog.Content maxWidth="460px">
				<Dialog.Title>
					{t("combineWordsDialog.title", "Combine Words")}
				</Dialog.Title>
				<Dialog.Description size="2" mb="4">
					{t(
						"combineWordsDialog.description",
						"Confirm how the selected words should be combined.",
					)}
				</Dialog.Description>

				<Flex direction="column" gap="3">
					<Flex direction="column" gap="1">
						<Text size="2" color="gray">
							{t("combineWordsDialog.preview", "Preview")}
						</Text>
						<Text size="3" weight="medium">
							{sourceText} → {resultText}
						</Text>
					</Flex>

					<Flex direction="column" gap="2">
						<Text as="label" size="2">
							<Flex
								gap="2"
								align="center"
								style={{ opacity: canApplyToAll ? 1 : 0.5 }}
							>
								<Checkbox
									disabled={!canApplyToAll}
									checked={canApplyToAll && applyToAll}
									onCheckedChange={(checked) =>
										setApplyToAll(checked as boolean)
									}
								/>
								{t(
									"combineWordsDialog.applyToAll",
									"Apply this combination to all identical word sequences",
								)}
							</Flex>
						</Text>

						<Text as="label" size="2">
							<Flex
								gap="2"
								align="center"
								style={{ opacity: effectiveApplyToAll ? 1 : 0.5 }}
							>
								<Checkbox
									disabled={!effectiveApplyToAll}
									checked={effectiveApplyToAll && ignoreCase}
									onCheckedChange={(checked) =>
										setIgnoreCase(checked as boolean)
									}
								/>
								{t("combineWordsDialog.ignoreCase", "Ignore case")}
							</Flex>
						</Text>

						{!canApplyToAll && (
							<Text size="1" color="gray">
								{t(
									"combineWordsDialog.adjacentOnly",
									"Apply to all is available only for adjacent selected words.",
								)}
							</Text>
						)}
					</Flex>
				</Flex>

				<Flex gap="3" mt="4" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
					<Button disabled={!selection} onClick={handleConfirm}>
						{t("common.confirm", "Confirm")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
