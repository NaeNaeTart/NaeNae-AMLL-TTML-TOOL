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
	Separator,
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
	removeRecentProject,
	type RecentProjectEntry,
	type RecentProjectFileStatus,
} from "$/modules/project/folder-project/recent-projects";
import { useFolderProject } from "$/modules/project/folder-project/useFolderProject";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
	workspaceDirAtom,
	workspaceProjectsAtom,
	workspaceScanningAtom,
} from "$/modules/project/folder-project/state";
import { projectsDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import { loadedAudioAtom } from "$/modules/audio/states";
import styles from "./ProjectsDialog.module.css";

type Tab = "project" | "recent" | "workspace" | "history";

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

				<Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
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
						<Tabs.Trigger value="history" className={styles.tabTrigger}>
							{t("projectsDialog.tabHistory", "History")}
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
						<Tabs.Content value="history" className={styles.tabContent}>
							<HistoryTab onClose={() => setIsOpen(false)} />
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
	const loadedAudio = useAtomValue(loadedAudioAtom);
	const { createProject, saveProject, openProject } = useFolderProject();
	const [projectName, setProjectName] = useState("");

	useEffect(() => {
		setProjectName(manifest?.name || "");
	}, [manifest]);

	const hasAudio = loadedAudio instanceof File || (loadedAudio instanceof Blob && loadedAudio.size > 0);
	const hasLyric = lyricLines.lyricLines.length > 0;

	const handleSave = useCallback(async () => {
		await saveProject();
		onClose();
	}, [saveProject, onClose]);

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
			<Flex direction="column" align="center" justify="center" gap="3" style={{ minHeight: 200 }}>
				<Text color="gray">{t("projectsDialog.noProject", "No project is currently open")}</Text>
				<Flex gap="2">
					<Button variant="soft" onClick={handleCreate}>
						{t("projectsDialog.createNew", "New Project")}
					</Button>
					<Button variant="soft" onClick={handleBrowse}>
						<FolderOpenRegular /> {t("projectsDialog.openFolder", "Open Folder")}
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
					<MusicNote1Regular /> {hasAudio ? (manifest?.audioFile || "Audio loaded") : "No audio"}
				</Badge>
				<Badge variant="soft" color="gray">
					<DocumentRegular /> {hasLyric ? `${lyricLines.lyricLines.length} lines` : "No lyrics"}
				</Badge>
				{Boolean(
					(manifest?.ttmlFile && manifest?.lyricsfileFile && manifest.ttmlFile !== manifest.lyricsfileFile) ||
					(manifest?.lyricsfileFile && manifest?.lyricFile && manifest.lyricsfileFile !== manifest.lyricFile) ||
					(manifest?.ttmlFile && manifest?.lyricFile && manifest.ttmlFile !== manifest.lyricFile)
				) ? (
					<Badge
						variant="surface"
						style={{
							backgroundColor: "var(--accent-4)",
							color: "var(--accent-11)",
						}}
					>
						<DocumentRegular /> Dual (TTML + YAML)
					</Badge>
				) : manifest?.lyricsfileFile ? (
					<Badge
						variant="soft"
						style={{
							backgroundColor: "var(--accent-4)",
							color: "var(--accent-11)",
						}}
					>
						<DocumentRegular /> {manifest.lyricsfileFile}
					</Badge>
				) : null}
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
		Record<string, RecentProjectFileStatus>
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
		if (minutes > 0) return t("time.minutesAgo", "{count}m ago", { count: minutes });
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
						const isDual = Boolean(
							(p.ttmlFile && p.lyricsfileFile && p.ttmlFile !== p.lyricsfileFile) ||
							(p.lyricsfileFile && p.lyricFile && p.lyricsfileFile !== p.lyricFile) ||
							(p.ttmlFile && p.lyricFile && p.ttmlFile !== p.lyricFile)
						);
						const isYamlOnly = !isDual && Boolean(
							(p.lyricsfileFile && p.lyricsfileFile === p.lyricFile) ||
							(p.lyricFile && (p.lyricFile.endsWith(".yaml") || p.lyricFile.endsWith(".yml")))
						);
						const lyricMissing = status ? !status.lyricFileExists : false;
						const lyricsfileMissing = status
							? !status.lyricsfileFileExists
							: false;
						const audioMissing = status ? !status.audioFileExists : false;
						return (
							<Card
								key={p.dir}
								variant="surface"
								onClick={() => handleOpen(p.dir)}
								style={{ cursor: "pointer" }}
							>
								<Flex justify="between" align="center" gap="3">
									<Flex direction="column" gap="1" style={{ flexGrow: 1, overflow: "hidden" }}>
										<Text weight="bold" truncate>{p.name}</Text>
										<Text size="1" color="gray" truncate>{p.dir}</Text>
										<Flex gap="2" mt="1" wrap="wrap">
											{isDual ? (
												<>
													<Badge variant="soft" color={lyricMissing ? "red" : "gray"}>
														<DocumentRegular fontSize={10} />{" "}
														{p.lyricFile
															? lyricMissing
																? t("projectBrowser.fileMissing", "{file} (missing)", { file: p.lyricFile })
																: p.lyricFile
															: t("projectBrowser.noLyric", "No lyrics")}
													</Badge>
													<Badge
														variant="surface"
														color={lyricsfileMissing ? "red" : undefined}
														style={
															lyricsfileMissing
																? undefined
																: {
																		backgroundColor: "var(--accent-4)",
																		color: "var(--accent-11)",
																	}
														}
													>
														<DocumentRegular fontSize={10} />{" "}
														{lyricsfileMissing
															? t("projectBrowser.dualMissing", "Dual (YAML missing)")
															: "Dual (TTML + YAML)"}
													</Badge>
												</>
											) : isYamlOnly ? (
												<Badge
													variant="soft"
													color={lyricsfileMissing || lyricMissing ? "red" : undefined}
													style={
														lyricsfileMissing || lyricMissing
															? undefined
															: {
																	backgroundColor: "var(--accent-4)",
																	color: "var(--accent-11)",
																}
													}
												>
													<DocumentRegular fontSize={10} />{" "}
													{lyricsfileMissing || lyricMissing
														? t("projectBrowser.fileMissing", "{file} (missing)", { file: p.lyricsfileFile || p.lyricFile })
														: (p.lyricsfileFile || p.lyricFile)}
												</Badge>
											) : (
												<Badge variant="soft" color={lyricMissing ? "red" : "gray"}>
													<DocumentRegular fontSize={10} />{" "}
													{p.lyricFile
														? lyricMissing
															? t("projectBrowser.fileMissing", "{file} (missing)", { file: p.lyricFile })
															: p.lyricFile
														: t("projectBrowser.noLyric", "No lyrics")}
												</Badge>
											)}
											<Badge variant="soft" color={audioMissing ? "red" : "gray"}>
												<MusicNote1Regular fontSize={10} />{" "}
												{p.audioFile
													? audioMissing
														? t("projectBrowser.fileMissing", "{file} (missing)", { file: p.audioFile })
														: p.audioFile
													: t("projectBrowser.noAudio", "No audio")}
											</Badge>
											<Flex gap="1" align="center">
												<ClockRegular fontSize={10} />
												<Text size="1" color="gray">{formatRelativeTime(p.updatedAt)}</Text>
											</Flex>
										</Flex>
									</Flex>
									<IconButton size="1" variant="ghost" color="gray" onClick={(e) => handleRemove(e, p.dir)}>
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
	const { openWorkspace, rescanWorkspace, openProjectFromDir } = useFolderProject();

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
		if (minutes > 0) return t("time.minutesAgo", "{count}m ago", { count: minutes });
		return t("time.justNow", "just now");
	};

	return (
		<Flex direction="column" gap="3" style={{ height: "100%" }}>
			{dir && (
				<Text size="1" color="gray" as="div">
					<Flex align="center" gap="1">
						<FolderOpenRegular fontSize={12} />
						{dir}
					</Flex>
				</Text>
			)}

			<ScrollArea type="auto" scrollbars="vertical" style={{ flexGrow: 1 }}>
				<Flex direction="column" gap="2" pr="3">
					{projects.length === 0 ? (
						<Text size="2" color="gray" align="center" my="4" as="div">
							{scanning
								? t("workspace.scanning", "Scanning...")
								: t("workspace.empty", "No projects found. Select a workspace folder to scan.")}
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
									<Flex direction="column" gap="1" style={{ overflow: "hidden", flexGrow: 1 }}>
										<Flex align="center" gap="2">
											<Text weight="bold" size="2" truncate>{project.name}</Text>
											{!project.hasManifest && (
												<Badge variant="soft" color="amber">
													{t("workspace.importable", "Importable")}
												</Badge>
											)}
										</Flex>
										<Text size="1" color="gray" truncate>{project.dir}</Text>
										<Flex gap="2" align="center" mt="1" wrap="wrap">
											{Boolean(
												(project.ttmlFile && project.lyricsfileFile && project.ttmlFile !== project.lyricsfileFile) ||
												(project.lyricsfileFile && project.lyricFile && project.lyricsfileFile !== project.lyricFile) ||
												(project.ttmlFile && project.lyricFile && project.ttmlFile !== project.lyricFile)
											) ? (
												<>
													<Badge variant="soft" color="gray">
														<Flex align="center" gap="1">
															<DocumentRegular fontSize={12} />
															{project.lyricFile || t("projectBrowser.noLyric", "No lyrics")}
														</Flex>
													</Badge>
													<Badge variant="surface" color="amber">
														<Flex align="center" gap="1">
															<DocumentRegular fontSize={12} />
															Dual (TTML + YAML)
														</Flex>
													</Badge>
												</>
											) : (project.lyricsfileFile && project.lyricsfileFile === project.lyricFile) || (project.lyricFile && (project.lyricFile.endsWith(".yaml") || project.lyricFile.endsWith(".yml"))) ? (
												<Badge
													variant="soft"
													style={{
														backgroundColor: "var(--accent-4)",
														color: "var(--accent-11)",
													}}
												>
													<Flex align="center" gap="1">
														<DocumentRegular fontSize={12} />
														{project.lyricsfileFile || project.lyricFile}
													</Flex>
												</Badge>
											) : (
												<Badge variant="soft" color="gray">
													<Flex align="center" gap="1">
														<DocumentRegular fontSize={12} />
														{project.lyricFile || t("projectBrowser.noLyric", "No lyrics")}
													</Flex>
												</Badge>
											)}
											<Badge variant="soft" color="gray">
												<Flex align="center" gap="1">
													<MusicNote1Regular fontSize={12} />
													{project.audioFile || t("projectBrowser.noAudio", "No audio")}
												</Flex>
											</Badge>
											<Flex gap="1" align="center">
												<ClockRegular fontSize={12} />
												<Text size="1" color="gray">{formatRelativeTime(project.updatedAt)}</Text>
											</Flex>
										</Flex>
									</Flex>
								</Flex>
							</Card>
						))
					)}
				</Flex>
			</ScrollArea>

			<Separator size="4" />

			<Flex justify="between" align="center">
				<Text size="1" color="gray">
					{projects.length > 0
						? t("workspace.foundCount", "{count} project(s) found", { count: projects.length })
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

interface HistoryProjectItem {
	id: string;
	name: string;
	lastModified: number;
	isUntitled?: boolean;
	snapshotCount: number;
}

const HistoryTab = ({ onClose }: { onClose: () => void }) => {
	const { t } = useTranslation();
	const [projects, setProjects] = useState<HistoryProjectItem[]>([]);
	const [loading, setLoading] = useState(false);

	const loadProjects = useCallback(async () => {
		setLoading(true);
		try {
			const { getProjectList } = await import("$/modules/project/autosave/autosave");
			const rawList = await getProjectList();
			
			// Deduplicate: Group entries by unique project name
			const grouped = new Map<string, { latest: typeof rawList[0]; count: number }>();

			for (const p of rawList) {
				const groupKey = p.isUntitled
					? "untitled_project"
					: p.name.trim().toLowerCase();

				const existing = grouped.get(groupKey);
				if (!existing) {
					grouped.set(groupKey, { latest: p, count: 1 });
				} else {
					existing.count++;
					if (p.lastModified > existing.latest.lastModified) {
						existing.latest = p;
					}
				}
			}

			const dedupedList: HistoryProjectItem[] = Array.from(grouped.values())
				.map(({ latest, count }) => ({
					id: latest.id,
					name: latest.name,
					lastModified: latest.lastModified,
					isUntitled: latest.isUntitled,
					snapshotCount: count,
				}))
				.sort((a, b) => b.lastModified - a.lastModified);

			setProjects(dedupedList);
		} catch {
			// ignore
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadProjects();
	}, [loadProjects]);

	const handleRestore = useCallback(async (projectId: string) => {
		try {
			const { getProjectLatestState } = await import("$/modules/project/autosave/autosave");
			const { newLyricLinesAtom, projectIdAtom } = await import("$/states/main");
			const latest = await getProjectLatestState(projectId);
			if (latest) {
				const { createStore } = await import("jotai");
				const store = createStore();
				store.set(newLyricLinesAtom, latest);
				store.set(projectIdAtom, projectId);
				onClose();
			}
		} catch {
			// ignore
		}
	}, [onClose]);

	const handleClearAll = useCallback(async () => {
		try {
			const { clearAllProjects } = await import("$/modules/project/autosave/autosave");
			await clearAllProjects();
			await loadProjects();
		} catch {
			// ignore
		}
	}, [loadProjects]);

	const formatRelativeTime = (timestamp: number) => {
		const diff = Date.now() - timestamp;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);
		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return t("time.justNow", "just now");
	};

	return (
		<ScrollArea type="auto" scrollbars="vertical" style={{ flexGrow: 1 }}>
			<Flex direction="column" gap="2" pr="3">
				{projects.length > 0 && (
					<Flex justify="end" mb="1">
						<Button
							size="1"
							variant="ghost"
							color="red"
							onClick={handleClearAll}
							style={{ cursor: "pointer" }}
						>
							<DeleteRegular fontSize={14} />
							{t("history.clearHistory", "Clear History")}
						</Button>
					</Flex>
				)}
				{projects.length === 0 ? (
					<Text size="2" color="gray" align="center" my="4" as="div">
						{loading
							? t("projectsDialog.loading", "Loading...")
							: t("historyRestoreDialog.noProjects", "No auto-save records")}
					</Text>
				) : (
					projects.map((project) => (
						<Card
							key={project.id}
							variant="surface"
							onClick={() => handleRestore(project.id)}
							style={{ cursor: "pointer" }}
						>
							<Flex justify="between" align="center" gap="3">
								<Flex direction="column" gap="1" style={{ flexGrow: 1 }}>
									<Flex align="center" gap="2">
										<Text weight="bold" truncate>
											{project.isUntitled
												? t("autosave.untitledProjectName", "Untitled Project")
												: project.name}
										</Text>
										{project.snapshotCount > 1 && (
											<Badge size="1" variant="soft" color="gray">
												{project.snapshotCount} {t("history.snapshots", "snapshots")}
											</Badge>
										)}
									</Flex>
									<Flex gap="1" align="center">
										<ClockRegular fontSize={12} />
										<Text size="1" color="gray">{formatRelativeTime(project.lastModified)}</Text>
									</Flex>
								</Flex>
								<Button
									size="2"
									variant="soft"
									onClick={(e) => { e.stopPropagation(); handleRestore(project.id); }}
								>
									{t("common.restore", "Restore")}
								</Button>
							</Flex>
						</Card>
					))
				)}
			</Flex>
		</ScrollArea>
	);
};
