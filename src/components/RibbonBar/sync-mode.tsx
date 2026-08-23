/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/blob/main/LICENSE
 */

import {
	Checkbox,
	Flex,
	Grid,
	SegmentedControl,
	Slider,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, forwardRef, startTransition } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentLocation } from "$/modules/lyric-editor/utils/lyric-states.ts";
import {
	displayRomanizationInSyncAtom,
	enableManualTimestampEditAtom,
	enableSyncGlowAnimationAtom,
	highlightActiveWordAtom,
	highlightErrorsAtom,
	showTimestampsAtom,
	showWordRomanizationInputAtom,
} from "$/modules/settings/states/index.ts";
import {
	currentEmptyBeatAtom,
	enableTimeModeDoubleClickEditAtom,
	showTouchSyncPanelAtom,
	syncLevelModeAtom,
	syncTimeOffsetAtom,
	syncCommitOffsetAtom,
	visualizeTimestampUpdateAtom,
	type SyncLevelMode,
} from "$/modules/settings/states/sync.ts";
import { instantHighlightFadeAtom } from "$/modules/settings/states/preview";
import {
	keySyncEndAtom,
	keySyncNextAtom,
	keySyncStartAtom,
} from "$/states/keybindings.ts";

import {
	bgLyricIgnoreSyncAtom,
	lyricLinesAtom,
	showPreviewPanelAtom,
} from "$/states/main.ts";
import { KeyBinding } from "../KeyBinding/index.tsx";

import { RibbonFrame, RibbonSection } from "./common";
import { advancedRibbonControlsAtom } from "$/modules/onboarding/states";


const EmptyBeatField = () => {
	const [currentEmptyBeat, setCurrentEmptyBeat] = useAtom(currentEmptyBeatAtom);
	const currentWordEmptyBeat = useCurrentLocation()?.word.emptyBeat || 0;
	const { t } = useTranslation();

	return (
		<>
			<Text wrap="nowrap" size="1" style={{ color: "var(--ribbon-label-color)" }}>
				{t("ribbonBar.syncMode.currentEmptyBeat", "当前空拍")}
			</Text>
			<Slider
				value={[currentEmptyBeat]}
				onValueChange={(v) => setCurrentEmptyBeat(v[0])}
				min={0}
				max={currentWordEmptyBeat}
				step={1}
				disabled={currentWordEmptyBeat === 0}
			/>
			<div />
			<Text wrap="nowrap" align="center" size="1">
				{currentEmptyBeat} / {currentWordEmptyBeat}
			</Text>
		</>
	);
};

export const SyncModeRibbonBar: FC<{ isSidebar?: boolean }> = forwardRef<HTMLDivElement, { isSidebar?: boolean }>(
	({ isSidebar }, ref) => {
		const [visualizeTimestampUpdate, setVisualizeTimestampUpdate] = useAtom(
			visualizeTimestampUpdateAtom,
		);
		const [showTouchSyncPanel, setShowTouchSyncPanel] = useAtom(
			showTouchSyncPanelAtom,
		);
		const showPreviewPanel = useAtomValue(showPreviewPanelAtom);
		const rawSetShowPreviewPanel = useSetAtom(showPreviewPanelAtom);
		const [showTimestamps, setShowTimestamps] = useAtom(showTimestampsAtom);
		const [highlightErrors, setHighlightErrors] = useAtom(highlightErrorsAtom);
		const [highlightActiveWord, setHighlightActiveWord] = useAtom(
			highlightActiveWordAtom,
		);
		const [enableSyncGlowAnimation, setEnableSyncGlowAnimation] = useAtom(
			enableSyncGlowAnimationAtom,
		);
		const [enableManualTimestampEdit, setEnableManualTimestampEdit] = useAtom(
			enableManualTimestampEditAtom,
		);
		const [enableTimeModeDoubleClickEdit, setEnableTimeModeDoubleClickEdit] =
			useAtom(enableTimeModeDoubleClickEditAtom);

		const [displayRomanizationInSync, setdisplayRomanizationInSync] = useAtom(
			displayRomanizationInSyncAtom,
		);
		const [bgLyricIgnoreSync, setBgLyricIgnoreSync] = useAtom(
			bgLyricIgnoreSyncAtom,
		);
		const editLyricLines = useSetImmerAtom(lyricLinesAtom);
		const showWordRomanizationInput = useAtomValue(
			showWordRomanizationInputAtom,
		);
		const [syncTimeOffset, setSyncTimeOffset] = useAtom(syncTimeOffsetAtom);
		const [syncCommitOffset, setSyncCommitOffset] = useAtom(syncCommitOffsetAtom);
		const [syncLevelMode, setSyncLevelMode] = useAtom(syncLevelModeAtom);
		const [instantFade, setInstantFade] = useAtom(instantHighlightFadeAtom);
		const { t } = useTranslation();
		const [showAdvanced, setShowAdvanced] = useAtom(advancedRibbonControlsAtom);

		return (
			<RibbonFrame ref={ref} isSidebar={isSidebar}>
					{showAdvanced && <RibbonSection
						isSidebar={isSidebar}
						label={t("ribbonBar.syncMode.currentEmptyBeat", "当前空拍")}
					>
						<Grid
							columns="max-content 4em"
							gap="4"
							gapY="1"
							flexGrow="1"
							align="center"
						>
							<EmptyBeatField />
						</Grid>
					</RibbonSection>}
					<RibbonSection
						isSidebar={isSidebar}
						label={t("ribbonBar.syncMode.syncAdjustment", "打轴调整")}
					>
						<Grid
							columns="max-content auto"
							gap="4"
							gapY="1"
							flexGrow="1"
							align="center"
						>
							<Text
								wrap="nowrap"
								size="1"
								style={{ color: "var(--ribbon-label-color)" }}
							>
								{t("ribbonBar.syncMode.timeOffset", "时间戳位移")}
							</Text>
							<TextField.Root
								type="number"
								step={1}
								size="1"
								style={{
									width: "8em",
								}}
								value={syncTimeOffset}
								onChange={(e) => setSyncTimeOffset(e.target.valueAsNumber)}
							>
								<TextField.Slot />
								<TextField.Slot>
									<Text>ms</Text>
								</TextField.Slot>
							</TextField.Root>
							<Text
								wrap="nowrap"
								size="1"
								style={{ color: "var(--ribbon-label-color)" }}
							>
								{t("ribbonBar.syncMode.commitOffset", "Commit Offset")}
							</Text>
							<TextField.Root
								type="number"
								step={1}
								size="1"
								style={{
									width: "8em",
								}}
								value={syncCommitOffset}
								onChange={(e) => setSyncCommitOffset(e.target.valueAsNumber)}
							>
								<TextField.Slot />
								<TextField.Slot>
									<Text>ms</Text>
								</TextField.Slot>
							</TextField.Root>
							<EmptyBeatField />
						</Grid>
					</RibbonSection>
					<RibbonSection
						isSidebar={isSidebar}
						label={t("ribbonBar.syncMode.syncLevel", "Sync Level")}
					>
						<Flex
							direction="column"
							gap="2"
							align="center"
							justify="center"
							px="2"
							style={{ height: "100%" }}
						>
							<SegmentedControl.Root
								value={syncLevelMode}
								onValueChange={(v) => setSyncLevelMode(v as SyncLevelMode)}
								size="1"
							>
								<SegmentedControl.Item value="word">
									{t("ribbonBar.syncMode.syncLevelWord", "Word Sync")}
								</SegmentedControl.Item>
								<SegmentedControl.Item value="line">
									{t("ribbonBar.syncMode.syncLevelLine", "Line Sync")}
								</SegmentedControl.Item>
							</SegmentedControl.Root>
						</Flex>
					</RibbonSection>
					{showAdvanced && <RibbonSection
						isSidebar={isSidebar}
						label={t("ribbonBar.syncMode.assistSettings", "辅助设置")}
					>
						<Grid
							columns="max-content auto"
							gap="2"
							gapY="1"
							flexGrow="1"
							align="center"
						>
							<Text
								wrap="nowrap"
								size="1"
								style={{ color: "var(--ribbon-label-color)" }}
							>
								{t("ribbonBar.syncMode.showTimestampUpdate", "呈现时间戳更新")}
							</Text>
							<Checkbox
								checked={visualizeTimestampUpdate}
								onCheckedChange={(v) => setVisualizeTimestampUpdate(!!v)}
							/>
							<Text
								wrap="nowrap"
								size="1"
								style={{ color: "var(--ribbon-label-color)" }}
							>
								{t("ribbonBar.syncMode.touchSyncPanel", "触控打轴辅助面板")}
							</Text>
							<Checkbox
								checked={showTouchSyncPanel}
								onCheckedChange={(v) => setShowTouchSyncPanel(!!v)}
							/>
							<Text
								wrap="nowrap"
								size="1"
								style={{ color: "var(--ribbon-label-color)" }}
							>
								{t("ribbonBar.syncMode.bgLyricIgnoreSync", "背景歌词忽略打轴")}
							</Text>
							<Checkbox
								checked={bgLyricIgnoreSync}
								onCheckedChange={(v) => {
									const next = !!v;
									setBgLyricIgnoreSync(next);
									editLyricLines((state) => {
										for (const line of state.lyricLines) {
											if (line.isBG) {
												line.ignoreSync = next;
											}
										}
										return state;
									});
								}}
							/>
							<Text
								wrap="nowrap"
								size="1"
								style={{ color: "var(--ribbon-label-color)" }}
							>
								{t("ribbonBar.syncMode.manualTimestampEdit", "Manual Timestamp Editing")}
							</Text>
							<Checkbox
								checked={enableManualTimestampEdit}
								onCheckedChange={(v) => setEnableManualTimestampEdit(!!v)}
							/>
							<Text
								wrap="nowrap"
								size="1"
								style={{ color: "var(--ribbon-label-color)" }}
							>
								{t(
									"ribbonBar.syncMode.doubleClickEdit",
									"Double-Click Word Editing",
								)}
							</Text>
							<Checkbox
								checked={enableTimeModeDoubleClickEdit}
								onCheckedChange={(v) => setEnableTimeModeDoubleClickEdit(!!v)}
							/>
						</Grid>
					</RibbonSection>}
					{showAdvanced && <RibbonSection
						isSidebar={isSidebar}
						label={t("ribbonBar.syncMode.displayOptions", "显示选项")}
					>
						<Grid
							columns="max-content auto"
							gap="2"
							gapY="1"
							flexGrow="1"
							align="center"
						>
							<Text
								wrap="nowrap"
								size="1"
								style={{ color: "var(--ribbon-label-color)" }}
							>
								{t("ribbonBar.syncMode.showTimestamps", "显示时间戳")}
							</Text>
							<Checkbox
								checked={showTimestamps}
								onCheckedChange={(v) => setShowTimestamps(!!v)}
							/>
							<Text
								wrap="nowrap"
								size="1"
								style={{ color: "var(--ribbon-label-color)" }}
							>
								{t("ribbonBar.syncMode.highlightActiveWord", "高亮当前音节")}
							</Text>
							<Checkbox
								checked={highlightActiveWord}
								onCheckedChange={(v) => setHighlightActiveWord(!!v)}
							/>
							<Text
								wrap="nowrap"
								size="1"
								style={{ color: "var(--ribbon-label-color)" }}
							>
								{t("ribbonBar.syncMode.enableGlowAnimation", "启用高亮动态特效")}
							</Text>
							<Checkbox
								checked={enableSyncGlowAnimation}
								onCheckedChange={(v) => setEnableSyncGlowAnimation(!!v)}
							/>
							<Text
								wrap="nowrap"
								size="1"
								style={{ color: "var(--ribbon-label-color)" }}
							>
								{t("ribbonBar.previewMode.instantFade", "即时淡出")}
							</Text>
							<Checkbox
								checked={instantFade}
								onCheckedChange={(v) => setInstantFade(!!v)}
							/>

							<Text
								wrap="nowrap"
								size="1"
								style={{ color: "var(--ribbon-label-color)" }}
							>
								{t("ribbonBar.syncMode.highlightErrors", "高亮错误")}
							</Text>
							<Checkbox
								checked={highlightErrors}
								onCheckedChange={(v) => setHighlightErrors(!!v)}
							/>

							{showWordRomanizationInput && (
								<>
									<Text
										wrap="nowrap"
										size="1"
										style={{ color: "var(--ribbon-label-color)" }}
									>
										{t(
											"ribbonBar.syncMode.showPerWordRomanization",
											"显示逐字音译",
										)}
									</Text>
									<Checkbox
										checked={displayRomanizationInSync}
										onCheckedChange={(v) => setdisplayRomanizationInSync(!!v)}
									/>
								</>
							)}
						</Grid>
					</RibbonSection>}
					<RibbonSection
						isSidebar={isSidebar}
						label={t("ribbonBar.syncMode.keyBindingReference", "打轴键位速查")}
					>
						<Flex gap="4">
							<Grid
								columns="max-content auto"
								gap="4"
								gapY="1"
								flexGrow="1"
								align="center"
								justify="center"
							>
								<Text
									wrap="nowrap"
									size="1"
									style={{ color: "var(--ribbon-label-color)" }}
								>
									{t("ribbonBar.syncMode.startSync", "起始轴")}
								</Text>
								<KeyBinding kbdAtom={keySyncStartAtom} />
								<Text
									wrap="nowrap"
									size="1"
									style={{ color: "var(--ribbon-label-color)" }}
								>
									{t("ribbonBar.syncMode.continuousSync", "连续轴")}
								</Text>
								<KeyBinding kbdAtom={keySyncNextAtom} />
								<Text
									wrap="nowrap"
									size="1"
									style={{ color: "var(--ribbon-label-color)" }}
								>
									{t("ribbonBar.syncMode.endSync", "结束轴")}
								</Text>
								<KeyBinding kbdAtom={keySyncEndAtom} />
							</Grid>
						</Flex>
					</RibbonSection>
					{showAdvanced && <RibbonSection
						isSidebar={isSidebar}
						label={t("ribbonBar.editMode.previewPanel", "预览面板")}
					>
						<Flex direction="column" align="center" gap="1">
							<Switch
								checked={showPreviewPanel}
								onCheckedChange={(checked) => startTransition(() => rawSetShowPreviewPanel(checked))}
							/>
						</Flex>
					</RibbonSection>}
					<RibbonSection label={t("ribbonBar.advanced", "Advanced")} isSidebar={isSidebar}>
						<Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
					</RibbonSection>
			</RibbonFrame>
		);
	},
);

export default SyncModeRibbonBar;
