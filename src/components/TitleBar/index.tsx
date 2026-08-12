import { Button, Flex, IconButton, SegmentedControl, Text } from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, useCallback } from "react";
import { useTranslation } from "react-i18next";
import WindowControls from "$/components/WindowControls";
import { boykisserModeAtom, experimentalFeaturesDialogOpenAtom } from "$/modules/settings/states";
import { Beaker24Regular } from "@fluentui/react-icons";
import {
	keySwitchEditModeAtom,
	keySwitchPreviewModeAtom,
	keySwitchSyncModeAtom,
} from "$/states/keybindings.ts";
import {
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import { useKeyBindingAtom } from "$/utils/keybindings.ts";
import { TopMenu } from "../TopMenu/index.tsx";
import styles from "./index.module.css";

export const TitleBar: FC = () => {
	const [toolMode, setToolMode] = useAtom(toolModeAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const { t } = useTranslation();
	const [boykisserMode, setBoykisserMode] = useAtom(boykisserModeAtom);
	const setExperimentalDialogOpen = useSetAtom(experimentalFeaturesDialogOpenAtom);

	const onSwitchEditMode = useCallback(() => {
		setToolMode(ToolMode.Edit);
	}, [setToolMode]);
	const onSwitchSyncMode = useCallback(() => {
		setToolMode(ToolMode.Sync);
	}, [setToolMode]);
	const onSwitchPreviewMode = useCallback(() => {
		setToolMode(ToolMode.Preview);
	}, [setToolMode]);

	useKeyBindingAtom(keySwitchEditModeAtom, onSwitchEditMode);
	useKeyBindingAtom(keySwitchSyncModeAtom, onSwitchSyncMode);
	useKeyBindingAtom(keySwitchPreviewModeAtom, onSwitchPreviewMode);

	return (
		<WindowControls
			startChildren={<TopMenu />}
			titleChildren={
				<SegmentedControl.Root
					value={toolMode}
					onValueChange={(v) => setToolMode(v as ToolMode)}
					// size="1"
				>
					<SegmentedControl.Item value={ToolMode.Edit}>
						{t("topBar.modeBtns.edit", "编辑")}
					</SegmentedControl.Item>
					<SegmentedControl.Item value={ToolMode.Sync}>
						{t("topBar.modeBtns.sync", "打轴")}
					</SegmentedControl.Item>
					<SegmentedControl.Item value={ToolMode.Preview}>
						{t("topBar.modeBtns.preview", "预览")}
					</SegmentedControl.Item>
				</SegmentedControl.Root>
			}
			endChildren={
				!import.meta.env.TAURI_ENV_PLATFORM && (
					<Flex align="center" gap="2" mr="2">
						{!window.location.href.includes("spicylyrics.org") && (
							<button
								type="button"
								style={{
									width: "6px",
									height: "6px",
									borderRadius: "50%",
									background: "var(--accent-9)",
									border: "none",
									cursor: "pointer",
									opacity: 0.2,
									transition: "opacity 0.2s",
									outline: "none",
									marginRight: "4px",
								}}
								onClick={() => setBoykisserMode(!boykisserMode)}
								title={t("topBar.boykisser", "boykisser")}
							/>
						)}
						<IconButton
							variant="ghost"
							color="gray"
							onClick={() => setExperimentalDialogOpen(true)}
							title={t("ribbonBar.experimentalFeatures", "Experimental Features")}
						>
							<Beaker24Regular />
						</IconButton>
						<Flex
							direction="column"
							align="end"
							justify="center"
							style={{ lineHeight: 1.2 }}
						>
							<Text
								style={{ color: "var(--accent-11)" }}
								wrap="nowrap"
								size="2"
							>
								<span className={styles.title}>
									{t("topBar.appName", "Apple Music-like Lyrics TTML Tool")}
								</span>
							</Text>
							<Text size="1" color="gray" style={{ opacity: 0.7 }}>
								Forked by NaeNae
							</Text>
						</Flex>
					</Flex>
				)
			}
			onSpacerClicked={() => {
				setSelectedLines((o) => o.clear());
				setSelectedWords((o) => o.clear());
			}}
		/>
	);
};
