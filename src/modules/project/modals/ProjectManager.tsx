import {
	DeleteRegular,
	DocumentRegular,
	FolderOpenRegular,
	MusicNote1Regular,
	SaveRegular,
} from "@fluentui/react-icons";
import {
	Badge,
	Button,
	Card,
	Dialog,
	Flex,
	Heading,
	IconButton,
	ScrollArea,
	Separator,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	getRecentProjects,
	removeRecentProject,
	type RecentProjectEntry,
} from "$/modules/project/folder-project/recent-projects";
import { useFolderProject } from "$/modules/project/folder-project/useFolderProject";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
} from "$/modules/project/folder-project/state";
import { projectManagerDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import { loadedAudioAtom } from "$/modules/audio/states";

export const ProjectManagerDialog = () => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(projectManagerDialogAtom);
	const activeDir = useAtomValue(activeProjectDirAtom);
	const manifest = useAtomValue(activeProjectManifestAtom);

	const [projects, setProjects] = useState<RecentProjectEntry[]>([]);
	const [projectName, setProjectName] = useState("");

	const { createProject, openProjectFromDir, saveProject, openProject } = useFolderProject();

	const lyricLines = useAtomValue(lyricLinesAtom);
	const loadedAudio = useAtomValue(loadedAudioAtom);

	const loadProjects = useCallback(async () => {
		setProjects(await getRecentProjects());
	}, []);

	useEffect(() => {
		if (isOpen) {
			loadProjects();
			setProjectName(manifest?.name || "");
		}
	}, [isOpen, manifest, loadProjects]);

	const handleOpen = useCallback(
		async (dir: string) => {
			setIsOpen(false);
			await openProjectFromDir(dir);
		},
		[openProjectFromDir, setIsOpen],
	);

	const handleRemove = useCallback(
		async (e: React.MouseEvent, dir: string) => {
			e.stopPropagation();
			await removeRecentProject(dir);
			await loadProjects();
		},
		[loadProjects],
	);

	const handleSave = useCallback(async () => {
		await saveProject();
		setIsOpen(false);
	}, [saveProject, setIsOpen]);

	const handleCreate = useCallback(async () => {
		setIsOpen(false);
		await createProject();
	}, [createProject, setIsOpen]);

	const handleBrowse = useCallback(() => {
		setIsOpen(false);
		openProject();
	}, [openProject, setIsOpen]);

	const hasAudio = loadedAudio instanceof File || (loadedAudio instanceof Blob && loadedAudio.size > 0);
	const hasLyric = lyricLines.lyricLines.length > 0;

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ width: 680, maxWidth: "90vw", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
				<Flex justify="between" align="center" mb="3">
					<Heading size="4">{t("projectManager.title", "Project Manager")}</Heading>
				</Flex>

				{activeDir && (
					<>
						<Flex gap="2" mb="3" align="center">
							<TextField.Root
								value={projectName}
								onChange={(e) => setProjectName(e.target.value)}
								style={{ flexGrow: 1 }}
							/>
							<Badge
								variant="soft"
								style={{
									backgroundColor: "var(--accent-4)",
									color: "var(--accent-11)",
								}}
							>
								v{manifest?.version || 1}
							</Badge>
						</Flex>
						<Flex gap="2" mb="3">
							<Badge
								variant="soft"
								style={{
									backgroundColor: hasAudio ? "var(--accent-4)" : "var(--gray-3)",
									color: hasAudio ? "var(--accent-11)" : "var(--gray-11)",
								}}
							>
								<MusicNote1Regular /> {hasAudio ? (manifest?.audioFile || "Audio loaded") : "No audio"}
							</Badge>
							<Badge variant="soft">
								<DocumentRegular /> {hasLyric ? `${lyricLines.lyricLines.length} lines` : "No lyrics"}
							</Badge>
						</Flex>
						<Flex justify="end" gap="2" mb="3">
							<Button variant="soft" onClick={handleBrowse}>
								<FolderOpenRegular /> {t("projectManager.browse", "Browse...")}
							</Button>
							<Button variant="solid" onClick={handleSave}>
								<SaveRegular /> {t("projectManager.save", "Save")}
							</Button>
						</Flex>
						<Separator my="3" />
					</>
				)}

				<Text size="2" weight="bold" mb="2">{t("projectManager.recent", "Recent projects")}</Text>
				<ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: "40vh" }}>
					<Flex direction="column" gap="2" pr="3">
						{projects.length === 0 ? (
							<Text size="2" color="gray" align="center" my="4">
								{t("projectManager.noRecent", "No recent projects")}
							</Text>
						) : (
							projects.map((p) => (
								<Card
									key={p.dir}
									variant="surface"
									onClick={() => handleOpen(p.dir)}
									style={{ cursor: "pointer" }}
								>
									<Flex justify="between" align="center" gap="3">
										<Flex direction="column" gap="1" style={{ flexGrow: 1 }}>
											<Text weight="bold" truncate>{p.name}</Text>
											<Text size="1" color="gray" truncate>{p.dir}</Text>
											<Flex gap="2" mt="1" wrap="wrap">
												<Badge variant="soft">
													<DocumentRegular fontSize={10} /> {p.lyricFile || t("projectBrowser.noLyric", "No lyrics")}
												</Badge>
												{Boolean(
													(p.ttmlFile &&
														p.lyricsfileFile &&
														p.ttmlFile !== p.lyricsfileFile) ||
														(p.lyricsfileFile &&
															p.lyricFile &&
															p.lyricsfileFile !== p.lyricFile) ||
														(p.ttmlFile &&
															p.lyricFile &&
															p.ttmlFile !== p.lyricFile) ||
														(p.ttmlFile &&
															(p.lyricFile?.endsWith(".yaml") ||
																p.lyricFile?.endsWith(".yml"))) ||
														(p.lyricsfileFile &&
															p.lyricFile?.endsWith(".ttml")),
												) && (
													<Badge color="indigo" variant="soft" size="1">
														Dual
													</Badge>
												)}
												<Badge variant="soft">
													<MusicNote1Regular fontSize={10} /> {p.audioFile || t("projectBrowser.noAudio", "No audio")}
												</Badge>
											</Flex>
										</Flex>
										<IconButton size="1" variant="ghost" color="gray" onClick={(e) => handleRemove(e, p.dir)}>
											<DeleteRegular />
										</IconButton>
									</Flex>
								</Card>
							))
						)}
					</Flex>
				</ScrollArea>

				<Separator my="3" />

				<Flex justify="between">
					<Button variant="soft" onClick={handleCreate}>
						{t("projectManager.createNew", "New Project")}
					</Button>
					{!activeDir && (
						<Button variant="soft" onClick={handleBrowse}>
							<FolderOpenRegular /> {t("projectManager.openFolder", "Open Folder")}
						</Button>
					)}
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
