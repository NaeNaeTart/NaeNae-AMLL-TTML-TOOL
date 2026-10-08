import {
	Code24Regular,
	Dismiss24Regular,
	Edit24Regular,
	Folder24Regular,
	Info24Regular,
	Keyboard12324Regular,
	PaintBrush24Regular,
	Search24Regular,
	Settings24Regular,
	Sparkle24Regular,
	Speaker224Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Dialog,
	Flex,
	Heading,
	IconButton,
	Tabs,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import {
	memo,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs.ts";
import {
	matchesSettingsSearch,
	settingsSearchKeywords,
} from "../logic/settings-search";
import { SettingsAboutTab } from "./about";
import { SettingsAiTab } from "./ai";
import { SettingsAppearanceTab } from "./appearance";
import { AudioSettingsTab } from "./audio";
import { SettingsBackupTab } from "./backup";
import { SettingsCommonTab } from "./common";
import { SettingsDevTab } from "./dev";
import { SettingsKeyBindingsDialog } from "./keybindings";
import styles from "./settings.module.css";
import { SettingsSpectrogramTab } from "./spectrogram";

const SettingsPage = ({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) => (
	<Flex direction="column" gap="4" className={styles.page}>
		<Box>
			<Heading size="7">{title}</Heading>
			{description && (
				<Text size="2" color="gray">
					{description}
				</Text>
			)}
		</Box>
		{children}
	</Flex>
);

const NavigationItem = ({
	value,
	icon,
	children,
}: {
	value: string;
	icon: ReactNode;
	children: ReactNode;
}) => (
	<Tabs.Trigger value={value} className={styles.navigationItem}>
		{icon}
		<span>{children}</span>
	</Tabs.Trigger>
);

export const SettingsDialog = memo(() => {
	const [settingsDialogOpen, setSettingsDialogOpen] =
		useAtom(settingsDialogAtom);
	const [activeTab, setActiveTab] = useAtom(settingsTabAtom);
	const [searchQuery, setSearchQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);
	const contentRef = useRef<HTMLElement>(null);
	const { t } = useTranslation();
	const displayedTab = activeTab === "assistant" ? "ai" : activeTab;
	const navigationItems = useMemo(
		() => [
			{
				value: "common",
				icon: <Settings24Regular />,
				label: t("settingsDialog.tab.common", "General"),
			},
			{
				value: "editor",
				icon: <Edit24Regular />,
				label: t("settingsDialog.tab.editor", "Editor & Sync"),
			},
			{
				value: "files",
				icon: <Folder24Regular />,
				label: t("settingsDialog.tab.files", "Files & Storage"),
			},
			{
				value: "audio",
				icon: <Speaker224Regular />,
				label: t("settingsDialog.tab.audio", "Audio"),
			},
			{
				value: "keybinding",
				icon: <Keyboard12324Regular />,
				label: t("settingsDialog.tab.keybindings", "Keybindings"),
			},
			{
				value: "appearance",
				icon: <PaintBrush24Regular />,
				label: t("settingsDialog.tab.appearance", "Appearance"),
			},
			{
				value: "ai",
				icon: <Sparkle24Regular />,
				label: t("settingsDialog.tab.ai", "AI"),
			},
			{
				value: "about",
				icon: <Info24Regular />,
				label: t("common.about", "About"),
			},
			{
				value: "dev",
				icon: <Code24Regular />,
				label: t("settingsDialog.tab.dev", "Developer"),
			},
		],
		[t],
	);
	const visibleItems = useMemo(
		() =>
			navigationItems.filter((item) =>
				matchesSettingsSearch(
					`${item.label} ${settingsSearchKeywords[item.value]}`,
					searchQuery,
				),
			),
		[navigationItems, searchQuery],
	);

	useEffect(() => {
		if (!settingsDialogOpen) {
			setSearchQuery("");
			return;
		}
		if (
			searchQuery.trim() &&
			visibleItems.length &&
			!visibleItems.some((item) => item.value === displayedTab)
		) {
			setActiveTab(visibleItems[0].value);
		}
	}, [
		settingsDialogOpen,
		searchQuery,
		displayedTab,
		visibleItems,
		setActiveTab,
	]);

	useEffect(() => {
		if (!settingsDialogOpen || !searchQuery.trim()) return;
		let target: HTMLElement | undefined;
		const frame = requestAnimationFrame(() => {
			const content = contentRef.current?.querySelector(
				`[id$="-content-${displayedTab}"][data-state="active"]`,
			);
			if (!content) return;
			const matches = Array.from(
				content.querySelectorAll<HTMLElement>(
					"h1, h2, h3, h4, label, p, span, button",
				),
			)
				.filter(
					(element) =>
						element.getClientRects().length &&
						matchesSettingsSearch(element.textContent ?? "", searchQuery),
				)
				.sort(
					(a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0),
				);
			const match = matches[0];
			if (!match) return;
			target = match.closest<HTMLElement>(".rt-Card") ?? match;
			target.classList.add(styles.searchHighlight);
			target.scrollIntoView({ block: "center", behavior: "instant" });
		});
		return () => {
			cancelAnimationFrame(frame);
			target?.classList.remove(styles.searchHighlight);
		};
	}, [settingsDialogOpen, displayedTab, searchQuery]);

	return (
		<Dialog.Root open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
			<Dialog.Content maxWidth="980px" className={styles.dialogContent}>
				<Tabs.Root
					value={displayedTab}
					onValueChange={setActiveTab}
					orientation="vertical"
					className={styles.settingsLayout}
				>
					<aside className={styles.sidebar}>
						<Dialog.Title className={styles.sidebarTitle}>
							{t("settingsDialog.title", "Preferences")}
						</Dialog.Title>
						<TextField.Root
							ref={searchRef}
							className={styles.searchField}
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder={t("settingsDialog.search", "Search settings")}
							aria-label={t("settingsDialog.search", "Search settings")}
						>
							<TextField.Slot>
								<Search24Regular width="18" height="18" />
							</TextField.Slot>
							{searchQuery && (
								<TextField.Slot side="right">
									<IconButton
										size="1"
										variant="ghost"
										color="gray"
										aria-label={t("settingsDialog.clearSearch", "Clear search")}
										onClick={() => {
											setSearchQuery("");
											searchRef.current?.focus();
										}}
									>
										<Dismiss24Regular width="16" height="16" />
									</IconButton>
								</TextField.Slot>
							)}
						</TextField.Root>
						<Tabs.List className={styles.navigation}>
							{visibleItems.map((item) => (
								<NavigationItem
									key={item.value}
									value={item.value}
									icon={item.icon}
								>
									{item.label}
								</NavigationItem>
							))}
						</Tabs.List>
						{visibleItems.length === 0 && (
							<Text
								size="2"
								color="gray"
								role="status"
								className={styles.noResults}
							>
								{t("settingsDialog.noSearchResults", "No matching categories")}
							</Text>
						)}
					</aside>

					<main ref={contentRef} className={styles.contentPane}>
						<Tabs.Content value="common" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.common", "General")}
								description={t(
									"settingsDialog.page.generalDesc",
									"Language, layout, privacy, and app-wide behavior.",
								)}
							>
								<SettingsCommonTab section="general" />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="editor" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.editor", "Editor & Sync")}
								description={t(
									"settingsDialog.page.editorDesc",
									"Timing input, synchronization behavior, and visual cues.",
								)}
							>
								<SettingsCommonTab section="editor" />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="files" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.files", "Files & Storage")}
								description={t(
									"settingsDialog.page.filesDesc",
									"Import cleanup, autosave history, and portable backups.",
								)}
							>
								<SettingsCommonTab section="files" />
								<SettingsBackupTab />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="audio" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.audio", "Audio")}
								description={t(
									"settingsDialog.page.audioDesc",
									"Playback, conversion, equalizer, and spectrogram display.",
								)}
							>
								<SettingsCommonTab section="audio" />
								<AudioSettingsTab />
								<SettingsSpectrogramTab />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="keybinding" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.keybindings", "Keybindings")}
							>
								<SettingsKeyBindingsDialog />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="appearance" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.appearance", "Appearance")}
							>
								<SettingsAppearanceTab />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="ai" className={styles.tabContent}>
							<SettingsPage title={t("settingsDialog.tab.ai", "AI")}>
								<SettingsAiTab />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="about" className={styles.tabContent}>
							<SettingsPage title={t("common.about", "About")}>
								<SettingsAboutTab />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="dev" className={styles.tabContent}>
							<SettingsPage title={t("settingsDialog.tab.dev", "Developer")}>
								<SettingsDevTab />
							</SettingsPage>
						</Tabs.Content>
					</main>
				</Tabs.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
});
