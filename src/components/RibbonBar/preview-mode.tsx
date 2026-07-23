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
	Grid,
	SegmentedControl,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { type FC, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	hideObsceneWordsAtom,
	instantHighlightFadeAtom,
	lyricWordFadeWidthAtom,
	PreviewModeType,
	previewModeTypeAtom,
	showFpsCounterAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
	spicyBackgroundModeAtom,
	spicySimpleLyricsModeAtom,
	vsyncAtom,
} from "$/modules/settings/states/preview";
import { RibbonFrame, RibbonSection } from "./common";

export const PreviewModeRibbonBar: FC<{ isSidebar?: boolean }> = forwardRef<
	HTMLDivElement,
	{ isSidebar?: boolean }
>(({ isSidebar }, ref) => {
	const [previewModeType, setPreviewModeType] = useAtom(previewModeTypeAtom);
	const [showTranslationLine, setShowTranslationLine] = useAtom(
		showTranslationLinesAtom,
	);
	const [showRomanLine, setShowRomanLine] = useAtom(showRomanLinesAtom);
	const [hideObsceneWords, setHideObsceneWords] = useAtom(hideObsceneWordsAtom);
	const [lyricWordFadeWidth, setLyricWordFadeWidth] = useAtom(
		lyricWordFadeWidthAtom,
	);
	const [instantFade, setInstantFade] = useAtom(instantHighlightFadeAtom);
	const [vsync, setVsync] = useAtom(vsyncAtom);
	const [showFps, setShowFps] = useAtom(showFpsCounterAtom);
	const [spicySimpleMode, setSpicySimpleMode] = useAtom(
		spicySimpleLyricsModeAtom,
	);
	const [spicyBackgroundMode, setSpicyBackgroundMode] = useAtom(
		spicyBackgroundModeAtom,
	);
	const { t } = useTranslation();

	return (
		<RibbonFrame ref={ref} isSidebar={isSidebar}>
			<RibbonSection
				isSidebar={isSidebar}
				label={t("ribbonBar.previewMode.mode", "模式")}
			>
				<SegmentedControl.Root
					value={previewModeType}
					onValueChange={(v) => {
						if (v === PreviewModeType.AMLL) {
							toast.warn(
								t(
									"ribbonBar.previewMode.amllDeprecated",
									"AMLL 模式已弃用，请使用标准模式",
								),
							);
							return;
						}
						setPreviewModeType(v as PreviewModeType);
					}}
				>
					<SegmentedControl.Item value={PreviewModeType.Standard}>
						{t("ribbonBar.previewMode.standard", "标准")}
					</SegmentedControl.Item>
					<SegmentedControl.Item
						value={PreviewModeType.AMLL}
						style={{ opacity: 0.5 }}
					>
						{"AMLL"}
					</SegmentedControl.Item>
					<SegmentedControl.Item value={PreviewModeType.Toxi}>
						{"Toxi"}
					</SegmentedControl.Item>
					<SegmentedControl.Item value={PreviewModeType.Spicy}>
						{"Spicy"}
					</SegmentedControl.Item>
					<SegmentedControl.Item value={PreviewModeType.Timing}>
						{t("ribbonBar.previewMode.timing", "时轴")}
					</SegmentedControl.Item>
				</SegmentedControl.Root>
			</RibbonSection>
			{previewModeType === PreviewModeType.Spicy && (
				<RibbonSection isSidebar={isSidebar} label="Spicy">
					<Grid
						columns="max-content auto"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							Simple lyrics
						</Text>
						<Checkbox
							checked={spicySimpleMode}
							onCheckedChange={(v) => setSpicySimpleMode(!!v)}
						/>
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							Background
						</Text>
						<SegmentedControl.Root
							value={spicyBackgroundMode}
							onValueChange={(v) =>
								setSpicyBackgroundMode(v as typeof spicyBackgroundMode)
							}
							size="1"
						>
							<SegmentedControl.Item value="animated">
								Animated
							</SegmentedControl.Item>
							<SegmentedControl.Item value="color">Color</SegmentedControl.Item>
							<SegmentedControl.Item value="static">
								Static
							</SegmentedControl.Item>
						</SegmentedControl.Root>
					</Grid>
				</RibbonSection>
			)}
			<RibbonSection
				isSidebar={isSidebar}
				label={t("ribbonBar.previewMode.lyrics", "歌词")}
			>
				<Grid
					columns="max-content auto"
					gap="2"
					gapY="1"
					flexGrow="1"
					align="center"
				>
					<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
						{t("ribbonBar.previewMode.showTranslation", "显示翻译")}
					</Text>
					<Checkbox
						checked={showTranslationLine}
						onCheckedChange={(v) => setShowTranslationLine(!!v)}
					/>
					<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
						{t("ribbonBar.previewMode.showRoman", "显示音译")}
					</Text>
					<Checkbox
						checked={showRomanLine}
						onCheckedChange={(v) => setShowRomanLine(!!v)}
					/>
					<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
						{t("ribbonBar.previewMode.maskObsceneWords", "屏蔽不雅用语")}
					</Text>
					<Checkbox
						checked={hideObsceneWords}
						onCheckedChange={(v) => setHideObsceneWords(!!v)}
					/>
				</Grid>
			</RibbonSection>
			<RibbonSection
				isSidebar={isSidebar}
				label={t("ribbonBar.previewMode.word", "单词")}
			>
				<Grid
					columns="max-content auto"
					gap="2"
					gapY="1"
					flexGrow="1"
					align="center"
				>
					<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
						{t("ribbonBar.previewMode.fadeWidth", "过渡宽度")}
					</Text>
					<TextField.Root
						min={0}
						step={0}
						size="1"
						style={{
							width: "4em",
						}}
						defaultValue={lyricWordFadeWidth}
						onBlur={(e) => {
							const value = Number.parseFloat(e.target.value);
							if (Number.isFinite(value)) {
								setLyricWordFadeWidth(value);
							}
						}}
					/>
					<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
						{t("ribbonBar.previewMode.instantFade", "即时淡出")}
					</Text>
					<Checkbox
						checked={instantFade}
						onCheckedChange={(v) => setInstantFade(!!v)}
					/>
				</Grid>
			</RibbonSection>
			<RibbonSection
				isSidebar={isSidebar}
				label={t("ribbonBar.previewMode.render", "渲染")}
			>
				<Grid
					columns="max-content auto"
					gap="2"
					gapY="1"
					flexGrow="1"
					align="center"
				>
					<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
						{"V-Sync"}
					</Text>
					<Checkbox checked={vsync} onCheckedChange={(v) => setVsync(!!v)} />
				</Grid>
			</RibbonSection>
			<RibbonSection isSidebar={isSidebar} label={"Dev"}>
				<Grid
					columns="max-content auto"
					gap="2"
					gapY="1"
					flexGrow="1"
					align="center"
				>
					<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
						{"Show FPS"}
					</Text>
					<Checkbox
						checked={showFps}
						onCheckedChange={(v) => setShowFps(!!v)}
					/>
				</Grid>
			</RibbonSection>
		</RibbonFrame>
	);
});

export default PreviewModeRibbonBar;
