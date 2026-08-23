import { Button, Dialog, Flex, Select, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	segmentationEngineAtom,
	segmentationSplitEnglishAtom,
} from "$/modules/segmentation/states";
import type { SegmentationEngineId } from "$/modules/segmentation/types";
import { detectSyllabificationEngine } from "$/modules/segmentation/utils/detect-syllabification-engine";
import { segmentLyricLines } from "$/modules/segmentation/utils/segmentation";
import { SYLLABIFICATION_ENGINES } from "$/modules/segmentation/utils/syllabification-engines";
import { autoSegmentDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import { useSegmentationConfig } from "../utils/useSegmentationConfig";

export const AutoSegmentDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(autoSegmentDialogAtom);
	const savedEngine = useAtomValue(segmentationEngineAtom);
	const setEngine = useSetAtom(segmentationEngineAtom);
	const setSplitEnglish = useSetAtom(segmentationSplitEnglishAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const lyrics = useAtomValue(lyricLinesAtom);
	const { config, isLoading } = useSegmentationConfig();
	const [selectedEngine, setSelectedEngine] =
		useState<SegmentationEngineId>(savedEngine);
	const suggestedEngine = useMemo(
		() => detectSyllabificationEngine(lyrics.lyricLines),
		[lyrics.lyricLines],
	);

	useEffect(() => {
		if (open) setSelectedEngine(suggestedEngine ?? savedEngine);
	}, [open, savedEngine, suggestedEngine]);

	const engine = useMemo(
		() =>
			SYLLABIFICATION_ENGINES.find(({ id }) => id === selectedEngine) ??
			SYLLABIFICATION_ENGINES[0],
		[selectedEngine],
	);

	const apply = async () => {
		setEngine(selectedEngine);
		setSplitEnglish(selectedEngine !== "none");
		const nextLines = await segmentLyricLines(lyrics.lyricLines, {
			...config,
			engine: selectedEngine,
			splitEnglish: selectedEngine !== "none",
		});
		editLyricLines((draft) => {
			draft.lyricLines = nextLines;
		});
		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="500px">
				<Dialog.Title>{t("autoSegmentDialog.title", "Auto Segment")}</Dialog.Title>
				<Dialog.Description>
					{t("autoSegmentDialog.description", "Choose a syllabification engine for all lyric lines.")}
				</Dialog.Description>
				<Flex direction="column" gap="3" mt="4">
					<Select.Root
						value={selectedEngine}
						onValueChange={(value) =>
							setSelectedEngine(value as SegmentationEngineId)
						}
					>
						<Select.Trigger />
						<Select.Content>
							{SYLLABIFICATION_ENGINES.map(({ id, name }) => (
								<Select.Item key={id} value={id}>
									{name}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
					<Text size="2" color="gray">
						{engine.description}
					</Text>
					{suggestedEngine && (
						<Text size="2" color="gray">
							{t("autoSegmentDialog.suggested", "Suggested from lyrics:")}{" "}
							{
								SYLLABIFICATION_ENGINES.find(({ id }) => id === suggestedEngine)
									?.name
							}
						</Text>
					)}
				</Flex>
				<Flex justify="end" gap="3" mt="5">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
					<Button onClick={apply} disabled={isLoading}>
						{t("autoSegmentDialog.applyAll", "Apply to all lines")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
