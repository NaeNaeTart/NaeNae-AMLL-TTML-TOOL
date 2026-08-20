import {
	ClockRegular,
	DeleteRegular,
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
	IconButton,
	ScrollArea,
	Text,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	getRecentProjects,
	type RecentProjectEntry,
	removeRecentProject,
} from "$/modules/project/folder-project/recent-projects";
import { useFolderProject } from "$/modules/project/folder-project/useFolderProject";
import { projectBrowserDialogAtom } from "$/states/dialogs";

export const ProjectBrowserDialog = () => {
	const [isOpen, setIsOpen] = useAtom(projectBrowserDialogAtom);
	const [projects, setProjects] = useState<RecentProjectEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const { openProjectFromDir, openProject, createProject } =
		useFolderProject();
	const { t } = useTranslation();

	const loadProjects = useCallback(async () => {
		setLoading(true);
		try {
			const list = await getRecentProjects();
			setProjects(list);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (isOpen) loadProjects();
	}, [isOpen, loadProjects]);

	const handleOpen = useCallback(
		(dir: string) => {
			setIsOpen(false);
			openProjectFromDir(dir);
		},
		[setIsOpen, openProjectFromDir],
	);

	const handleRemove = useCallback(
		async (e: React.MouseEvent, dir: string) => {
			e.stopPropagation();
			await removeRecentProject(dir);
			await loadProjects();
		},
		[loadProjects],
	);

	const handleBrowse = useCallback(() => {
		setIsOpen(false);
		openProject();
	}, [setIsOpen, openProject]);

	const handleCreate = useCallback(() => {
		setIsOpen(false);
		createProject();
	}, [setIsOpen, createProject]);

	const formatRelativeTime = (timestamp: number) => {
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
					width: 640,
					maxWidth: "90vw",
					maxHeight: "80vh",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<Heading size="4" mb="3">
					{t("projectBrowser.title", "Open project")}
				</Heading>

				<Box flexGrow="1" style={{ minHeight: 0 }}>
					<ScrollArea
						type="auto"
						scrollbars="vertical"
						style={{ maxHeight: "50vh" }}
					>
						<Flex direction="column" gap="2" pr="3">
							{projects.length === 0 ? (
								<Text size="2" color="gray" align="center" my="4" as="div">
									{loading
										? t("projectBrowser.loading", "Loading...")
										: t(
												"projectBrowser.empty",
												"No recent projects yet. Create one or browse for a folder below.",
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
												<Text weight="bold" size="2" truncate>
													{project.name}
												</Text>
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
											<IconButton
												size="1"
												variant="ghost"
												color="gray"
												onClick={(e) => handleRemove(e, project.dir)}
											>
												<DeleteRegular />
											</IconButton>
										</Flex>
									</Card>
								))
							)}
						</Flex>
					</ScrollArea>
				</Box>

				<Flex justify="between" mt="4">
					<Button variant="soft" onClick={handleCreate}>
						{t("projectBrowser.createNew", "New project...")}
					</Button>
					<Button variant="soft" onClick={handleBrowse}>
						<FolderOpenRegular />
						{t("projectBrowser.browse", "Browse folder...")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
