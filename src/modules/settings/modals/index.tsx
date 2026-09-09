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
	const contentPaneRef = useRef<HTMLElement>(null);
	const { t } = useTranslation();
	const displayedTab = activeTab === "assistant" ? "ai" : activeTab;
	const navigationItems = useMemo(
		() => [
			{
				value: "common",
				icon: <Settings24Regular />,
				label: t("settingsDialog.tab.common", "General"),
				keywords:
					"interface language layout mode simple advanced privacy display app presence",
			},
			{
				value: "editor",
				icon: <Edit24Regular />,
				label: t("settingsDialog.tab.editor", "Editor & Sync"),
				keywords:
					"syncing timing timestamp judgment key binding trigger global sync time commit input offset smart first word smart last word compact background vocals upcoming pre-highlight threshold highlight color",
			},
			{
				value: "files",
				icon: <Folder24Regular />,
				label: t("settingsDialog.tab.files", "Files & Storage"),
				keywords:
					"import cleanup normalize apostrophes cyrillic autosave interval history limit backup restore project storage export",
			},
			{
				value: "audio",
				icon: <Speaker224Regular />,
				label: t("settingsDialog.tab.audio", "Audio"),
				keywords:
					"music volume playback speed equalizer gain preset mp3 flac conversion spectrogram color palette frequency",
			},
			{
				value: "keybinding",
				icon: <Keyboard12324Regular />,
				label: t("settingsDialog.tab.keybindings", "Keybindings"),
				keywords:
					"keyboard keys shortcuts controls new open save undo redo select deselect invert delete mode sync playback seek volume segment audition",
			},
			{
				value: "appearance",
				icon: <PaintBrush24Regular />,
				label: t("settingsDialog.tab.appearance", "Appearance"),
				keywords:
					"appearance preset theme custom accent color background blur glass intensity image gradient font interface scale reset layout",
			},
			{
				value: "ai",
				icon: <Sparkle24Regular />,
				label: t("settingsDialog.tab.ai", "AI"),
				keywords: "assistant model api",
			},
			{
				value: "about",
				icon: <Info24Regular />,
				label: t("common.about", "About"),
				keywords: "version update credits license",
			},
			{
				value: "dev",
				icon: <Code24Regular />,
				label: t("settingsDialog.tab.dev", "Developer"),
				keywords: "developer debug experimental advanced",
			},
		],
		[t],
	);
	const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
	const visibleNavigationItems = normalizedQuery
		? navigationItems.filter((item) =>
				`${item.label} ${item.keywords}`
					.toLocaleLowerCase()
					.includes(normalizedQuery),
			)
		: navigationItems;

	useEffect(() => {
		if (
			normalizedQuery &&
			visibleNavigationItems.length > 0 &&
			!visibleNavigationItems.some((item) => item.value === displayedTab)
		) {
			setActiveTab(visibleNavigationItems[0].value);
		}
	}, [displayedTab, normalizedQuery, setActiveTab, visibleNavigationItems]);

	useEffect(() => {
		const contentPane = contentPaneRef.current;
		if (!contentPane) return;

		for (const element of contentPane.querySelectorAll(
			`.${styles.searchHighlight}`,
		)) {
			element.classList.remove(styles.searchHighlight);
		}

		if (!normalizedQuery) return;

		const frame = requestAnimationFrame(() => {
			const activeContent =
				contentPane.querySelector<HTMLElement>(
					`[id$="-content-${displayedTab}"]`,
				) ?? contentPane;
			const textElements = Array.from(
				activeContent.querySelectorAll<HTMLElement>(
					"h1, h2, h3, h4, label, p, span, button, .rt-Text",
				),
			)
				.filter((element) =>
					element.textContent?.toLocaleLowerCase().includes(normalizedQuery),
				)
				.sort(
					(a, b) =>
						(a.textContent?.length ?? Number.MAX_SAFE_INTEGER) -
						(b.textContent?.length ?? Number.MAX_SAFE_INTEGER),
				);

			const match = textElements[0];
			if (!match) return;

			const target =
				match.closest<HTMLElement>(".rt-Card") ??
				match.closest<HTMLElement>("details") ??
				match;
			target.classList.add(styles.searchHighlight);
			target.scrollIntoView({ behavior: "smooth", block: "center" });
		});

		return () => cancelAnimationFrame(frame);
	}, [displayedTab, normalizedQuery]);

	return (
		<Dialog.Root open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
			<Dialog.Content maxWidth="980px" className={styles.dialogContent}>
				<Dialog.Close>
					<IconButton
						variant="ghost"
						color="gray"
						className={styles.closeButton}
						aria-label={t("common.close", "Close")}
					>
						<Dismiss24Regular />
					</IconButton>
				</Dialog.Close>
				<Tabs.Root
					value={displayedTab}
					onValueChange={setActiveTab}
					orientation="vertical"
					className={styles.settingsLayout}
				>
					<aside className={styles.sidebar}>
						<div className={styles.sidebarHeader}>
							<Dialog.Title className={styles.sidebarTitle}>
								{t("settingsDialog.title", "Preferences")}
							</Dialog.Title>
							<TextField.Root
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								placeholder={t("settingsDialog.search", "Search settings")}
								aria-label={t("settingsDialog.search", "Search settings")}
								className={styles.searchField}
								size="2"
							>
								<TextField.Slot>
									<Search24Regular />
								</TextField.Slot>
							</TextField.Root>
						</div>
						<Tabs.List className={styles.navigation}>
							{visibleNavigationItems.map((item) => (
								<NavigationItem
									key={item.value}
									value={item.value}
									icon={item.icon}
								>
									{item.label}
								</NavigationItem>
							))}
							{visibleNavigationItems.length === 0 && (
								<Text size="1" color="gray" className={styles.noResults}>
									{t(
										"settingsDialog.noSearchResults",
										"No matching categories",
									)}
								</Text>
							)}
						</Tabs.List>
					</aside>

					<main ref={contentPaneRef} className={styles.contentPane}>
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
