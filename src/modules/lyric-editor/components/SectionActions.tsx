import {
	Badge,
	Button,
	ContextMenu,
	Dialog,
	Flex,
	IconButton,
	Select,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useMemo, useState } from "react";
import { uid } from "uid";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
} from "$/states/main";
import {
	LYRIC_SECTION_CATEGORIES,
	type LyricSection,
	type LyricSectionCategory,
} from "$/types/ttml";
import {
	getOrderedSections,
	getSectionBoundsById,
	createSectionsFromSelectedLines,
	mergeSectionWithAdjacent,
	moveSection,
	removeSectionMetadata,
	splitSection,
	validateSections,
} from "../utils/section-system";

const editingSectionIdAtom = atom<string | null>(null);
const categorizingSelectionAtom = atom(false);

export function CategorizeSelectionContextMenuItem() {
	const lyrics = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const setCategorizingSelection = useSetAtom(categorizingSelectionAtom);
	const selectedCount = selectedLines.size;
	const hasAssignedLine = lyrics.lyricLines.some(
		(line) => selectedLines.has(line.id) && line.sectionId,
	);

	return (
		<ContextMenu.Item
			disabled={selectedCount === 0 || hasAssignedLine}
			onSelect={() => setCategorizingSelection(true)}
		>
			Categorize selected line{selectedCount === 1 ? "" : "s"}…
		</ContextMenu.Item>
	);
}

export function CategorizeSelectionDialog() {
	const selectedLines = useAtomValue(selectedLinesAtom);
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const [open, setOpen] = useAtom(categorizingSelectionAtom);
	const [category, setCategory] = useState<LyricSectionCategory>("verse");

	const save = () => {
		editLyrics((draft) => {
			createSectionsFromSelectedLines(draft, selectedLines, category);
		});
		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="400px">
				<Dialog.Title>Categorize selected lines</Dialog.Title>
				<Flex direction="column" gap="3">
					<Select.Root value={category} onValueChange={(value) => setCategory(value as LyricSectionCategory)}>
						<Select.Trigger />
						<Select.Content>
							{LYRIC_SECTION_CATEGORIES.map((item) => (
								<Select.Item key={item} value={item}>
									{item}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
					<Flex justify="end" gap="2">
						<Button variant="soft" color="gray" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button onClick={save} disabled={selectedLines.size === 0}>
							Categorize
						</Button>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}

export function SectionActions({ section }: { section: LyricSection }) {
	const lyrics = useAtomValue(lyricLinesAtom);
	const [collapsed, setCollapsed] = useAtom(collapsedSectionIdsAtom);
	const selectedLineIds = useAtomValue(selectedLinesAtom);
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const issues = useMemo(
		() =>
			validateSections(lyrics).filter(
				(issue) => issue.sectionId === section.id,
			),
		[lyrics, section.id],
	);

	const toggleCollapsed = (event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		if (!collapsed.has(section.id)) {
			const bounds = getSectionBoundsById(lyrics.lyricLines, section.id);
			const firstLine = bounds ? lyrics.lyricLines[bounds.start] : undefined;
			const hasSelectedSectionLine = bounds
				? lyrics.lyricLines
						.slice(bounds.start, bounds.end)
						.some((line) => selectedLineIds.has(line.id))
				: false;
			if (firstLine && hasSelectedSectionLine) {
				setSelectedLines(new Set([firstLine.id]));
			}
		}
		setCollapsed((current) => {
			const next = new Set(current);
			if (next.has(section.id)) next.delete(section.id);
			else next.add(section.id);
			return next;
		});
	};

	return (
		<>
			{issues.length > 0 && (
				<Badge
					color="orange"
					title={issues.map((issue) => issue.message).join("\n")}
				>
					{issues.length}
				</Badge>
			)}
			<IconButton
				size="1"
				variant="ghost"
				color="gray"
				onClick={toggleCollapsed}
				title={
					collapsed.has(section.id) ? "Expand section" : "Collapse section"
				}
			>
				{collapsed.has(section.id) ? "▸" : "▾"}
			</IconButton>
		</>
	);
}

export function SectionMetadataDialog() {
	const lyrics = useAtomValue(lyricLinesAtom);
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const [editingSectionId, setEditingSectionId] = useAtom(editingSectionIdAtom);
	const source = lyrics.sections?.find(
		(section) => section.id === editingSectionId,
	);
	const [editing, setEditing] = useState<LyricSection | null>(null);

	useEffect(() => {
		setEditing(source ? { ...source } : null);
	}, [source]);

	const closeEditor = () => {
		setEditing(null);
		setEditingSectionId(null);
	};

	return (
		<Dialog.Root
			open={!!editingSectionId}
			onOpenChange={(open) => !open && closeEditor()}
		>
			<Dialog.Content maxWidth="500px">
				<Dialog.Title>Edit section</Dialog.Title>
				{editing && (
					<Flex direction="column" gap="3">
						<TextField.Root
							value={editing.label}
							onChange={(event) =>
								setEditing({ ...editing, label: event.target.value })
							}
						/>
						<Select.Root
							value={editing.category}
							onValueChange={(category) =>
								setEditing({
									...editing,
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
						<TextField.Root
							placeholder="Vocalist / role"
							value={editing.vocalist ?? ""}
							onChange={(event) =>
								setEditing({
									...editing,
									vocalist: event.target.value || undefined,
								})
							}
						/>
						<input
							type="color"
							value={editing.color ?? "#808080"}
							onChange={(event) =>
								setEditing({ ...editing, color: event.target.value })
							}
							style={{ width: "100%", height: 32 }}
						/>
						<TextArea
							placeholder="Notes"
							value={editing.notes ?? ""}
							onChange={(event) =>
								setEditing({
									...editing,
									notes: event.target.value || undefined,
								})
							}
						/>
						<Flex justify="end" gap="2">
							<Button variant="soft" color="gray" onClick={closeEditor}>
								Cancel
							</Button>
							<Button
								onClick={() => {
									editLyrics((draft) => {
										const target = draft.sections?.find(
											(item) => item.id === editing.id,
										);
										if (!target) return;
										Object.assign(target, editing);
										for (const line of draft.lyricLines) {
											if (line.sectionId === target.id) {
												line.geniusHeader = target.label;
											}
										}
									});
									closeEditor();
								}}
							>
								Save
							</Button>
						</Flex>
					</Flex>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
}

export function SectionContextMenuItems({
	section,
}: {
	section: LyricSection;
}) {
	const lyrics = useAtomValue(lyricLinesAtom);
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const setEditingSectionId = useSetAtom(editingSectionIdAtom);
	const orderedSections = getOrderedSections(lyrics);
	const sectionIndex = orderedSections.findIndex(
		(item) => item.id === section.id,
	);
	const bounds = getSectionBoundsById(lyrics.lyricLines, section.id);
	const previousId =
		bounds && bounds.start > 0
			? lyrics.lyricLines[bounds.start - 1]?.sectionId
			: undefined;
	const nextId =
		bounds && bounds.end < lyrics.lyricLines.length
			? lyrics.lyricLines[bounds.end]?.sectionId
			: undefined;
	const hasPreviousMatch = orderedSections
		.slice(0, Math.max(0, sectionIndex))
		.some((item) => item.category === section.category);

	const navigateToSection = (target: LyricSection | undefined) => {
		if (!target) return;
		const targetBounds = getSectionBoundsById(lyrics.lyricLines, target.id);
		const targetLine = targetBounds
			? lyrics.lyricLines[targetBounds.start]
			: undefined;
		if (targetLine) setSelectedLines(new Set([targetLine.id]));
	};

	const linkToPrevious = () => {
		const previous = orderedSections
			.slice(0, Math.max(0, sectionIndex))
			.reverse()
			.find((item) => item.category === section.category);
		if (!previous) return;
		editLyrics((draft) => {
			const currentDraft = draft.sections?.find(
				(item) => item.id === section.id,
			);
			const previousDraft = draft.sections?.find(
				(item) => item.id === previous.id,
			);
			if (!currentDraft || !previousDraft) return;
			const groupId = previousDraft.repeatGroupId ?? uid();
			previousDraft.repeatGroupId = groupId;
			currentDraft.repeatGroupId = groupId;
		});
	};

	return (
		<>
			<ContextMenu.Item
				disabled={sectionIndex <= 0}
				onSelect={() => navigateToSection(orderedSections[sectionIndex - 1])}
			>
				Go to previous section
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={
					sectionIndex < 0 || sectionIndex >= orderedSections.length - 1
				}
				onSelect={() => navigateToSection(orderedSections[sectionIndex + 1])}
			>
				Go to next section
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item onSelect={() => setEditingSectionId(section.id)}>
				Edit metadata
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!bounds || bounds.end - bounds.start < 2}
				onSelect={() =>
					editLyrics((draft) => {
						const sectionLines = draft.lyricLines.filter(
							(line) => line.sectionId === section.id,
						);
						const selectedId =
							sectionLines.find((line) => selectedLines.has(line.id))?.id ??
							sectionLines[1]?.id;
						const lineIndex = draft.lyricLines.findIndex(
							(line) => line.id === selectedId,
						);
						if (lineIndex !== -1) {
							splitSection(draft, section.id, lineIndex);
						}
					})
				}
			>
				Split at selected line
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!previousId || previousId === section.id}
				onSelect={() =>
					editLyrics((draft) => {
						mergeSectionWithAdjacent(draft, section.id, "previous");
					})
				}
			>
				Merge with previous
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!nextId || nextId === section.id}
				onSelect={() =>
					editLyrics((draft) => {
						mergeSectionWithAdjacent(draft, section.id, "next");
					})
				}
			>
				Merge with next
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!previousId || previousId === section.id}
				onSelect={() =>
					editLyrics((draft) => {
						moveSection(draft, section.id, "up");
					})
				}
			>
				Move up
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!nextId || nextId === section.id}
				onSelect={() =>
					editLyrics((draft) => {
						moveSection(draft, section.id, "down");
					})
				}
			>
				Move down
			</ContextMenu.Item>
			<ContextMenu.Item disabled={!hasPreviousMatch} onSelect={linkToPrevious}>
				Link to previous {section.category}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!section.repeatGroupId}
				onSelect={() =>
					editLyrics((draft) => {
						const target = draft.sections?.find(
							(item) => item.id === section.id,
						);
						if (target) delete target.repeatGroupId;
					})
				}
			>
				Unlink repeat
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item
				color="red"
				onSelect={() =>
					editLyrics((draft) => {
						removeSectionMetadata(draft, section.id);
					})
				}
			>
				Remove header (keep lyrics)
			</ContextMenu.Item>
		</>
	);
}

export function SectionContextMenuSub({ section }: { section: LyricSection }) {
	return (
		<ContextMenu.Sub>
			<ContextMenu.SubTrigger>Section</ContextMenu.SubTrigger>
			<ContextMenu.SubContent sideOffset={12}>
				<SectionContextMenuItems section={section} />
			</ContextMenu.SubContent>
		</ContextMenu.Sub>
	);
}
