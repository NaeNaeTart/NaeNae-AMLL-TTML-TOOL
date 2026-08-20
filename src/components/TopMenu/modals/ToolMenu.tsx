import { Button, DropdownMenu } from "@radix-ui/themes";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { lyricLinesAtom } from "$/states/main";
import { pluginManager } from "$/modules/plugins/plugin-manager";
import { syncFghToHoverAtom } from "$/modules/settings/states/sync";
import { useTopMenuActions } from "../useTopMenuActions";

type ToolMenuProps = {
	variant: "toolbar" | "submenu";
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const ToolMenuItems = () => {
	const { t } = useTranslation();
	const menu = useTopMenuActions();
	const [lyricLines, setLyricLines] = useAtom(lyricLinesAtom);
	const [syncFghToHover, setSyncFghToHover] = useAtom(syncFghToHoverAtom);

	const tools = pluginManager.getTools();

	const onRunPluginTool = (pluginId: string) => async () => {
		try {
			const nextLines = await pluginManager.runTool(pluginId, lyricLines.lyricLines);
			setLyricLines((prev) => ({
				...prev,
				lyricLines: nextLines
			}));
		} catch (e) {
			console.error(`Failed to run tool ${pluginId}:`, e);
		}
	};

	return (
		<>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.segmentationTools", "Segmentation Tools")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onSelect={menu.onAutoSegment}>
						{t("topBar.menu.autoSegment", "Auto Segment")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onRubySegment}>
						{t("topBar.menu.rubySegment", "Ruby Segmentation")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onOpenAdvancedSegmentation}>
						{t("topBar.menu.advancedSegment", "Advanced Segment...")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onOpenLearnedSplits}>
						{t("topBar.menu.learnedSplits", "Learned Splits...")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Item onSelect={menu.onSyncLineTimestamps}>
				{t("topBar.menu.syncLineTimestamps", "Sync Line Timestamps")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenLatencyTest}>
				{t("settingsDialog.common.latencyTest", "Audio/input latency test")}
			</DropdownMenu.Item>
			<DropdownMenu.CheckboxItem
				checked={syncFghToHover}
				onCheckedChange={setSyncFghToHover}
				onSelect={(e) => e.preventDefault()}
			>
				{t("topBar.menu.syncFghToHover", "Sync F/G/H to Spectrogram Hover")}
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.Item onSelect={menu.onOpenTTMLChecklist}>
				{t("topBar.menu.ttmlChecklist", "TTML Checklist")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenLyricsfileConverter}>
				{t(
					"topBar.menu.lyricsfileConverter",
					"Lyricsfile Converter (TTML ↔ YAML) [BETA]",
				)}
			</DropdownMenu.Item>

			{tools.length > 0 && <DropdownMenu.Separator />}
			{tools.map(tool => (
				<DropdownMenu.Item key={tool.metadata.id} onSelect={onRunPluginTool(tool.metadata.id)}>
					{tool.metadata.name}
				</DropdownMenu.Item>
			))}
		</>
	);
};

export const ToolMenu = (props: ToolMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.tool">Tool</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<ToolMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger style={props.triggerStyle}>
					<Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.tool">Tool</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<ToolMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
