import {
	ClockRegular,
	EyeFilled,
	EyeOffFilled,
	MusicNote2Filled,
	SettingsFilled,
} from "@fluentui/react-icons";
import {
	Button,
	Flex,
	IconButton,
	Popover,
	Select,
	Slider,
	Text,
	Theme,
	Tooltip,
} from "@radix-ui/themes";
import { produce } from "immer";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import {
	type FC,
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useFileOpener } from "$/hooks/useFileOpener.ts";
import { audioEngine } from "$/modules/audio/audio-engine.ts";
import {
	audioBufferAtom,
	auditionTimeAtom,
	currentTimeAtom,
} from "$/modules/audio/states/index.ts";
import { cmdDuplicatePaste } from "$/modules/keyboard/commands.ts";
import { useCommand } from "$/modules/keyboard/hooks.ts";
import {
	draggingIdAtom,
	globalEnableInsertAtom,
} from "$/modules/lyric-editor/components/lyric-line-view-states.ts";
import { useReversePlaybackZone } from "$/modules/spectrogram/hooks/useReversePlaybackZone.ts";
import { useScrubbing } from "$/modules/spectrogram/hooks/useScrubbing";
import { useSpectrogramInteraction } from "$/modules/spectrogram/hooks/useSpectrogramInteraction.ts";
import { useSpectrogramResize } from "$/modules/spectrogram/hooks/useSpectrogramResize.ts";
import { useSpectrogramSelection } from "$/modules/spectrogram/hooks/useSpectrogramSelection.ts";
import { useSpectrogramWorker } from "$/modules/spectrogram/hooks/useSpectrogramWorker.ts";
import { useTimelineEditing } from "$/modules/spectrogram/hooks/useTimelineEditing.ts";
import {
	currentPaletteAtom,
	spectrogramContainerWidthAtom,
	spectrogramFftSizeAtom,
	spectrogramGainAtom,
	spectrogramHeightAtom,
	spectrogramHoverFrequencyAtom,
	spectrogramHoverPxAtom,
	spectrogramHoverPyAtom,
	spectrogramHoverTimeMsAtom,
	spectrogramIsHoveringAtom,
	spectrogramSelectionAtom,
} from "$/modules/spectrogram/states";
import { isDraggingAtom } from "$/modules/spectrogram/states/dnd.ts";
import { reversePlaybackStartAtom } from "$/modules/spectrogram/states/reverse-playback";
import {
	timeShiftPreviewActiveAtom,
} from "$/states/dialogs.ts";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	showUnselectedLinesAtom,
} from "$/states/main.ts";
import { newLyricLine, newLyricWord } from "$/types/ttml.ts";
import { openFileWithDialog } from "$/utils/fileDialog.ts";
import { msToTimestamp } from "$/utils/timestamp.ts";
import styles from "./AudioSpectrogram.module.css";
import { FrequencyRuler } from "./FrequencyRuler.tsx";
import { LyricTimelineOverlay } from "./LyricTimelineOverlay.tsx";
import { ReversePlaybackZone } from "./ReversePlaybackZone.tsx";
import {
	type ISpectrogramContext,
	SpectrogramContext,
} from "./SpectrogramContext.ts";
import { TileComponent, type TileComponentProps } from "./TileComponent.tsx";
import {
	RULER_HEIGHT,
	TimelineRuler,
	type TimelineRulerHandle,
} from "./TimelineRuler.tsx";
import { TimeShiftToolbar } from "./TimeShiftToolbar.tsx";

const TILE_DURATION_S = 5;
const LOD_WIDTHS = [512, 1024, 2048, 4096, 8192];

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const getNoteFromFreq = (freq: number) => {
	if (freq <= 20) return "";
	const n = Math.round(69 + 12 * Math.log2(freq / 440));
	const octave = Math.floor(n / 12) - 1;
	const noteName = NOTES[((n % 12) + 12) % 12];
	return `${noteName}${octave}`;
};

export const AudioSpectrogram: FC = memo(() => {
	const audioBuffer = useAtomValue(audioBufferAtom);
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const auditionTime = useAtomValue(auditionTimeAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const store = useStore();

	const [gain, setGain] = useAtom(spectrogramGainAtom);
	const [dataHeight, setDataHeight] = useAtom(spectrogramHeightAtom);
	const [fftSize, setFftSize] = useAtom(spectrogramFftSizeAtom);
	const [showUnselectedLines, setShowUnselectedLines] = useAtom(
		showUnselectedLinesAtom,
	);
	const globalEnableInsert = useAtomValue(globalEnableInsertAtom);
	const setPreviewActive = useSetAtom(timeShiftPreviewActiveAtom);

	useCommand(cmdDuplicatePaste, () => {
		if (!globalEnableInsert) return;

		const currentSelectedLines = store.get(selectedLinesAtom);
		if (currentSelectedLines.size === 0) return;

		const state = store.get(lyricLinesAtom);
		const linesToCopy = state.lyricLines.filter((l) =>
			currentSelectedLines.has(l.id),
		);
		if (linesToCopy.length === 0) return;

		const selection = store.get(spectrogramSelectionAtom);
		const currentTimeMs = store.get(currentTimeAtom);

		let newLines: any[] = [];

		if (selection) {
			const totalDuration = selection.end - selection.start;
			const lineCount = linesToCopy.length;
			const lineDuration = totalDuration / lineCount;

			newLines = linesToCopy.map((l, i) => {
				const lineStart = Math.round(selection.start + i * lineDuration);
				const lineEnd = Math.round(selection.start + (i + 1) * lineDuration);
				const duration = lineEnd - lineStart;

				const nl = {
					...l,
					id: newLyricLine().id,
					startTime: lineStart,
					endTime: lineEnd,
					words: l.words.map((w) => ({
						...w,
						id: newLyricWord().id,
						startTime: 0,
						endTime: 0,
					})),
				};

				const nonEmptyWords = nl.words.filter((w) => w.word.trim() !== "");
				if (nonEmptyWords.length > 0) {
					const perWordDur = duration / nonEmptyWords.length;
					let wordIdx = 0;
					for (const w of nl.words) {
						if (w.word.trim() !== "") {
							w.startTime = Math.round(lineStart + wordIdx * perWordDur);
							w.endTime = Math.round(lineStart + (wordIdx + 1) * perWordDur);
							wordIdx++;
						} else {
							w.startTime = lineStart;
							w.endTime = lineStart;
						}
					}
					const lastNonEmpty = nl.words
						.slice()
						.reverse()
						.find((w) => w.word.trim() !== "");
					if (lastNonEmpty) lastNonEmpty.endTime = lineEnd;
				} else {
					nl.startTime = lineStart;
					nl.endTime = lineEnd;
				}

				return nl;
			});
		} else {
			const minStart = Math.min(...linesToCopy.map((l) => l.startTime));
			const offset = currentTimeMs - minStart;

			newLines = linesToCopy.map((l) => ({
				...l,
				id: newLyricLine().id,
				startTime: l.startTime + offset,
				endTime: l.endTime + offset,
				words: l.words.map((w) => ({
					...w,
					id: newLyricWord().id,
					startTime: w.startTime + offset,
					endTime: w.endTime + offset,
					ruby: w.ruby?.map((r) => ({
						...r,
						startTime: r.startTime + offset,
						endTime: r.endTime + offset,
					})),
				})),
			}));
		}

		store.set(
			lyricLinesAtom,
			produce((draft) => {
				const anchorTime = selection ? selection.start : currentTimeMs;
				let insertIndex = draft.lyricLines.findIndex(
					(l: any) => l.startTime > anchorTime,
				);
				if (insertIndex === -1) insertIndex = draft.lyricLines.length;

				draft.lyricLines.splice(insertIndex, 0, ...newLines);
			}),
		);

		if (selection) {
			store.set(spectrogramSelectionAtom, null);
		}
	}, [globalEnableInsert, store]);

	const { height: uiHeight, resizeHandleProps } = useSpectrogramResize({
		initialHeight: dataHeight,
		onCommit: setDataHeight,
	});
	const palette = useAtomValue(currentPaletteAtom);
	const [visibleTiles, setVisibleTiles] = useState<TileComponentProps[]>([]);

	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const [containerWidth, setContainerWidth] = useAtom(
		spectrogramContainerWidthAtom,
	);

	const { zoom, scrollLeft, isZooming } = useSpectrogramInteraction(
		scrollContainerRef,
		containerWidth,
	);

	const [isHovering, setIsHovering] = useState(false);
	const setGlobalIsHovering = useSetAtom(spectrogramIsHoveringAtom);
	const hoverPx = useAtomValue(spectrogramHoverPxAtom);
	const setHoverPx = useSetAtom(spectrogramHoverPxAtom);
	const setHoverPy = useSetAtom(spectrogramHoverPyAtom);
	const hoverTimeMs = useAtomValue(spectrogramHoverTimeMsAtom);
	const hoverFrequency = useAtomValue(spectrogramHoverFrequencyAtom);
	const isDragging = useAtomValue(isDraggingAtom);
	const reversePlaybackStart = useAtomValue(reversePlaybackStartAtom);
	const { reverseZone, cancelZone } = useReversePlaybackZone();

	const rulerRef = useRef<TimelineRulerHandle>(null);

	useEffect(() => {
		return () => setGlobalIsHovering(false);
	}, [setGlobalIsHovering]);

	const { openFile } = useFileOpener();
	const handleLoadMusic = useCallback(async () => {
		const file = await openFileWithDialog({
			multiple: false,
			filters: [
				{
					name: "Audio",
					extensions: ["mp3", "flac", "wav", "ogg", "m4a", "opus", "webm"],
				},
			],
		});
		if (!file || Array.isArray(file)) return;
		openFile(file);
	}, [openFile]);

	const { t } = useTranslation();

	const { tileCache, requestTileIfNeeded, lastTileTimestamp } =
		useSpectrogramWorker(audioBuffer, palette.data);

	const {
		handleContainerMouseDown: handleTimelineMouseDown,
		isInvalidEndTime,
		pendingCursorPosition,
		showRangePreview,
		previewStyle,
		editingTimeField,
	} = useTimelineEditing(scrollLeft, zoom);

	const { handleSelectionMouseDown, selectionStyle } = useSpectrogramSelection(
		scrollLeft,
		zoom,
	);

	const handleCompositeMouseDown = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (e.button !== 0) return;
			handleTimelineMouseDown(e);
			handleSelectionMouseDown(e);
		},
		[handleTimelineMouseDown, handleSelectionMouseDown],
	);

	const contextValue = useMemo<ISpectrogramContext>(
		() => ({
			scrollContainerRef,
			zoom,
			scrollLeft,
		}),
		[zoom, scrollLeft],
	);

	const updateVisibleTiles = useCallback(() => {
		if (!audioBuffer || !scrollContainerRef.current) return;

		const pixelsPerSecond = zoom;
		const tileDisplayWidthPx = TILE_DURATION_S * pixelsPerSecond;
		const totalTiles = Math.ceil(audioBuffer.duration / TILE_DURATION_S);

		const viewStart = scrollLeft;
		const viewEnd = viewStart + containerWidth;

		const firstVisibleIndex = Math.floor(viewStart / tileDisplayWidthPx);
		const lastVisibleIndex = Math.ceil(viewEnd / tileDisplayWidthPx);

		const newVisibleTiles: TileComponentProps[] = [];

		const currentPaletteId = palette.id;

		for (let i = firstVisibleIndex - 2; i <= lastVisibleIndex + 2; i++) {
			if (i < 0 || i >= totalTiles) continue;

			const cacheId = `tile-${i}`;
			const targetLodWidth =
				LOD_WIDTHS.find((w) => w >= tileDisplayWidthPx) ||
				LOD_WIDTHS[LOD_WIDTHS.length - 1];

			requestTileIfNeeded({
				tileIndex: i,
				startTime: i * TILE_DURATION_S,
				endTime: i * TILE_DURATION_S + TILE_DURATION_S,
				gain: gain,
				height: dataHeight,
				tileWidthPx: targetLodWidth,
				paletteId: currentPaletteId,
				fftSize: fftSize,
			});

			const cacheEntry = tileCache.current.get(cacheId);
			const currentBitmap = cacheEntry?.bitmap;

			newVisibleTiles.push({
				tileId: cacheId,
				left: i * tileDisplayWidthPx,
				width: tileDisplayWidthPx,
				height: dataHeight,
				canvasWidth: currentBitmap?.width || targetLodWidth,
				bitmap: currentBitmap,
			});
		}
		setVisibleTiles(newVisibleTiles);
	}, [
		audioBuffer,
		containerWidth,
		gain,
		dataHeight,
		requestTileIfNeeded,
		tileCache,
		palette.id,
		zoom,
		scrollLeft,
		fftSize,
	]);

	const updateVisibleTilesRef = useRef(updateVisibleTiles);
	useLayoutEffect(() => {
		updateVisibleTilesRef.current = updateVisibleTiles;
	}, [updateVisibleTiles]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: lastTileTimestamp 用来重运行这个 effect
	useEffect(() => {
		updateVisibleTiles();
	}, [updateVisibleTiles, lastTileTimestamp]);

	const handleRulerSeek = (timeInSeconds: number) => {
		audioEngine.seekMusic(timeInSeconds);
		setCurrentTime(Math.round(timeInSeconds * 1000));
	};

	useLayoutEffect(() => {
		if (lastTileTimestamp === 0) {
			return;
		}
		rulerRef.current?.draw(scrollLeft);
		updateVisibleTilesRef.current();
	}, [scrollLeft, lastTileTimestamp]);

	useLayoutEffect(() => {
		if (lastTileTimestamp === 0 && !audioBuffer) {
			return;
		}
		rulerRef.current?.draw(scrollLeft);
		updateVisibleTilesRef.current();
	}, [scrollLeft, lastTileTimestamp, audioBuffer]);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!audioBuffer || !container) return;

		const observer = new ResizeObserver((entries) => {
			if (entries[0]) {
				setContainerWidth(entries[0].contentRect.width);
			}
		});

		observer.observe(container);
		setContainerWidth(container.clientWidth);

		return () => observer.disconnect();
	}, [setContainerWidth, audioBuffer]);

	const handleMouseEnter = () => {
		setIsHovering(true);
		setGlobalIsHovering(true);
	};
	const handleMouseLeave = () => {
		setIsHovering(false);
		setGlobalIsHovering(false);
	};
	const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
		if (!isHovering) {
			setIsHovering(true);
			setGlobalIsHovering(true);
		}
		const rect = event.currentTarget.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		setHoverPx(x);
		setHoverPy(y);
	};

	const totalWidth = audioBuffer ? audioBuffer.duration * zoom : 0;
	const auditionCursorPosition = auditionTime ? auditionTime * zoom : null;

	let hoverTimeFormatted = msToTimestamp(hoverTimeMs);
	if (hoverFrequency > 0) {
		const freqFormatted =
			hoverFrequency >= 1000
				? `${(hoverFrequency / 1000).toFixed(2)} kHz`
				: `${Math.round(hoverFrequency)} Hz`;
		const noteFormatted = getNoteFromFreq(hoverFrequency);
		hoverTimeFormatted = `${hoverTimeFormatted} (${freqFormatted}${noteFormatted ? ` / ${noteFormatted}` : ""})`;
	}
	let tooltipBgColor: string | undefined;
	let hoverLineColor: string | undefined;

	if (isInvalidEndTime) {
		hoverTimeFormatted = t(
			"spectrogram.invalidEndTime",
			"Cannot select this end time",
		);
		tooltipBgColor = "var(--red-9)";
		hoverLineColor = "var(--red-9)";
	} else if (editingTimeField && !editingTimeField.isWord) {
		const fieldName =
			editingTimeField.field === "startTime"
				? t("ribbonBar.editMode.startTime", "Start time")
				: t("ribbonBar.editMode.endTime", "End time");
		hoverTimeFormatted = `${t("common.clickToSet", "Click to set")} ${fieldName}: ${hoverTimeFormatted}`;
		tooltipBgColor = "var(--accent-9)";
	}

	const transformX = isZooming ? scrollLeft : Math.round(scrollLeft);

	const hoverX = scrollLeft + hoverPx;

	const minGain = 0.5;
	const maxGain = 8;
	const gainPercent = ((gain - minGain) / (maxGain - minGain)) * 100;
	const THUMB_HEIGHT_PX = 13;
	const thumbOffsetPx = (0.5 - gainPercent / 100) * THUMB_HEIGHT_PX;

	return (
		<div
			className={styles.spectrogramContainer}
			style={{ height: `${uiHeight}px` }}
		>
			<div className={styles.resizeHandle} {...resizeHandleProps} />

			<div className={styles.innerContainer}>
				<div className={`${styles.sidebar} ${styles.leftSidebar}`}>
					<Flex
						direction="column"
						align="center"
						gap="2"
						style={{ height: "100%", width: "100%" }}
					>
						<Flex
							direction="column"
							align="center"
							justify="end"
							style={{
								flex: 1,
								width: "100%",
								padding: "4px 0",
								position: "relative",
							}}
						>
							<FrequencyRuler />
							<div
								className={styles.gainSliderContainer}
								style={{ height: "95%", zIndex: 10 }}
							>
								<Slider
									orientation="vertical"
									size="1"
									min={minGain}
									max={maxGain}
									step={0.5}
									value={[gain]}
									onValueChange={(v) => setGain(v[0])}
									style={{ flex: 1, width: "18px", zIndex: 10 }}
								/>
								<div
									className={styles.gainTooltip}
									style={{
										bottom: `calc(${gainPercent}% + ${thumbOffsetPx}px)`,
									}}
								>
									{gain}x
								</div>
							</div>
						</Flex>
					</Flex>
				</div>

				<div className={styles.mainContent}>
					{!audioBuffer ? (
						<div className={styles.emptyState}>
							<Flex direction="column" align="center" gap="3">
								<MusicNote2Filled
									fontSize={48}
									color="var(--gray-8)"
									style={{ opacity: 0.5 }}
								/>
								<Text color="gray" size="3">
									{t(
										"spectrogram.noAudioLoaded",
										"Please load an audio file to render the spectrogram",
									)}
								</Text>
								<Button variant="soft" onClick={handleLoadMusic}>
									{t("spectrogram.loadAudio", "Load audio file")}
								</Button>
							</Flex>
						</div>
					) : (
						<>
							<TimelineRuler
								ref={rulerRef}
								zoom={zoom}
								duration={audioBuffer?.duration || 0}
								containerWidth={containerWidth}
								onSeek={handleRulerSeek}
							/>

							{!isDragging && (
								<>
									<div
										className={styles.hoverTimeTooltip}
										style={{
											left: `${hoverPx}px`,
											opacity: isHovering ? 1 : 0,
											backgroundColor: tooltipBgColor,
										}}
									>
										{hoverTimeFormatted}
									</div>

									<div
										className={`${styles.rulerHoverFade} ${styles.rulerHoverFadeLeft}`}
										style={{
											width: `${hoverPx}px`,
											height: `${RULER_HEIGHT}px`,
											opacity: isHovering ? 1 : 0,
										}}
									/>

									<div
										className={`${styles.rulerHoverFade} ${styles.rulerHoverFadeRight}`}
										style={{
											left: `${hoverPx}px`,
											height: `${RULER_HEIGHT}px`,
											opacity: isHovering ? 1 : 0,
										}}
									/>
								</>
							)}

							<ScrubHandle
								scrollContainerRef={scrollContainerRef}
								scrollLeft={scrollLeft}
								zoom={zoom}
								containerWidth={containerWidth}
							/>

							<div
								ref={scrollContainerRef}
								className={styles.virtualScrollContainer}
								onMouseEnter={handleMouseEnter}
								onMouseLeave={handleMouseLeave}
								onMouseMove={handleMouseMove}
								onMouseDown={handleCompositeMouseDown}
								onContextMenu={(e) => e.preventDefault()}
								onDragOver={(e) => {
									const draggingId = store.get(draggingIdAtom);
									if (draggingId && store.get(spectrogramSelectionAtom)) {
										e.preventDefault();
										e.dataTransfer.dropEffect = "move";
									}
								}}
								onDrop={(e) => {
									const draggingId = store.get(draggingIdAtom);
									const selection = store.get(spectrogramSelectionAtom);
									if (draggingId && selection) {
										e.preventDefault();
										store.set(
											lyricLinesAtom,
											produce((draft) => {
												const line = draft.lyricLines.find(
													(l: any) => l.id === draggingId,
												);
												if (!line) return;
												line.startTime = Math.round(selection.start);
												line.endTime = Math.round(selection.end);
												let totalChars = 0;
												for (const word of line.words) {
													totalChars += word.word.length;
												}
												if (totalChars > 0) {
													const durationMs = line.endTime - line.startTime;
													let currentWordTime = line.startTime;
													for (const word of line.words) {
														const wordDuration = Math.round(
															(word.word.length / totalChars) * durationMs,
														);
														word.startTime = currentWordTime;
														word.endTime = currentWordTime + wordDuration;
														currentWordTime += wordDuration;
														if (word.ruby && word.ruby.length > 0) {
															let totalRubyChars = 0;
															for (const ruby of word.ruby)
																totalRubyChars += ruby.word.length;
															let currentRubyTime = word.startTime;
															for (const ruby of word.ruby) {
																const rubyDur =
																	totalRubyChars > 0
																		? Math.round(
																				(ruby.word.length / totalRubyChars) *
																					wordDuration,
																			)
																		: 0;
																ruby.startTime = currentRubyTime;
																ruby.endTime = currentRubyTime + rubyDur;
																currentRubyTime += rubyDur;
															}
														}
													}
													if (line.words.length > 0) {
														const lastWord = line.words[line.words.length - 1];
														lastWord.endTime = line.endTime;
														if (lastWord.ruby && lastWord.ruby.length > 0) {
															lastWord.ruby[lastWord.ruby.length - 1].endTime =
																line.endTime;
														}
													}
												}
											}),
										);
										store.set(spectrogramSelectionAtom, null);
									}
								}}
								role="group"
							>
								<div
									className={styles.virtualScrollContent}
									style={{
										width: `${Math.ceil(totalWidth)}px`,
										transform: `translate3d(${-transformX}px, 0, 0)`,
									}}
								>
									{visibleTiles.map((tile) => (
										<TileComponent key={tile.tileId} {...tile} />
									))}
									{reverseZone && (
										<ReversePlaybackZone
											zone={reverseZone}
											zoom={zoom}
											height={dataHeight}
											tiles={visibleTiles}
											onCancel={cancelZone}
										/>
									)}
									{reversePlaybackStart !== null && (
										<div
											className={styles.reversePlaybackStartCursor}
											style={{
												left: `${(reversePlaybackStart / 1000) * zoom}px`,
											}}
										/>
									)}
									<PlayheadCursor zoom={zoom} />

									{pendingCursorPosition !== null && (
										<div
											className={styles.pendingCursor}
											style={{
												left: `${pendingCursorPosition}px`,
											}}
										/>
									)}
									{auditionCursorPosition !== null && (
										<div
											className={styles.auditionCursor}
											style={{
												left: `${auditionCursorPosition}px`,
											}}
										/>
									)}
									{showRangePreview && previewStyle && (
										<div
											className={styles.rangePreviewRegion}
											style={previewStyle}
										/>
									)}
									{selectionStyle && (
										<div
											className={styles.rangePreviewRegion}
											style={selectionStyle}
										/>
									)}
									<SpectrogramContext.Provider value={contextValue}>
										<Theme appearance="dark">
											<LyricTimelineOverlay
												clientWidth={containerWidth}
												hiddenLineIds={showRangePreview ? selectedLines : null}
												reverseZone={reverseZone}
											/>
											{!isDragging && (
												<div
													className={styles.hoverCursorContainer}
													style={{
														left: `${hoverX}px`,
														opacity: isHovering ? 1 : 0,
													}}
												>
													<div
														className={styles.hoverCursorLine}
														style={{ backgroundColor: hoverLineColor }}
													/>
												</div>
											)}
										</Theme>
									</SpectrogramContext.Provider>
								</div>
							</div>
							<TimeShiftToolbar />
						</>
					)}
				</div>

				<div className={`${styles.sidebar} ${styles.rightSidebar}`}>
					<Tooltip
						content={t(
							"spectrogram.showUnselectedLines",
							"Show unselected lines",
						)}
						side="left"
					>
						<IconButton
							variant={showUnselectedLines ? "solid" : "outline"}
							onClick={() => setShowUnselectedLines((prev) => !prev)}
						>
							{showUnselectedLines ? <EyeFilled /> : <EyeOffFilled />}
						</IconButton>
					</Tooltip>

					<Tooltip
						content={t("timeShiftDialog.title", "Time Shift")}
						side="left"
					>
						<IconButton
							variant="ghost"
							color="gray"
							onClick={() => {
								setPreviewActive((prev) => !prev);
							}}
						>
							<ClockRegular />
						</IconButton>
					</Tooltip>

					<Popover.Root>
						<Tooltip
							content={t("spectrogram.settings", "Spectrogram settings")}
							side="left"
						>
							<Popover.Trigger>
								<IconButton variant="ghost" color="gray">
									<SettingsFilled />
								</IconButton>
							</Popover.Trigger>
						</Tooltip>
						<Popover.Content side="left" align="end" style={{ width: 220 }}>
							<Flex direction="column" gap="3">
								<Text size="2" weight="bold">
									{t("spectrogram.settings", "Spectrogram settings")}
								</Text>

								<Flex direction="column" gap="2">
									<Text size="1" color="gray">
										{t("spectrogram.fftSize", "FFT Size")} (
										{t("spectrogram.resolution", "Resolution")})
									</Text>
									<Select.Root
										value={fftSize.toString()}
										onValueChange={(v) => setFftSize(Number.parseInt(v))}
									>
										<Select.Trigger />
										<Select.Content>
											<Select.Item value="512">
												{t("spectrogram.fftSizeOption.512", "512 (Fast)")}
											</Select.Item>
											<Select.Item value="1024">
												{t("spectrogram.fftSizeOption.1024", "1024 (Normal)")}
											</Select.Item>
											<Select.Item value="2048">
												{t(
													"spectrogram.fftSizeOption.2048",
													"2048 (Better Freq)",
												)}
											</Select.Item>
											<Select.Item value="4096">
												{t("spectrogram.fftSizeOption.4096", "4096 (High Res)")}
											</Select.Item>
										</Select.Content>
									</Select.Root>
								</Flex>

								<Flex align="center" gap="2">
									<Text size="1" color="gray">
										{t("spectrogram.height", "Height")}
									</Text>
									<Slider
										size="1"
										min={100}
										max={800}
										step={10}
										value={[dataHeight]}
										onValueChange={(v) => setDataHeight(v[0])}
									/>
									<Text size="1">{dataHeight}px</Text>
								</Flex>
							</Flex>
						</Popover.Content>
					</Popover.Root>
				</div>
			</div>
		</div>
	);
});

const PlayheadCursor: FC<{ zoom: number }> = memo(({ zoom }) => {
	const currentTimeInMs = useAtomValue(currentTimeAtom);
	const cursorPosition = (currentTimeInMs / 1000) * zoom;

	return (
		<div
			className={styles.playheadCursor}
			style={{
				left: `${cursorPosition}px`,
			}}
		/>
	);
});

const ScrubHandle: FC<{
	scrollContainerRef: React.RefObject<HTMLDivElement | null>;
	scrollLeft: number;
	zoom: number;
	containerWidth: number;
}> = memo(({ scrollContainerRef, scrollLeft, zoom, containerWidth }) => {
	const currentTimeInMs = useAtomValue(currentTimeAtom);
	const { handleScrubStart } = useScrubbing(
		scrollContainerRef,
		scrollLeft,
		zoom,
	);
	const handleLeftPosition = (currentTimeInMs / 1000) * zoom - scrollLeft;

	return (
		<div
			className={styles.playheadScrubHandle}
			style={{
				left: `${handleLeftPosition}px`,
				display:
					handleLeftPosition < 0 || handleLeftPosition > containerWidth
						? "none"
						: "block",
			}}
			onMouseDown={handleScrubStart}
		/>
	);
});

export default AudioSpectrogram;
