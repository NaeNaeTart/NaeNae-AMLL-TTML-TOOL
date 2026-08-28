import { Button, DropdownMenu } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { pluginManager } from "$/modules/plugins/plugin-manager";
import { spectrogramHoverSyncEnabledAtom } from "$/modules/settings/states/sync";
import { lyricLinesAtom } from "$/states/main";
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
	const [spectrogramHoverSyncEnabled, setSpectrogramHoverSyncEnabled] = useAtom(
		spectrogramHoverSyncEnabledAtom,
	);

	const tools = pluginManager.getTools();

	const onRunPluginTool = (pluginId: string) => async () => {
		try {
			const nextLines = await pluginManager.runTool(
				pluginId,
				lyricLines.lyricLines,
			);
			setLyricLines((prev) => ({
				...prev,
				lyricLines: nextLines,
			}));
		} catch (e) {
			console.error(`Failed to run tool ${pluginId}:`, e);
		}
	};

	return (
		<>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.segmentationTools", "分词")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onSelect={menu.onAutoSegment}>
						{t("topBar.menu.autoSegment", "自动分词")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onRubySegment}>
						{t("topBar.menu.rubySegment", "注音分词")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onOpenAdvancedSegmentation}>
						{t("topBar.menu.advancedSegment", "高级分词...")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onOpenLearnedSplits}>
						{t("topBar.menu.learnedSplits", "Learned Splits...")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Item onSelect={menu.onSyncLineTimestamps}>
				{t("topBar.menu.syncLineTimestamps", "同步行时间戳")}
			</DropdownMenu.Item>
			<DropdownMenu.CheckboxItem
				checked={spectrogramHoverSyncEnabled}
				onCheckedChange={setSpectrogramHoverSyncEnabled}
			>
				{t("topBar.menu.spectrogramHoverSync", "Sync to Spectrogram Cursor")}
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.Item onSelect={menu.onOpenLatencyTest}>
				{t("settingsDialog.common.latencyTest", "音频/输入延迟测试")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenTTMLChecklist}>
				{t("topBar.menu.ttmlChecklist", "TTML Checklist")}
			</DropdownMenu.Item>

			{tools.length > 0 && <DropdownMenu.Separator />}
			{tools.map((tool) => (
				<DropdownMenu.Item
					key={tool.metadata.id}
					onSelect={onRunPluginTool(tool.metadata.id)}
				>
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
					<Trans i18nKey="topBar.menu.tool">工具</Trans>
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
						<Trans i18nKey="topBar.menu.tool">工具</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<ToolMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
