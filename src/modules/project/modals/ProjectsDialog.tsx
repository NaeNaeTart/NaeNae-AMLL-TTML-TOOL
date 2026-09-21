import {
	ClockRegular,
	DeleteRegular,
	DocumentRegular,
	FolderOpenRegular,
	MusicNote1Regular,
	SaveRegular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	IconButton,
	ScrollArea,
	Tabs,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	getRecentProjectFileStatus,
	getRecentProjects,
	type RecentProjectEntry,
	type RecentProjectFileStatus,
	removeRecentProject,
} from "$/modules/project/folder-project/recent-projects";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
	projectAudioFileAtom,
	workspaceDirAtom,
	workspaceProjectsAtom,
	workspaceScanningAtom,
} from "$/modules/project/folder-project/state";
import { useFolderProject } from "$/modules/project/folder-project/useFolderProject";
import { projectsDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import styles from "./ProjectsDialog.module.css";

type Tab = "project" | "recent" | "workspace";

export const ProjectsDialog = () => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(projectsDialogAtom);
	const [activeTab, setActiveTab] = useState<Tab>("project");

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
				<Dialog.Title>{t("projectsDialog.title", "Projects")}</Dialog.Title>

				<Tabs.Root
					value={activeTab}
					onValueChange={(v) => setActiveTab(v as Tab)}
				>
					<Tabs.List style={{ marginBottom: 16 }}>
						<Tabs.Trigger value="project" className={styles.tabTrigger}>
							{t("projectsDialog.tabProject", "Project")}
						</Tabs.Trigger>
						<Tabs.Trigger value="recent" className={styles.tabTrigger}>
							{t("projectsDialog.tabRecent", "Recent")}
						</Tabs.Trigger>
						<Tabs.Trigger value="workspace" className={styles.tabTrigger}>
							{t("projectsDialog.tabWorkspace", "Workspace")}
						</Tabs.Trigger>
					</Tabs.List>

					<Box style={{ flexGrow: 1, overflow: "hidden", minHeight: 420 }}>
						<Tabs.Content value="project" className={styles.tabContent}>
							<ProjectTab onClose={() => setIsOpen(false)} />
						</Tabs.Content>
						<Tabs.Content value="recent" className={styles.tabContent}>
							<RecentTab onClose={() => setIsOpen(false)} />
						</Tabs.Content>
						<Tabs.Content value="workspace" className={styles.tabContent}>
							<WorkspaceTab onClose={() => setIsOpen(false)} />
						</Tabs.Content>
					</Box>
				</Tabs.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
};

const ProjectTab = ({ onClose }: { onClose: () => void }) => {
	const { t } = useTranslation();
	const activeDir = useAtomValue(activeProjectDirAtom);
	const manifest = useAtomValue(activeProjectManifestAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const projectAudioFile = useAtomValue(projectAudioFileAtom);
	const { createProject, saveProject, renameProject, openProject } =
		useFolderProject();
	const [projectName, setProjectName] = useState("");

	useEffect(() => {
		setProjectName(manifest?.name || "");
	}, [manifest]);

	const hasAudio = projectAudioFile !== null || Boolean(manifest?.audioFile);
	const hasLyric = lyricLines.lyricLines.length > 0;

	const handleSave = useCallback(async () => {
		const trimmed = projectName.trim();
		if (trimmed && trimmed !== manifest?.name) {
			await renameProject(trimmed);
		}
		await saveProject();
		onClose();
	}, [saveProject, renameProject, projectName, manifest, onClose]);

	const handleBrowse = useCallback(() => {
		onClose();
		openProject();
	}, [openProject, onClose]);

	const handleCreate = useCallback(async () => {
		onClose();
		await createProject();
	}, [createProject, onClose]);

	if (!activeDir) {
		return (
			<Flex
				direction="column"
				align="center"
				justify="center"
				gap="3"
				style={{ minHeight: 200 }}
			>
				<Text color="gray">
					{t("projectsDialog.noProject", "No project is currently open")}
				</Text>
				<Flex gap="2">
					<Button variant="soft" onClick={handleCreate}>
						{t("projectsDialog.createNew", "New Project")}
					</Button>
					<Button variant="soft" onClick={handleBrowse}>
						<FolderOpenRegular />{" "}
						{t("projectsDialog.openFolder", "Open Folder")}
					</Button>
				</Flex>
			</Flex>
		);
	}

	return (
		<Flex direction="column" gap="3">
			<Flex gap="2" align="center">
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
			<Flex gap="2" wrap="wrap">
				<Badge
					variant="soft"
					style={{
						backgroundColor: hasAudio ? "var(--accent-4)" : "var(--gray-3)",
						color: hasAudio ? "var(--accent-11)" : "var(--gray-11)",
					}}
				>
					<MusicNote1Regular />{" "}
					{hasAudio
						? manifest?.audioFile || "Audio loaded"
						: t("projectBrowser.noAudio", "No audio")}
				</Badge>
				<Badge variant="soft" color="gray">
					<DocumentRegular />{" "}
					{hasLyric
						? `${lyricLines.lyricLines.length} lines`
						: t("projectBrowser.noLyric", "No lyrics")}
				</Badge>
				{manifest?.lyricFile && (
					<Badge
						variant="soft"
						style={{
							backgroundColor: "var(--accent-4)",
							color: "var(--accent-11)",
						}}
					>
						<DocumentRegular /> {manifest.lyricFile}
					</Badge>
				)}
			</Flex>
			<Flex justify="end" gap="2">
				<Button variant="soft" onClick={handleBrowse}>
					<FolderOpenRegular /> {t("projectsDialog.browse", "Browse...")}
				</Button>
				<Button
					onClick={handleSave}
					style={{
						backgroundColor: "var(--accent-9)",
						color: "var(--accent-9-contrast)",
					}}
				>
					<SaveRegular /> {t("projectsDialog.save", "Save")}
				</Button>
			</Flex>
		</Flex>
	);
};

const RecentTab = ({ onClose }: { onClose: () => void }) => {
	const { t } = useTranslation();
	const [projects, setProjects] = useState<RecentProjectEntry[]>([]);
	const [fileStatus, setFileStatus] = useState<
		Record<string, RecentProjectFileStatus | null>
	>({});
	const [loading, setLoading] = useState(false);
	const { openProjectFromDir } = useFolderProject();

	const loadProjects = useCallback(async () => {
		setLoading(true);
		try {
			const list = await getRecentProjects();
			setProjects(list);
			const statuses = await Promise.all(
				list.map((p) => getRecentProjectFileStatus(p)),
			);
			setFileStatus(
				Object.fromEntries(list.map((p, i) => [p.dir, statuses[i]])),
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadProjects();
	}, [loadProjects]);

	useEffect(() => {
		const handleFocus = () => loadProjects();
		window.addEventListener("focus", handleFocus);
		return () => window.removeEventListener("focus", handleFocus);
	}, [loadProjects]);

	const handleOpen = useCallback(
		(dir: string) => {
			onClose();
			openProjectFromDir(dir);
		},
		[openProjectFromDir, onClose],
	);

	const handleRemove = useCallback(
		async (e: React.MouseEvent, dir: string) => {
			e.stopPropagation();
			await removeRecentProject(dir);
			await loadProjects();
		},
		[loadProjects],
	);

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
		<ScrollArea type="auto" scrollbars="vertical" style={{ flexGrow: 1 }}>
			<Flex direction="column" gap="2" pr="3">
				{projects.length === 0 ? (
					<Text size="2" color="gray" align="center" my="4" as="div">
						{loading
							? t("projectsDialog.loading", "Loading...")
							: t("projectsDialog.noRecent", "No recent projects")}
					</Text>
				) : (
					projects.map((p) => {
						const status = fileStatus[p.dir];
						const lyricMissing = status ? !status.lyricFileExists : false;
						const audioMissing = status ? !status.audioFileExists : false;
						return (
							<Card
								key={p.dir}
								variant="surface"
								onClick={() => handleOpen(p.dir)}
								style={{ cursor: "pointer" }}
							>
								<Flex justify="between" align="center" gap="3">
									<Flex
										direction="column"
										gap="1"
										style={{ flexGrow: 1, overflow: "hidden" }}
									>
										<Text weight="bold" truncate>
											{p.name}
										</Text>
										<Text size="1" color="gray" truncate>
											{p.dir}
										</Text>
										<Flex gap="2" mt="1" wrap="wrap">
											<Badge
												variant="soft"
												color={lyricMissing ? "red" : undefined}
											>
												<DocumentRegular fontSize={10} />{" "}
												{p.lyricFile
													? lyricMissing
														? t(
																"projectBrowser.fileMissing",
																"{file} (missing)",
																{ file: p.lyricFile },
															)
														: p.lyricFile
													: t("projectBrowser.noLyric", "No lyrics")}
											</Badge>
											<Badge
												variant="soft"
												color={audioMissing ? "red" : undefined}
											>
												<MusicNote1Regular fontSize={10} />{" "}
												{p.audioFile
													? audioMissing
														? t(
																"projectBrowser.fileMissing",
																"{file} (missing)",
																{ file: p.audioFile },
															)
														: p.audioFile
													: t("projectBrowser.noAudio", "No audio")}
											</Badge>
											<Flex gap="1" align="center">
												<ClockRegular fontSize={10} />
												<Text size="1" color="gray">
													{formatRelativeTime(p.updatedAt ?? p.lastOpened)}
												</Text>
											</Flex>
										</Flex>
									</Flex>
									<IconButton
										size="1"
										variant="ghost"
										color="gray"
										onClick={(e) => handleRemove(e, p.dir)}
									>
										<DeleteRegular />
									</IconButton>
								</Flex>
							</Card>
						);
					})
				)}
			</Flex>
		</ScrollArea>
	);
};

const WorkspaceTab = ({ onClose }: { onClose: () => void }) => {
	const { t } = useTranslation();
	const [projects] = useAtom(workspaceProjectsAtom);
	const [dir] = useAtom(workspaceDirAtom);
	const [scanning] = useAtom(workspaceScanningAtom);
	const { openWorkspace, rescanWorkspace, openProjectFromDir } =
		useFolderProject();

	useEffect(() => {
		if (dir) rescanWorkspace();
	}, [dir, rescanWorkspace]);

	useEffect(() => {
		if (!dir) return;
		const handleFocus = () => rescanWorkspace();
		window.addEventListener("focus", handleFocus);
		return () => window.removeEventListener("focus", handleFocus);
	}, [dir, rescanWorkspace]);

	const handleOpen = useCallback(
		(dir: string) => {
			onClose();
			openProjectFromDir(dir);
		},
		[openProjectFromDir, onClose],
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
		<Flex direction="column" gap="2" style={{ flexGrow: 1, minHeight: 0 }}>
			{dir && (
				<Text size="1" color="gray" as="div">
					<Flex align="center" gap="1">
						<FolderOpenRegular fontSize={12} />
						{dir}
					</Flex>
				</Text>
			)}
			<Box flexGrow="1" style={{ minHeight: 0, overflow: "hidden" }}>
				<ScrollArea
					type="auto"
					scrollbars="vertical"
					style={{ maxHeight: "46vh" }}
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
									<Flex
										direction="column"
										gap="1"
										style={{ overflow: "hidden" }}
									>
										<Flex align="center" gap="2">
											<Text weight="bold" size="2" truncate>
												{project.name}
											</Text>
											{!project.hasManifest && (
												<Badge variant="soft">
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
											<Badge variant="soft">
												<Flex align="center" gap="1">
													<MusicNote1Regular fontSize={12} />
													{project.audioFile ||
														t("projectBrowser.noAudio", "No audio")}
												</Flex>
											</Badge>
											<Flex gap="1" align="center">
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
			<Flex justify="between" align="center">
				<Text size="1" color="gray">
					{projects.length > 0
						? t("workspace.foundCount", "{count} project(s) found", {
								count: projects.length,
							})
						: ""}
				</Text>
				<Button variant="soft" onClick={handleScan}>
					<FolderOpenRegular />
					{t("workspace.selectFolder", "Select workspace folder...")}
				</Button>
			</Flex>
		</Flex>
	);
};
