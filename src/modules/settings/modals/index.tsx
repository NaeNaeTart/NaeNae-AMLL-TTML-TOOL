import { Box, Dialog, Tabs } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs.ts";
import { SettingsAboutTab } from "./about";
import { SettingsAppearanceTab } from "./appearance";
import { SettingsAssistantTab } from "./assistant";
import { SettingsCommonTab } from "./common";
import { SettingsKeyBindingsDialog } from "./keybindings";
import { SettingsSpectrogramTab } from "./spectrogram";
import { AudioSettingsTab } from "./audio";
import { SettingsBackupTab } from "./backup";
import { SettingsDevTab } from "./dev";

export const SettingsDialog = memo(() => {
	const [settingsDialogOpen, setSettingsDialogOpen] =
		useAtom(settingsDialogAtom);
	const [activeTab, setActiveTab] = useAtom(settingsTabAtom);
	const { t } = useTranslation();

	const handleWheel = useCallback((e: React.WheelEvent) => {
		if (e.deltaY !== 0) {
			e.currentTarget.scrollLeft += e.deltaY;
		}
	}, []);

	return (
		<Dialog.Root open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
			<Dialog.Content maxWidth="800px">
				<Dialog.Title>{t("settingsDialog.title", "Preferences")}</Dialog.Title>
				<Tabs.Root value={activeTab} onValueChange={setActiveTab}>
					<Tabs.List 
						onWheel={handleWheel}
						className="hide-scrollbar"
						style={{ 
							overflowX: "auto",
							whiteSpace: "nowrap", 
							flexShrink: 0, 
							display: "flex",
							flexWrap: "nowrap",
							width: "100%",
							WebkitOverflowScrolling: "touch",
							msOverflowStyle: "none",
							scrollbarWidth: "none"
						}}
					>
						<Tabs.Trigger value="common" style={{ flexShrink: 0 }}>
							{t("settingsDialog.tab.common", "General")}
						</Tabs.Trigger>
						<Tabs.Trigger value="assistant" style={{ flexShrink: 0 }}>
							{t("settingsDialog.tab.assistant", "Assistant")}
						</Tabs.Trigger>
						<Tabs.Trigger value="appearance" style={{ flexShrink: 0 }}>
							{t("settingsDialog.tab.appearance", "Appearance")}
						</Tabs.Trigger>
						<Tabs.Trigger value="audio" style={{ flexShrink: 0 }}>
							{t("settingsDialog.tab.audio", "Audio")}
						</Tabs.Trigger>
						<Tabs.Trigger value="keybinding" style={{ flexShrink: 0 }}>
							{t("settingsDialog.tab.keybindings", "Keybindings")}
						</Tabs.Trigger>
						<Tabs.Trigger value="spectrogram" style={{ flexShrink: 0 }}>
							{t("settingsDialog.tab.spectrogram", "Spectrogram")}
						</Tabs.Trigger>
						<Tabs.Trigger value="backup" style={{ flexShrink: 0 }}>
							{t("settingsDialog.tab.backup", "Backup")}
						</Tabs.Trigger>
						<Tabs.Trigger value="about" style={{ flexShrink: 0 }}>
							{t("common.about", "About")}
						</Tabs.Trigger>
						<Tabs.Trigger value="dev" style={{ flexShrink: 0 }}>
							{t("settingsDialog.tab.dev", "Dev")}
						</Tabs.Trigger>
					</Tabs.List>
					<Box
						style={{
							height: "630px",
							overflowY: "auto",
							padding: "var(--space-3)",
							paddingBottom: "var(--space-4)",
						}}
					>
						<Tabs.Content value="common">
							{/* @ts-ignore */}
							<SettingsCommonTab />
						</Tabs.Content>
						<Tabs.Content value="assistant">
							<SettingsAssistantTab />
						</Tabs.Content>
						<Tabs.Content value="appearance">
							<SettingsAppearanceTab />
						</Tabs.Content>
						<Tabs.Content value="keybinding">
							<SettingsKeyBindingsDialog />
						</Tabs.Content>
						<Tabs.Content value="spectrogram">
							<SettingsSpectrogramTab />
						</Tabs.Content>
						<Tabs.Content value="audio">
							<AudioSettingsTab />
						</Tabs.Content>
						<Tabs.Content value="backup">
							<SettingsBackupTab />
						</Tabs.Content>
						<Tabs.Content value="about">
							{/* @ts-ignore */}
							<SettingsAboutTab />
						</Tabs.Content>
						<Tabs.Content value="dev">
							<SettingsDevTab />
						</Tabs.Content>
					</Box>
				</Tabs.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
});
