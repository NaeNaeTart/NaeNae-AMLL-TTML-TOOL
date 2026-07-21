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
	Box,
	Button,
	Flex,
	Heading,
	Text,
	TextArea,
	Theme,
} from "@radix-ui/themes";
import SuspensePlaceHolder from "$/components/SuspensePlaceHolder";
import { TouchSyncPanel } from "$/modules/lyric-editor/components/TouchSyncPanel/index.tsx";
import { log, error as logError } from "$/utils/logging.ts";
import "@radix-ui/themes/styles.css";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform, version } from "@tauri-apps/plugin-os";
import { AnimatePresence, motion } from "framer-motion";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lazy } from "$/utils/lazy.ts";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "react-i18next";
import { ToastContainer, toast } from "react-toastify";
import saveFile from "save-file";
import semverGt from "semver/functions/gt";
import { backgroundGradients } from "$/modules/settings/states/gradients";
import {
	accentColorAtom,
	backgroundModeAtom,
	boykisserModeAtom,
	customAccentColorAtom,
	customGradientAngleAtom,
	customGradientCenterAtom,
	customGradientColorsAtom,
	customGradientOpacityAtom,
	customGradientSizeAtom,
	customGradientTypeAtom,
	selectedGradientAtom,
	useCustomAccentAtom,
	useCustomGradientAtom,
	appFontAtom,
	glassmorphismBlurAtom,
	advancedPrimaryTextColorAtom,
	advancedSecondaryTextColorAtom,
	advancedWaveformColorAtom,
	advancedWaveformProgressColorAtom,
	advTitlebarBgAtom,
	advSidebarBgAtom,
	advSidebarActiveAtom,
	advMenuHoverBgAtom,
	advEditorBgAtom,
	advActiveLineBgAtom,
	advLineHoverBgAtom,
	advChipBorderRadiusAtom,
	advChipGapAtom,
	advChipPaddingVerticalAtom,
	advChipPaddingHorizontalAtom,
	advRomanizationColorAtom,
	advTranslationColorAtom,
	advAudioBarBgAtom,
	advAudioBarTextAtom,
	advScrollbarColorAtom,
	advDialogBgAtom,
	advDialogBorderAtom,
	advGlobalBorderRadiusAtom,
	advGlobalBorderWidthAtom,
	advShadowIntensityAtom,
	advSelectionColorAtom,
	advBackdropBlurAtom,
	appFontWeightAtom,
	appFontStyleAtom,
	customFontDataAtom,
	customFontNameAtom,
	appLayoutOrderAtom,
	vRibbonPositionAtom,
} from "$/modules/settings/states/index.ts";
import styles from "./App.module.css";
import DarkThemeDetector from "./components/DarkThemeDetector";
import RibbonBar from "./components/RibbonBar";
import { TitleBar } from "./components/TitleBar";
import { ResizablePanel } from "./components/ResizablePanel";
import { useFileOpener } from "./hooks/useFileOpener.ts";
import AudioControls from "./modules/audio/components/index.tsx";
import { useAudioFeedback } from "./modules/audio/hooks/useAudioFeedback.ts";
import { SyncKeyBinding } from "./modules/lyric-editor/components/sync-keybinding.tsx";
import { UrbanDictionaryKeybinding } from "./modules/lyric-editor/components/urban-dictionary-keybinding.tsx";
import { AutosaveManager } from "./modules/project/autosave/AutosaveManager.tsx";
import exportTTMLText from "./modules/project/logic/ttml-writer.ts";
import { GlobalDragOverlay } from "./modules/project/modals/GlobalDragOverlay.tsx";
import {
	customBackgroundBlurAtom,
	customBackgroundBrightnessAtom,
	customBackgroundImageAtom,
	customBackgroundImageInitAtom,
	customBackgroundMaskAtom,
	customBackgroundOpacityAtom,
} from "./modules/settings/modals/customBackground";
import { showTouchSyncPanelAtom } from "./modules/settings/states/sync.ts";
import { settingsDialogAtom, settingsTabAtom } from "./states/dialogs.ts";
import {
	isDarkThemeAtom,
	isGlobalFileDraggingAtom,
	lyricLinesAtom,
	showPreviewPanelAtom,
	ToolMode,
	toolModeAtom,
} from "./states/main.ts";
import { generateGradient, generateRadixScale } from "./utils/colorScale.ts";
import { useAppUpdate } from "./utils/useAppUpdate.ts";

const LyricLinesView = lazy(() => import("./modules/lyric-editor/components"));
const PreviewModeSwitcher = lazy(() => import("./components/PreviewModeSwitcher"));
const Dialogs = lazy(() => import("./components/Dialogs"));

const AppErrorPage = ({
	error,
	resetErrorBoundary,
}: {
	error: unknown;
	resetErrorBoundary: () => void;
}) => {
	const store = useStore();
	const { t } = useTranslation();

	return (
		<Flex direction="column" align="center" justify="center" height="100vh">
			<Flex direction="column" align="start" justify="center" gap="2">
				<Heading>{t("app.error.title", "诶呀，出错了！")}</Heading>
				<Text>
					{t("app.error.description", "AMLL TTML Tools 在运行时出现了错误")}
				</Text>
				<Text>
					{t("app.error.checkDevTools", "具体错误详情可以在开发者工具中查询")}
				</Text>
				<Flex gap="2">
					<Button
						onClick={() => {
							try {
								const ttmlText = exportTTMLText(store.get(lyricLinesAtom));
								const b = new Blob([ttmlText], { type: "text/plain" });
								saveFile(b, "lyric.ttml").catch(logError);
							} catch (e) {
								logError("Failed to save TTML file", e);
							}
						}}
					>
						{t("app.error.saveLyrics", "尝试保存当前歌词")}
					</Button>
					<Button
						onClick={() => {
							resetErrorBoundary();
						}}
						variant="soft"
					>
						{t("app.error.tryRestart", "尝试重新进入程序")}
					</Button>
				</Flex>
				<Text>{t("app.error.details", "大致错误信息：")}</Text>
				<TextArea
					readOnly
					value={String(error)}
					style={{
						width: "100%",
						height: "8em",
					}}
				/>
			</Flex>
		</Flex>
	);
};

const RainEffect: FC<{ isRaining: boolean }> = memo(({ isRaining }) => {
	const [images, setImages] = useState<{ id: string; x: number }[]>([]);
	const counterRef = useRef(0);

	useEffect(() => {
		if (!isRaining) {
			counterRef.current = 0;
			return;
		}
		const columns = 8;
		const columnIndices = Array.from({ length: columns }, (_, i) => i);
		const shuffle = (array: number[]) => {
			for (let i = array.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[array[i], array[j]] = [array[j], array[i]];
			}
			return array;
		};
		let shuffled = shuffle([...columnIndices]);

		const interval = setInterval(() => {
			if (counterRef.current % columns === 0) {
				shuffled = shuffle([...columnIndices]);
			}
			const columnIndex = shuffled[counterRef.current % columns];
			const x =
				(columnIndex * (100 / columns)) +
				(Math.random() * (100 / columns) * 0.8);
			setImages((prev) => [
				...prev,
				{ id: Math.random().toString(36).substring(7), x },
			]);
			counterRef.current++;
		}, 150);
		return () => clearInterval(interval);
	}, [isRaining]);

	return (
		<>
			{images.map((img) => (
				<motion.img
					key={img.id}
					src="https://images.weserv.nl/?url=https://files.catbox.moe/5n0ofa.gif&n=-1"
					alt=""
					referrerPolicy="no-referrer"
					initial={{ y: -120, x: `${img.x}vw`, opacity: 1 }}
					animate={{ y: "110vh" }}
					transition={{ duration: 2, ease: "linear" }}
					onAnimationComplete={() => {
						setImages((prev) => prev.filter((i) => i.id !== img.id));
					}}
					style={{
						position: "fixed",
						top: 0,
						left: 0,
						width: "120px",
						height: "120px",
						zIndex: 2147483647,
						pointerEvents: "none",
						objectFit: "contain",
					}}
				/>
			))}
		</>
	);
});


function App() {
	const isDarkTheme = useAtomValue(isDarkThemeAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const showTouchSyncPanel = useAtomValue(showTouchSyncPanelAtom);
	const showPreviewPanel = useAtomValue(showPreviewPanelAtom);
	// Preview mode already owns the entire editor area. Keep the sync preview
	// pane's setting intact for when the user returns, but never render a second
	// preview beside it.
	const previewPanelVisible =
		showPreviewPanel && toolMode !== ToolMode.Preview;
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const customBackgroundOpacity = useAtomValue(customBackgroundOpacityAtom);
	const customBackgroundMask = useAtomValue(customBackgroundMaskAtom);
	const customBackgroundBlur = useAtomValue(customBackgroundBlurAtom);
	const customBackgroundBrightness = useAtomValue(
		customBackgroundBrightnessAtom,
	);
	const accentColor = useAtomValue(accentColorAtom);
	const useCustomAccent = useAtomValue(useCustomAccentAtom);
	const customAccentColor = useAtomValue(customAccentColorAtom);

	const useCustomGradient = useAtomValue(useCustomGradientAtom);
	const customGradientColors = useAtomValue(customGradientColorsAtom);
	const customGradientType = useAtomValue(customGradientTypeAtom);
	const customGradientOpacity = useAtomValue(customGradientOpacityAtom);
	const customGradientCenter = useAtomValue(customGradientCenterAtom);
	const customGradientAngle = useAtomValue(customGradientAngleAtom);
	const customGradientSize = useAtomValue(customGradientSizeAtom);
	const appFont = useAtomValue(appFontAtom);
	const appFontWeight = useAtomValue(appFontWeightAtom);
	const appFontStyle = useAtomValue(appFontStyleAtom);
	const customFontData = useAtomValue(customFontDataAtom);
	const customFontName = useAtomValue(customFontNameAtom);
	const glassmorphismBlur = useAtomValue(glassmorphismBlurAtom);
	const advPrimaryText = useAtomValue(advancedPrimaryTextColorAtom);
	const advSecondaryText = useAtomValue(advancedSecondaryTextColorAtom);
	const advWaveformColor = useAtomValue(advancedWaveformColorAtom);
	const advWaveformProgress = useAtomValue(advancedWaveformProgressColorAtom);
	
	const vTitlebarBg = useAtomValue(advTitlebarBgAtom);
	const vSidebarBg = useAtomValue(advSidebarBgAtom);
	const vSidebarActive = useAtomValue(advSidebarActiveAtom);
	const vMenuHover = useAtomValue(advMenuHoverBgAtom);
	const vEditorBg = useAtomValue(advEditorBgAtom);
	const vActiveLine = useAtomValue(advActiveLineBgAtom);
	const vLineHover = useAtomValue(advLineHoverBgAtom);
	const vChipRadius = useAtomValue(advChipBorderRadiusAtom);
	const vChipGap = useAtomValue(advChipGapAtom);
	const vChipPaddingV = useAtomValue(advChipPaddingVerticalAtom);
	const vChipPaddingH = useAtomValue(advChipPaddingHorizontalAtom);
	const vRomanColor = useAtomValue(advRomanizationColorAtom);
	const vTransColor = useAtomValue(advTranslationColorAtom);
	const vAudioBarBg = useAtomValue(advAudioBarBgAtom);
	const vAudioBarText = useAtomValue(advAudioBarTextAtom);
	const vScrollbar = useAtomValue(advScrollbarColorAtom);
	const vDialogBg = useAtomValue(advDialogBgAtom);
	const vDialogBorder = useAtomValue(advDialogBorderAtom);
	const vGlobalRadius = useAtomValue(advGlobalBorderRadiusAtom);
	const vGlobalBorderWidth = useAtomValue(advGlobalBorderWidthAtom);
	const vShadow = useAtomValue(advShadowIntensityAtom);
	const vSelection = useAtomValue(advSelectionColorAtom);
	const vBackdropBlur = useAtomValue(advBackdropBlurAtom);
	const appLayoutOrder = useAtomValue(appLayoutOrderAtom);
	const vRibbonPosition = useAtomValue(vRibbonPositionAtom);

	const boykisserMode = useAtomValue(boykisserModeAtom);
	const [isRaining, setIsRaining] = useState(false);

	const startRain = useCallback(() => {
		if (isRaining) return;
		setIsRaining(true);
		setTimeout(() => setIsRaining(false), 3000);
	}, [isRaining]);



	useEffect(() => {
		// Extract font name from appFont string (e.g., '"Inter", sans-serif' -> 'Inter')
		const match = appFont.match(/"([^"]+)"/);
		if (match) {
			const fontName = match[1];
			// Only load if it's not the custom font and not a system default
			if (
				fontName !== customFontName &&
				!["MiSans", "Inter", "system-ui"].includes(fontName)
			) {
				const fontId = `google-font-${fontName.replace(/\s+/g, "-")}`;
				if (!document.getElementById(fontId)) {
					const link = document.createElement("link");
					link.id = fontId;
					link.rel = "stylesheet";
					// Load Regular(400), Bold(700) and their Italic versions
					link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, "+")}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
					document.head.appendChild(link);
				}
			}
		}
	}, [appFont, customFontName]);

	const customThemeStyles = useCustomAccent
		? generateRadixScale(customAccentColor, isDarkTheme)
		: null;

	const customStyleString = useMemo(() => {
		let vars = "";
		if (customThemeStyles) {
			vars += Object.entries(customThemeStyles)
				.map(([k, v]) => `${k}: ${v} !important;`)
				.join("\n\t\t");
		}

		let customFontFace = "";
		if (customFontData && customFontName) {
			customFontFace = `
			@font-face {
				font-family: "${customFontName}";
				src: url("${customFontData}");
				font-weight: normal;
				font-style: normal;
			}
			`;
		}

		return `
		${customFontFace}
		:root {
			--default-font-family: ${appFont} !important;
		}
		.radix-themes {
			--default-font-family: ${appFont} !important;
			--glass-blur: ${glassmorphismBlur}px !important;
			--backdrop-blur: ${glassmorphismBlur}px !important;
			${advPrimaryText ? `--gray-12: ${advPrimaryText} !important;` : ""}
			${advSecondaryText ? `--gray-11: ${advSecondaryText} !important;` : ""}
			${advWaveformColor ? `--adv-waveform-color: ${advWaveformColor} !important;` : ""}
			${advWaveformProgress ? `--adv-waveform-progress: ${advWaveformProgress} !important;` : ""}
			
			${vTitlebarBg ? `--titlebar-bg: ${vTitlebarBg} !important;` : ""}
			${vSidebarBg ? `--sidebar-bg: ${vSidebarBg} !important;` : ""}
			${vSidebarActive ? `--sidebar-active: ${vSidebarActive} !important;` : ""}
			${vMenuHover ? `--menu-hover: ${vMenuHover} !important;` : ""}
			${vEditorBg ? `--editor-bg: ${vEditorBg} !important;` : ""}
			${vActiveLine ? `--active-line-bg: ${vActiveLine} !important;` : ""}
			${vLineHover ? `--line-hover-bg: ${vLineHover} !important;` : ""}
			${vSelection ? `--selection-color: ${vSelection} !important;` : ""}
			
			--chip-radius: ${vChipRadius}px !important;
			--chip-gap: ${vChipGap}px !important;
			--chip-padding-v: ${vChipPaddingV}px !important;
			--chip-padding-h: ${vChipPaddingH}px !important;
			
			${vRomanColor ? `--romanization-color: ${vRomanColor} !important;` : ""}
			${vTransColor ? `--translation-color: ${vTransColor} !important;` : ""}
			
			${vAudioBarBg ? `--audio-bar-bg: ${vAudioBarBg} !important;` : ""}
			${vAudioBarText ? `--audio-bar-text: ${vAudioBarText} !important;` : ""}
			
			${vScrollbar ? `--scrollbar-thumb-color: ${vScrollbar} !important;` : ""}
			${vDialogBg ? `--dialog-bg: ${vDialogBg} !important;` : ""}
			${vDialogBorder ? `--dialog-border: ${vDialogBorder} !important;` : ""}
			
			--global-radius: ${vGlobalRadius}px !important;
			--global-border-width: ${vGlobalBorderWidth}px !important;
			--shadow-intensity: ${vShadow} !important;
			--custom-backdrop-blur: ${vBackdropBlur}px !important;

			--radius-factor: ${vGlobalRadius / 12} !important;

			/* Comprehensive Overrides */
			${vTitlebarBg ? `--color-panel-translucent: ${vTitlebarBg} !important;` : ""}
			${vEditorBg ? `--color-background: ${vEditorBg} !important;` : ""}
			${vSelection ? `--accent-a5: ${vSelection} !important;` : ""}
			${vDialogBg ? `--rt-color-panel-solid: ${vDialogBg} !important;` : ""}
			
			/* Shadow Scaling */
			--shadow-intensity: ${vShadow};
			--rt-shadow-color: rgba(0, 0, 0, calc(0.1 * var(--shadow-intensity)));
			--shadow-1: 0 1px 2px var(--rt-shadow-color);
			--shadow-2: 0 3px 6px var(--rt-shadow-color);
			--shadow-3: 0 10px 20px var(--rt-shadow-color);
			--shadow-4: 0 15px 30px var(--rt-shadow-color);
			--shadow-5: 0 20px 40px var(--rt-shadow-color);
			--shadow-6: 0 25px 50px var(--rt-shadow-color);

			/* Sidebar & Global Navigation */
			${vSidebarBg ? `--sidebar-bg: ${vSidebarBg} !important;` : ""}
			${vSidebarActive ? `--sidebar-active: ${vSidebarActive} !important;` : ""}
			${vMenuHover ? `--rt-menu-item-hover-bg: ${vMenuHover} !important;` : ""}
			${vMenuHover ? `--menu-hover: ${vMenuHover} !important;` : ""}

			font-family: var(--default-font-family);
			font-weight: ${appFontWeight} !important;
			font-style: ${appFontStyle} !important;
			${vars}
		}
		`;
	}, [
		customThemeStyles,
		appFont,
		glassmorphismBlur,
		advPrimaryText,
		advSecondaryText,
		advWaveformColor,
		advWaveformProgress,
		vTitlebarBg,
		vSidebarBg,
		vSidebarActive,
		vMenuHover,
		vEditorBg,
		vActiveLine,
		vLineHover,
		vChipRadius,
		vChipGap,
		vChipPaddingV,
		vChipPaddingH,
		vRomanColor,
		vTransColor,
		vAudioBarBg,
		vAudioBarText,
		vScrollbar,
		vDialogBg,
		vDialogBorder,
		vGlobalRadius,
		vGlobalBorderWidth,
		vShadow,
		vSelection,
		vBackdropBlur,
		appFontWeight,
		appFontStyle,
		customFontData,
		customFontName,
	]);

	const backgroundMode = useAtomValue(backgroundModeAtom);
	const selectedGradientId = useAtomValue(selectedGradientAtom);
	const selectedGradient = backgroundGradients.find(
		(g) => g.id === selectedGradientId,
	);

	const [hasBackground, setHasBackground] = useState(false);
	const effectiveTheme = isDarkTheme ? "dark" : "light";

	useEffect(() => {
		setHasBackground(
			backgroundMode !== "none" &&
				!!(customBackgroundImage || selectedGradient),
		);
	}, [backgroundMode, customBackgroundImage, selectedGradient]);
	const { checkUpdate, status, update } = useAppUpdate();
	const hasNotifiedRef = useRef(false);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const initCustomBackgroundImage = useSetAtom(customBackgroundImageInitAtom);
	const { t } = useTranslation();
	const store = useStore();

	useEffect(() => {
		initCustomBackgroundImage();
	}, [initCustomBackgroundImage]);

	useEffect(() => {
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			checkUpdate(true);
		}
	}, [checkUpdate]);

	useEffect(() => {
		if (status === "available" && update && !hasNotifiedRef.current) {
			hasNotifiedRef.current = true;

			toast.info(
				<div>
					<div style={{ fontWeight: "bold" }}>
						{t("app.update.updateAvailable", "发现新版本: {version}", {
							version: update.version,
						})}
					</div>
				</div>,
				{
					autoClose: 5000,
					onClick: () => {
						setSettingsTab("about");
						setSettingsOpen(true);
					},
				},
			);
		}
	}, [status, update, t, setSettingsOpen, setSettingsTab]);

	const setIsGlobalDragging = useSetAtom(isGlobalFileDraggingAtom);
	const { openFile } = useFileOpener();
	useAudioFeedback();

	useEffect(() => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) {
			return;
		}

		(async () => {
			const file: {
				filename: string;
				data: string;
				ext: string;
			} | null = await invoke("get_open_file_data");

			if (file) {
				log("File data from tauri args", file);

				const fileObj = new File([file.data], file.filename, {
					type: "text/plain",
				});

				openFile(fileObj);
			}
		})();
	}, [openFile]);

	useEffect(() => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) {
			return;
		}

		(async () => {
			const win = getCurrentWindow();
			if (platform() === "windows") {
				if (semverGt("10.0.22000", version())) {
					setHasBackground(true);
					await win.clearEffects();
				}
			}

			await new Promise((r) => requestAnimationFrame(r));

			await win.show();
		})();
	}, []);

	useEffect(() => {
		const onBeforeClose = (evt: BeforeUnloadEvent) => {
			const currentLyricLines = store.get(lyricLinesAtom);
			if (
				currentLyricLines.lyricLines.length +
					currentLyricLines.metadata.length >
				0
			) {
				evt.preventDefault();
				evt.returnValue = false;
			}
		};
		window.addEventListener("beforeunload", onBeforeClose);
		return () => {
			window.removeEventListener("beforeunload", onBeforeClose);
		};
	}, [store]);


	useEffect(() => {
		const handleDragEnter = (e: DragEvent) => {
			if (e.dataTransfer?.types.includes("Files")) {
				setIsGlobalDragging(true);
			}
		};

		const handleDragOver = (e: DragEvent) => {
			e.preventDefault();
		};

		const handleDragLeave = (e: DragEvent) => {
			if (e.relatedTarget === null) {
				setIsGlobalDragging(false);
			}
		};

		const handleDrop = (e: DragEvent) => {
			e.preventDefault();
			setIsGlobalDragging(false);

			const files = e.dataTransfer?.files;
			if (files && files.length > 0) {
				openFile(files[0]);
			}
		};

		window.addEventListener("dragenter", handleDragEnter);
		window.addEventListener("dragover", handleDragOver);
		window.addEventListener("dragleave", handleDragLeave);
		window.addEventListener("drop", handleDrop);

		return () => {
			window.removeEventListener("dragenter", handleDragEnter);
			window.removeEventListener("dragover", handleDragOver);
			window.removeEventListener("dragleave", handleDragLeave);
			window.removeEventListener("drop", handleDrop);
		};
	}, [setIsGlobalDragging, openFile]);

	return (
		<Theme
			appearance={effectiveTheme}
			panelBackground="translucent"
			hasBackground={hasBackground}
			accentColor={accentColor}
			className={styles.radixTheme}
		>
			{customStyleString ? <style>{customStyleString}</style> : null}
			<ErrorBoundary
				FallbackComponent={AppErrorPage}
				onReset={(_details) => {
					// TODO
				}}
			>
				{hasBackground && (
					<div className={styles.customBackgroundLayer} aria-hidden="true">
						<div
							className={styles.customBackgroundImage}
							style={{
								backgroundImage:
									backgroundMode === "image"
										? `url(${customBackgroundImage})`
										: useCustomGradient
											? generateGradient(
													customGradientColors,
													customGradientType,
													customGradientCenter,
													customGradientAngle,
													customGradientSize,
												)
											: selectedGradient?.css,
								opacity:
									backgroundMode === "gradient"
										? customGradientOpacity
										: customBackgroundOpacity,
								filter: `blur(${customBackgroundBlur}px) brightness(${customBackgroundBrightness})`,
							}}
						/>
						<div
							className={styles.customBackgroundMask}
							style={{
								opacity:
									backgroundMode === "gradient" ? 0 : customBackgroundMask,
							}}
						/>
					</div>
				)}
				<div className={styles.appContent}>
					<AutosaveManager />
					<GlobalDragOverlay />
					{toolMode === ToolMode.Sync && <SyncKeyBinding />}
					<UrbanDictionaryKeybinding />
					<DarkThemeDetector />
					<Flex direction="column" height="100vh">
						{appLayoutOrder.map((id) => {
							if (id === "titlebar") return <TitleBar key="titlebar" />;
							if (id === "ribbonbar" && (vRibbonPosition === "top" || vRibbonPosition === "bottom")) {
								return <RibbonBar key="ribbonbar" position={vRibbonPosition} />;
							}
							if (id === "editor") {
								const editorContent = (
									<Box flexGrow="1" overflow="hidden" key="editor-content">
										{previewPanelVisible ? (
											<Flex height="100%" gap="2" p="2">
												<Box flexGrow="1" overflow="hidden">
													<AnimatePresence mode="wait">
														{toolMode !== ToolMode.Preview && (
															<SuspensePlaceHolder key={toolMode}>
																<motion.div
																	layout="position"
																	style={{
																		height: "100%",
																		maxHeight: "100%",
																		overflowY: "hidden",
																	}}
																	initial={{ opacity: 0 }}
																	animate={{ opacity: 1 }}
																	exit={{ opacity: 0 }}
																>
																	<LyricLinesView key={toolMode} />
																</motion.div>
															</SuspensePlaceHolder>
														)}
														{toolMode === ToolMode.Preview && (
															<SuspensePlaceHolder key="preview-switcher">
																<motion.div
																	layout="position"
																	initial={{ opacity: 0 }}
																	animate={{ opacity: 1 }}
																	exit={{ opacity: 0 }}
																>
																	<PreviewModeSwitcher />
																</motion.div>
															</SuspensePlaceHolder>
														)}
													</AnimatePresence>
												</Box>
												<ResizablePanel>
													<SuspensePlaceHolder key="preview-panel">
														<motion.div
															layout="position"
															initial={{ opacity: 0 }}
															animate={{ opacity: 1 }}
															exit={{ opacity: 0 }}
															style={{ height: "100%" }}
														>
															<PreviewModeSwitcher />
														</motion.div>
													</SuspensePlaceHolder>
												</ResizablePanel>
											</Flex>
										) : (
											<AnimatePresence mode="wait">
												{toolMode !== ToolMode.Preview && (
													<SuspensePlaceHolder key={toolMode}>
														<motion.div
															layout="position"
															style={{
																height: "100%",
																maxHeight: "100%",
																overflowY: "hidden",
															}}
															initial={{ opacity: 0 }}
															animate={{ opacity: 1 }}
															exit={{ opacity: 0 }}
														>
															<LyricLinesView key={toolMode} />
														</motion.div>
													</SuspensePlaceHolder>
												)}
												{toolMode === ToolMode.Preview && (
													<SuspensePlaceHolder key="preview-switcher">
														<Box height="100%" key="preview-switcher" p="2" asChild>
															<motion.div
																layout="position"
																initial={{ opacity: 0 }}
																animate={{ opacity: 1 }}
																exit={{ opacity: 0 }}
															>
																<PreviewModeSwitcher />
															</motion.div>
														</Box>
													</SuspensePlaceHolder>
												)}
											</AnimatePresence>
										)}
									</Box>
								);

								if (vRibbonPosition === "left" || vRibbonPosition === "right") {
									return (
										<Flex direction="row" flexGrow="1" overflow="hidden" key="editor-row">
											{vRibbonPosition === "left" && (
                                                <RibbonBar isSidebar position="left" />
                                            )}
											{editorContent}
											{vRibbonPosition === "right" && (
                                                <RibbonBar isSidebar position="right" />
                                            )}
										</Flex>
									);
								}
								return editorContent;
							}
							if (id === "audio-controls") {
								return (
                                    <Box flexShrink="0" key="audio-controls">
                                        <AudioControls />
                                    </Box>
								);
							}
							return null;
						})}
						{showTouchSyncPanel && toolMode === ToolMode.Sync && (
							<TouchSyncPanel />
						)}
					</Flex>
					<Suspense fallback={null}>
						<Dialogs />
					</Suspense>
					<ToastContainer theme={effectiveTheme} />
					{boykisserMode && (
						<img
							src="https://images.weserv.nl/?url=https://files.catbox.moe/5n0ofa.gif&n=-1"
							alt=""
							referrerPolicy="no-referrer"
							onClick={startRain}
							style={{
								position: "fixed",
								top: "28px",
								right: "120px",
								width: "20px",
								height: "20px",
								pointerEvents: "auto",
								cursor: "pointer",
								zIndex: 9999,
								objectFit: "contain",
							}}
						/>
					)}
				</div>
				<RainEffect isRaining={isRaining} />
			</ErrorBoundary>
		</Theme>
	);
}

export default App;
