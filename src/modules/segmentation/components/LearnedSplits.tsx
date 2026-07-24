import { DeleteRegular, EditRegular } from "@fluentui/react-icons";
import {
	AlertDialog,
	Box,
	Button,
	Dialog,
	Flex,
	IconButton,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { segmentationLearnedRulesAtom } from "$/modules/segmentation/states";
import { createLearnedRule } from "$/modules/segmentation/utils/learned-rules";
import { learnedSplitsDialogAtom } from "$/states/dialogs";
import { ManualWordSplitter } from "./ManualWordSplitter";
import styles from "./AdvancedSegmentation.module.css";

function getSegments(word: string, boundaries: number[]): string[] {
	const chars = Array.from(word);
	const segments: string[] = [];
	let start = 0;
	for (const end of boundaries) {
		segments.push(chars.slice(start, end).join(""));
		start = end;
	}
	segments.push(chars.slice(start).join(""));
	return segments;
}

export const LearnedSplitsDialog = memo(() => {
	const [open, setOpen] = useAtom(learnedSplitsDialogAtom);
	const [learnedRules, setLearnedRules] = useAtom(segmentationLearnedRulesAtom);
	const [word, setWord] = useState("");
	const [splitIndices, setSplitIndices] = useState(new Set<number>());
	const [search, setSearch] = useState("");
	const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
	const { t } = useTranslation();

	const toggleSplitPoint = useCallback((index: number) => {
		setSplitIndices((previous) => {
			const next = new Set(previous);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	}, []);

	const saveRule = useCallback(() => {
		const rule = createLearnedRule(word, splitIndices);
		if (!rule) return;
		const next = new Map(learnedRules);
		next.set(rule.key, rule.boundaries);
		setLearnedRules(next);
		setWord("");
		setSplitIndices(new Set());
	}, [learnedRules, setLearnedRules, splitIndices, word]);

	const allRules = useMemo(
		() => Array.from(learnedRules.entries()).sort(([a], [b]) => a.localeCompare(b)),
		[learnedRules],
	);
	const rules = useMemo(() => {
		const query = Array.from(search.normalize("NFC").toLowerCase());
		if (!query) return allRules;

		return allRules.filter(([ruleWord]) => {
			let queryIndex = 0;
			for (const char of ruleWord.normalize("NFC").toLowerCase()) {
				if (char === query[queryIndex]) queryIndex++;
				if (queryIndex === query.length) return true;
			}
			return false;
		});
	}, [allRules, search]);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="700px">
				<Dialog.Title>
					{t("advancedSegmentDialog.learned.title", "Learned Split Rules")}
				</Dialog.Title>
				<Text size="2" color="gray">
					{t(
						"advancedSegmentDialog.learned.description",
						"These rules match any casing and ignore surrounding punctuation.",
					)}
				</Text>

				<Flex direction="column" gap="3" mt="4">
					<TextField.Root
						placeholder={t(
							"advancedSegmentDialog.learned.input",
							"Enter a word to teach the splitter...",
						)}
						value={word}
						onChange={(event) => {
							setWord(event.target.value);
							setSplitIndices(new Set());
						}}
					/>
					<ManualWordSplitter
						word={word}
						splitIndices={splitIndices}
						onSplitIndexToggle={toggleSplitPoint}
					/>
					<Flex justify="between" align="center">
						<Text size="2" color="gray">
							{t(
								"advancedSegmentDialog.learned.saveHint",
								"Saving replaces the existing rule for this word.",
							)}
						</Text>
						<Button onClick={saveRule} disabled={!word}>
							{t("advancedSegmentDialog.learned.save", "Save learned split")}
						</Button>
					</Flex>

					<Flex justify="between" align="center" mt="2">
						<Text weight="medium">
							{t("advancedSegmentDialog.learned.saved", "Saved rules ({count})", {
								count: allRules.length,
							})}
						</Text>
						{allRules.length > 0 && (
							<Button
								size="1"
								variant="soft"
								color="red"
								onClick={() => setClearConfirmationOpen(true)}
							>
								{t("advancedSegmentDialog.learned.clear", "Clear all")}
							</Button>
						)}
					</Flex>
					{allRules.length > 0 && (
						<TextField.Root
							placeholder={t(
								"advancedSegmentDialog.learned.search",
								"Search saved rules...",
							)}
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
					)}

					{rules.length > 0 && (
						<Box className={styles.ruleList}>
							{rules.map(([ruleWord, boundaries]) => (
								<Flex key={ruleWord} justify="between" align="center" mb="2">
									<Flex align="center" gap="2" wrap="wrap">
										<span className={styles.previewWord}>{ruleWord}</span>
										<Text color="gray" as="span">
											→
										</Text>
										{getSegments(ruleWord, boundaries).map((part, index) => (
											<span
												className={styles.previewWord}
												// biome-ignore lint/suspicious/noArrayIndexKey: split boundary order is stable
												key={`${ruleWord}-${index}`}
											>
												{part}
											</span>
										))}
									</Flex>
									<Flex gap="1">
										<IconButton
											size="1"
											variant="ghost"
											color="gray"
											onClick={() => {
												setWord(ruleWord);
												setSplitIndices(new Set(boundaries));
											}}
										>
											<EditRegular />
										</IconButton>
										<IconButton
											size="1"
											variant="ghost"
											color="gray"
											onClick={() => {
												const next = new Map(learnedRules);
												next.delete(ruleWord);
												setLearnedRules(next);
											}}
										>
											<DeleteRegular />
										</IconButton>
									</Flex>
								</Flex>
							))}
						</Box>
					)}
					{allRules.length > 0 && rules.length === 0 && (
						<Text size="2" color="gray" align="center">
							{t("advancedSegmentDialog.learned.noResults", "No matching learned splits.")}
						</Text>
					)}
				</Flex>

				<AlertDialog.Root
					open={clearConfirmationOpen}
					onOpenChange={setClearConfirmationOpen}
				>
					<AlertDialog.Content maxWidth="420px">
						<AlertDialog.Title>
							{t("advancedSegmentDialog.learned.clearTitle", "Clear all learned splits?")}
						</AlertDialog.Title>
						<AlertDialog.Description size="2">
							{t(
								"advancedSegmentDialog.learned.clearDescription",
								"This permanently removes every learned split rule from this device.",
							)}
						</AlertDialog.Description>
						<Flex gap="3" mt="4" justify="end">
							<AlertDialog.Cancel>
								<Button variant="soft" color="gray">
									{t("common.cancel", "Cancel")}
								</Button>
							</AlertDialog.Cancel>
							<AlertDialog.Action>
								<Button
									color="red"
									onClick={() => setLearnedRules(new Map())}
								>
									{t("advancedSegmentDialog.learned.clear", "Clear all")}
								</Button>
							</AlertDialog.Action>
						</Flex>
					</AlertDialog.Content>
				</AlertDialog.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
});
