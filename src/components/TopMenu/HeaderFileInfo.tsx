import { HistoryRegular } from "@fluentui/react-icons";
import { Box, Button, Flex, Text, TextField } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import { confirmDialogAtom, historyRestoreDialogAtom } from "$/states/dialogs";
import {
	ActiveFileKind,
	activeFileKindAtom,
	FILE_KIND_EXTENSIONS,
	isDirtyAtom,
	lastSavedTimeAtom,
	lyricLinesAtom,
	saveFileNameAtom,
	stripKnownFileExtension,
} from "$/states/main";

export const HeaderFileInfo = () => {
	const { t } = useTranslation();
	const [filename, setFilename] = useAtom(saveFileNameAtom);
	const lastSavedTime = useAtomValue(lastSavedTimeAtom);
	const setHistoryDialogOpen = useSetAtom(historyRestoreDialogAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const metadata = useAtomValue(lyricLinesAtom).metadata;
	const [isEditing, setIsEditing] = useState(false);
	const [draftName, setDraftName] = useState("");
	const [autoSaveExpanded, setAutoSaveExpanded] = useState(false);
	const [autoSaveTimeLabel, setAutoSaveTimeLabel] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const lastSavedTimeRef = useRef<number | null>(null);
	const activeFileKind = useAtomValue(activeFileKindAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const suffix = FILE_KIND_EXTENSIONS[activeFileKind];
	const suggestedFile = getSuggestedTtmlFileName(metadata);

	const getBaseName = useCallback(
		(value: string) => stripKnownFileExtension(value),
		[],
	);

	const finishEditing = useCallback(
		({ commit }: { commit: boolean }) => {
			if (commit) {
				const trimmed = draftName.trim();
				if (trimmed.length > 0) {
					setFilename(`${trimmed}${suffix}`);
				} else {
					setDraftName(getBaseName(filename));
				}
			}
			setIsEditing(false);
		},
		[draftName, filename, getBaseName, setFilename, suffix],
	);

	useEffect(() => {
		if (!isEditing) return;
		setDraftName(getBaseName(filename));
		inputRef.current?.focus();
		inputRef.current?.select();
	}, [filename, getBaseName, isEditing]);

	useEffect(() => {
		if (!lastSavedTime) return;
		if (lastSavedTimeRef.current === lastSavedTime) return;
		lastSavedTimeRef.current = lastSavedTime;
		setAutoSaveTimeLabel(new Date(lastSavedTime).toLocaleTimeString());
		setAutoSaveExpanded(true);
		const timer = window.setTimeout(() => {
			setAutoSaveExpanded(false);
		}, 4000);
		return () => window.clearTimeout(timer);
	}, [lastSavedTime]);

	const handleNameClick = useCallback(() => {
		const isDefaultName =
			activeFileKind === ActiveFileKind.TTML &&
			filename.toLowerCase() === "lyric.ttml";
		if (isDefaultName && suggestedFile) {
			setConfirmDialog({
				open: true,
				title: t("confirmDialog.useMetadataName.title", "Name from metadata?"),
				description: t(
					"confirmDialog.useMetadataName.description",
					'Use "{name}" as file name?',
					{ name: suggestedFile.baseName },
				),
				onConfirm: () => {
					setFilename(suggestedFile.fileName);
				},
			});
			return;
		}
		setIsEditing(true);
	}, [activeFileKind, filename, setConfirmDialog, setFilename, suggestedFile, t]);

	return (
		<Flex align="center" gap="2" style={{ maxWidth: "100%" }}>
			<Button
				variant="soft"
				onClick={() => setHistoryDialogOpen(true)}
				style={{
					justifyContent: "start",
					overflow: "hidden",
					whiteSpace: "nowrap",
					maxWidth: autoSaveExpanded ? 220 : 36,
					transition: "max-width 0.3s ease",
				}}
			>
				<Flex align="center" gap="1">
					<Text size="1" style={{ display: "flex" }}>
						<HistoryRegular />
					</Text>
					{autoSaveExpanded && (
						<Text size="1" color="gray">
							{t("header.status.autoSavedAt", "Autosaved at {time}", {
								time: autoSaveTimeLabel,
							})}
						</Text>
					)}
				</Flex>
			</Button>

			<Box>
				{isEditing ? (
					<Flex align="center" gap="1">
						<TextField.Root
							ref={inputRef}
							size="1"
							value={draftName}
							onChange={(e) => setDraftName(e.target.value)}
							placeholder="example"
							style={{ width: "10rem" }}
							onBlur={() => finishEditing({ commit: true })}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									finishEditing({ commit: true });
								}
								if (event.key === "Escape") {
									finishEditing({ commit: false });
								}
							}}
						/>
						<Text size="2">{suffix}</Text>
					</Flex>
				) : (
					<Button
						variant="ghost"
						style={{
							height: "auto",
							padding: "6px 10px",
							fontWeight: "normal",
							color: "var(--accent-11)",
							maxWidth: "100%",
						}}
						onClick={handleNameClick}
					>
						<Flex align="center" gap="2" style={{ maxWidth: "100%" }}>
							<Flex
								align="center"
								style={{
									maxWidth: "10rem",
									overflow: "hidden",
									whiteSpace: "nowrap",
								}}
							>
								<Text
									weight="bold"
									size="2"
									style={{
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{getBaseName(filename)}
								</Text>
								<Text size="2">{suffix}</Text>
								{isDirty && (
									<Box
										style={{
											width: 6,
											height: 6,
											borderRadius: "50%",
											backgroundColor: "var(--accent-11)",
											marginLeft: 6,
											flexShrink: 0,
										}}
									/>
								)}
							</Flex>
						</Flex>
					</Button>
				)}
			</Box>
		</Flex>
	);
};
