import {
	ClockRegular,
	DocumentRegular,
	FolderOpenRegular,
	MusicNote1Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	Heading,
	ScrollArea,
	Separator,
	Text,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useFolderProject } from "$/modules/project/folder-project/useFolderProject";
import {
	workspaceDirAtom,
	workspaceProjectsAtom,
	workspaceScanningAtom,
} from "$/modules/project/folder-project/state";
import { workspaceBrowserDialogAtom } from "$/states/dialogs";

export const WorkspaceBrowserDialog = () => {
	const [isOpen, setIsOpen] = useAtom(workspaceBrowserDialogAtom);
	const [projects] = useAtom(workspaceProjectsAtom);
	const [dir] = useAtom(workspaceDirAtom);
	const [scanning] = useAtom(workspaceScanningAtom);
	const { openWorkspace, openProjectFromDir } = useFolderProject();
	const { t } = useTranslation();

	const handleOpen = useCallback(
		(dir: string) => {
			setIsOpen(false);
			openProjectFromDir(dir);
		},
		[setIsOpen, openProjectFromDir],
	);

	const handleScan = useCallback(() => {
		void openWorkspace();
	}, [openWorkspace]);

	const formatRelativeTime = (timestamp: number) => {
		if (timestamp === 0) return t("workspace.unknown", "Unknown");
		const diff = Date.now() - timestamp;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);
		if (days > 0) return t("time.daysAgo", "{count}d ago", { count: days });
		if (hours > 0) return t("time.hoursAgo", "{count}h ago", { count: hours });
		if (minutes > 0)
			return t("time.minutesAgo", "{count}m ago", { count: minutes });
		return t("time.justNow", "just now");
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content
				style={{
					width: 720,
					maxWidth: "90vw",
					maxHeight: "80vh",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<Heading size="4" mb="3">
					{t("workspace.title", "Workspace Browser")}
				</Heading>

				{dir && (
					<Text size="1" color="gray" mb="2" as="div">
						<Flex align="center" gap="1">
							<FolderOpenRegular fontSize={12} />
							{dir}
						</Flex>
					</Text>
				)}

				<Box flexGrow="1" style={{ minHeight: 0 }}>
					<ScrollArea
						type="auto"
						scrollbars="vertical"
						style={{ maxHeight: "50vh" }}
					>
						<Flex direction="column" gap="2" pr="3">
							{projects.length === 0 ? (
								<Text size="2" color="gray" align="center" my="4" as="div">
									{scanning
										? t("workspace.scanning", "Scanning...")
										: t(
												"workspace.empty",
												"No projects found. Select a workspace folder to scan.",
											)}
								</Text>
							) : (
								projects.map((project) => (
									<Card
										key={project.dir}
										variant="surface"
										onClick={() => handleOpen(project.dir)}
										style={{ cursor: "pointer" }}
									>
										<Flex justify="between" align="center" gap="3">
											<Flex
												direction="column"
												gap="1"
												style={{ overflow: "hidden", flexGrow: 1 }}
											>
												<Flex align="center" gap="2">
													<Text weight="bold" size="2" truncate>
														{project.name}
													</Text>
													{!project.hasManifest && (
														<Badge variant="soft" color="amber">
															{t("workspace.importable", "Importable")}
														</Badge>
													)}
												</Flex>
												<Text size="1" color="gray" truncate>
													{project.dir}
												</Text>
												<Flex gap="2" align="center" mt="1" wrap="wrap">
													<Badge variant="soft">
														<Flex align="center" gap="1">
															<DocumentRegular fontSize={12} />
															{project.lyricFile ||
																t("projectBrowser.noLyric", "No lyrics")}
														</Flex>
													</Badge>
													{Boolean(
														(project.ttmlFile &&
															project.lyricsfileFile &&
															project.ttmlFile !== project.lyricsfileFile) ||
															(project.ttmlFile &&
																project.lyricFile?.endsWith(".yaml")) ||
															(project.lyricsfileFile &&
																project.lyricFile?.endsWith(".ttml")),
													) && (
														<Badge color="indigo" variant="soft" size="1">
															Dual
														</Badge>
													)}
													<Badge variant="soft">
														<Flex align="center" gap="1">
															<MusicNote1Regular fontSize={12} />
															{project.audioFile ||
																t("projectBrowser.noAudio", "No audio")}
														</Flex>
													</Badge>
												</Flex>
												<Flex gap="1" align="center" mt="1">
													<ClockRegular fontSize={12} />
													<Text size="1" color="gray">
														{formatRelativeTime(project.updatedAt)}
													</Text>
												</Flex>
											</Flex>
										</Flex>
									</Card>
								))
							)}
						</Flex>
					</ScrollArea>
				</Box>

				<Separator size="4" my="3" />

				<Flex justify="between" align="center">
					<Text size="1" color="gray">
						{projects.length > 0
							? t(
									"workspace.foundCount",
									"{count} project(s) found",
									{ count: projects.length },
								)
							: ""}
					</Text>
					<Button variant="soft" onClick={handleScan}>
						<FolderOpenRegular />
						{t("workspace.selectFolder", "Select workspace folder...")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
