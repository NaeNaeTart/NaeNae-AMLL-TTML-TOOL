import {
	Badge,
	Button,
	Card,
	Dialog,
	Flex,
	ScrollArea,
	Select,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";
import {
	LYRIC_SECTION_CATEGORIES,
	type LyricSection,
	type LyricSectionCategory,
} from "$/types/ttml";
import {
	createSectionFromHeader,
	getSectionHeader,
} from "$/modules/lyric-editor/utils/section-system";

export interface ReviewedSection extends LyricSection {
	occurrence: number;
	lineCount: number;
}

const detectSections = (text: string): ReviewedSection[] => {
	const result: ReviewedSection[] = [];
	let current: ReviewedSection | undefined;
	let occurrence = 0;
	for (const rawLine of text.split(/\r?\n/)) {
		const header = getSectionHeader(rawLine);
		if (header) {
			const section = createSectionFromHeader(header);
			if (section) {
				current = { ...section, occurrence: occurrence++, lineCount: 0 };
				result.push(current);
			}
		} else if (rawLine.trim() && current) {
			current.lineCount++;
		}
	}
	return result;
};

export const hasReviewableSections = (text: string) =>
	text.split(/\r?\n/).some((line) => !!getSectionHeader(line));

export function SectionImportReviewDialog({
	open,
	sourceText,
	onSourceTextChange,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	sourceText: string;
	onSourceTextChange: (value: string) => void;
	onCancel: () => void;
	onConfirm: (sections: ReviewedSection[]) => void;
}) {
	const detected = useMemo(() => detectSections(sourceText), [sourceText]);
	const [sections, setSections] = useState<ReviewedSection[]>(detected);

	useEffect(() => {
		if (!open) return;
		setSections((current) =>
			detected.map((next) => {
				const previous =
					current.find(
						(section) =>
							section.occurrence === next.occurrence &&
							section.label === next.label,
					) ?? current.find((section) => section.label === next.label);
				return previous
					? {
							...next,
							category: previous.category,
							ordinal: previous.ordinal,
							color: previous.color,
							notes: previous.notes,
							vocalist: previous.vocalist,
							confidence: previous.confidence,
							repeatGroupId: previous.repeatGroupId,
						}
					: next;
			}),
		);
	}, [open, detected]);

	const updateSection = (
		occurrence: number,
		patch: Partial<ReviewedSection>,
	) => {
		setSections((current) =>
			current.map((section) =>
				section.occurrence === occurrence
					? { ...section, ...patch }
					: section,
			),
		);
	};

	return (
		<Dialog.Root open={open}>
			<Dialog.Content maxWidth="1000px">
				<Dialog.Title>Review detected sections</Dialog.Title>
				<Dialog.Description>
					Check normalized categories and metadata before replacing the lyrics.
				</Dialog.Description>
				<Flex gap="4" mt="4" style={{ height: "60vh" }}>
					<Flex direction="column" gap="2" style={{ flex: 1 }}>
						<Text size="2" weight="bold">
							Source lyrics
						</Text>
						<TextArea
							value={sourceText}
							onChange={(event) => onSourceTextChange(event.target.value)}
							style={{ flex: 1, resize: "none" }}
						/>
					</Flex>
					<Flex direction="column" gap="2" style={{ flex: 1 }}>
						<Flex justify="between">
							<Text size="2" weight="bold">
								Structure
							</Text>
							<Badge color="indigo">{sections.length} sections</Badge>
						</Flex>
						<ScrollArea style={{ flex: 1 }}>
							<Flex direction="column" gap="2" pr="3">
								{sections.map((section) => (
									<Card key={section.id}>
										<Flex direction="column" gap="2">
											<Flex gap="2" align="center">
												<TextField.Root
													value={section.label}
													onChange={(event) =>
														updateSection(section.occurrence, {
															label: event.target.value,
														})
													}
													style={{ flex: 1 }}
												/>
												<Select.Root
													value={section.category}
													onValueChange={(category) =>
														updateSection(section.occurrence, {
															category: category as LyricSectionCategory,
															confidence: 1,
														})
													}
												>
													<Select.Trigger />
													<Select.Content>
														{LYRIC_SECTION_CATEGORIES.map((category) => (
															<Select.Item key={category} value={category}>
																{category}
															</Select.Item>
														))}
													</Select.Content>
												</Select.Root>
											</Flex>
											<Flex gap="2">
												<TextField.Root
													placeholder="Vocalist / role"
													value={section.vocalist ?? ""}
													onChange={(event) =>
														updateSection(section.occurrence, {
															vocalist: event.target.value || undefined,
														})
													}
													style={{ flex: 1 }}
												/>
												<input
													type="color"
													title="Section color"
													value={section.color ?? "#808080"}
													onChange={(event) =>
														updateSection(section.occurrence, {
															color: event.target.value,
														})
													}
													style={{ width: "48px", border: 0, background: "none" }}
												/>
											</Flex>
											<TextField.Root
												placeholder="Notes"
												value={section.notes ?? ""}
												onChange={(event) =>
													updateSection(section.occurrence, {
														notes: event.target.value || undefined,
													})
												}
											/>
											<Flex gap="2">
												<Badge
													color={
														(section.confidence ?? 1) < 0.6
															? "orange"
															: "green"
													}
												>
													{Math.round((section.confidence ?? 1) * 100)}%
												</Badge>
												<Text size="1" color="gray">
													{section.lineCount} lyric lines
												</Text>
											</Flex>
										</Flex>
									</Card>
								))}
							</Flex>
						</ScrollArea>
					</Flex>
				</Flex>
				<Flex justify="end" gap="3" mt="4">
					<Button variant="soft" color="gray" onClick={onCancel}>
						Back
					</Button>
					<Button
						disabled={sections.length === 0}
						onClick={() => onConfirm(sections)}
					>
						Import reviewed lyrics
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
