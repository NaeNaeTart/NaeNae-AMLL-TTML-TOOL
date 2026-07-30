import { Card, Flex, Popover, Text, TextField, TextArea, Box, IconButton } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import WaveSurfer from "wavesurfer.js";
import { msToTimestamp } from "$/utils/timestamp";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	audioBufferAtom,
	audioPlayingAtom,
	currentDurationAtom,
	currentTimeAtom,
} from "$/modules/audio/states";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";
import { useHoverGuide } from "../hooks";
import { AudioRegion } from "./AudioRegion";
import styles from "./AudioSlider.module.css";
import { HoverGuide } from "./HoverGuide";
import { Add16Regular, Delete16Regular } from "@fluentui/react-icons";
import type { Mark } from "$/types/ttml";

const WaveformMarkers = memo(
	({
		markers,
		updateMark,
		toggleMark,
	}: {
		markers: (Mark & { left: number; timestamp: string })[];
		updateMark: (timeMs: number, data: Partial<Mark>) => void;
		toggleMark: (timeMs: number) => void;
	}) => {
		const { t } = useTranslation();
		return (
			<>
				{markers.map((marker) => (
					<MarkerItem
						key={marker.timeMs}
						marker={marker}
						updateMark={updateMark}
						toggleMark={toggleMark}
					/>
				))}
			</>
		);
	},
);

const InteractiveHoverOverlay = memo(
	({
		sliderWidthPx,
		isDraggingRef,
	}: {
		sliderWidthPx: number;
		isDraggingRef: React.RefObject<boolean>;
	}) => {
		const {
			hoverState,
			handleContainerMouseMove,
			handleContainerMouseLeave,
		} = useHoverGuide(sliderWidthPx, isDraggingRef);

		return (
			<div
				className={styles.interactionOverlay}
				onMouseMove={handleContainerMouseMove}
				onMouseLeave={handleContainerMouseLeave}
			>
				<HoverGuide hoverState={hoverState} />
			</div>
		);
	},
);

const MarkerItem = memo(
	({
		marker,
		updateMark,
		toggleMark,
	}: {
		marker: Mark & { left: number; timestamp: string };
		updateMark: (timeMs: number, data: Partial<Mark>) => void;
		toggleMark: (timeMs: number) => void;
	}) => {
		const [localLabel, setLocalLabel] = useState(marker.label || "");
		const [localDescription, setLocalDescription] = useState(
			marker.description || "",
		);

		// Sync with external state changes
		useEffect(() => {
			setLocalLabel(marker.label || "");
		}, [marker.label]);

		useEffect(() => {
			setLocalDescription(marker.description || "");
		}, [marker.description]);

		const commitChanges = useCallback(() => {
			if (
				localLabel !== (marker.label || "") ||
				localDescription !== (marker.description || "")
			) {
				updateMark(marker.timeMs, {
					label: localLabel,
					description: localDescription,
				});
			}
		}, [localLabel, localDescription, marker, updateMark]);

		return (
			<Popover.Root onOpenChange={(open) => !open && commitChanges()}>
				<Popover.Trigger asChild>
					<div
						className={styles.markingLine}
						style={{ left: `${marker.left}px` }}
						onContextMenu={(e) => {
							e.preventDefault();
							if (e.shiftKey) toggleMark(marker.timeMs);
						}}
					>
						<div className={styles.markingLineTip}>
							{marker.label ? `${marker.label} ` : ""}
							{marker.timestamp}
						</div>
					</div>
				</Popover.Trigger>
				<Popover.Content
					size="1"
					style={{ width: 240, zIndex: 100 }}
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<Flex direction="column" gap="2">
						<Box>
							<Text size="1" weight="bold" color="gray">
								{t("audio.marker", "Marker")} @ {marker.timestamp}
							</Text>
						</Box>
						<TextField.Root
							size="1"
							placeholder={t("audio.markerLabel", "Label (e.g. Verse 1 Start)")}
							value={localLabel}
							onChange={(e) => setLocalLabel(e.target.value)}
							onBlur={commitChanges}
						/>
						<TextArea
							size="1"
							placeholder={t("audio.markerDescription", "Description...")}
							value={localDescription}
							onChange={(e) => setLocalDescription(e.target.value)}
							onBlur={commitChanges}
							style={{ height: 60 }}
						/>
						<Flex justify="end" gap="2">
							<IconButton
								size="1"
								variant="ghost"
								color="red"
								onClick={() => toggleMark(marker.timeMs)}
								title={t("audio.deleteMarker", "Delete Marker")}
							>
								<Delete16Regular />
							</IconButton>
						</Flex>
					</Flex>
				</Popover.Content>
			</Popover.Root>
		);
	},
);

export const AudioSlider = memo(() => {
	const { t } = useTranslation();
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const setCurrentDuration = useSetAtom(currentDurationAtom);
	const setAudioPlaying = useSetAtom(audioPlayingAtom);

	const currentDuration = useAtomValue(currentDurationAtom);
	const [lyricLines, setLyricLines] = useAtom(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const audioBuffer = useAtomValue(audioBufferAtom);

	const wsContainerRef = useRef<HTMLDivElement>(null);
	const waveSurferRef = useRef<WaveSurfer | null>(null);

	const [sliderWidthPx, setSliderWidthPx] = useState(0);
	const isDraggingRef = useRef(false);

	const toggleMark = useCallback(
		(timeMs: number) => {
			setLyricLines((prev) => {
				const marks = prev.marks || [];
				const existingIndex = marks.findIndex(
					(m) => Math.abs(m.timeMs - timeMs) < 150,
				);
				if (existingIndex !== -1) {
					return {
						...prev,
						marks: marks.filter((_, i) => i !== existingIndex),
					};
				}
				return {
					...prev,
					marks: [...marks, { timeMs }].sort((a, b) => a.timeMs - b.timeMs),
				};
			});
		},
		[setLyricLines],
	);

	const updateMark = useCallback(
		(timeMs: number, data: Partial<Mark>) => {
			setLyricLines((prev) => {
				const marks = (prev.marks || []).map((m) =>
					m.timeMs === timeMs ? { ...m, ...data } : m,
				);
				return { ...prev, marks };
			});
		},
		[setLyricLines],
	);

	const handleContainerMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (e.shiftKey) {
				const rect = wsContainerRef.current?.getBoundingClientRect();
				if (!rect || sliderWidthPx <= 0 || currentDuration <= 0) return;
				const x = e.clientX - rect.left;
				const timeMs = (x / sliderWidthPx) * currentDuration;
				toggleMark(timeMs);
				e.preventDefault();
				e.stopPropagation();
			}
		},
		[currentDuration, sliderWidthPx, toggleMark],
	);

	const destroyWaveSurfer = useCallback(() => {
		if (waveSurferRef.current) {
			waveSurferRef.current.destroy();
			waveSurferRef.current = null;
		}
	}, []);

	const createWaveSurfer = useCallback(() => {
		if (!wsContainerRef.current || !audioBuffer) {
			return null;
		}
		const height = wsContainerRef.current.clientHeight;
		const canvasStyles = getComputedStyle(wsContainerRef.current);
		const fontColor =
			canvasStyles.getPropertyValue("--adv-waveform-progress").trim() ||
			canvasStyles.getPropertyValue("--accent-a11").trim();
		const primaryFillColor =
			canvasStyles.getPropertyValue("--adv-waveform-color").trim() ||
			canvasStyles.getPropertyValue("--accent-a4").trim();

		const peaks = [audioBuffer.getChannelData(0)];
		const duration = audioBuffer.duration;

		const ws = WaveSurfer.create({
			container: wsContainerRef.current,
			height,
			hideScrollbar: true,
			waveColor: primaryFillColor,
			progressColor: fontColor,
			cursorColor: fontColor,
			dragToSeek: true,
			cursorWidth: 0,
			barHeight: 0.8,
			media: audioEngine.audioEl,
			peaks: peaks,
			duration: duration,
			interact: true,
		});
		waveSurferRef.current = ws;
		return ws;
	}, [audioBuffer]);

	useEffect(() => {
		const container = wsContainerRef.current;
		if (!container) return;

		const observer = new ResizeObserver((entries) => {
			if (entries[0]) {
				setSliderWidthPx(entries[0].contentRect.width);
			}
		});
		observer.observe(container);
		setSliderWidthPx(container.clientWidth);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (audioBuffer && audioEngine.audioEl) {
			destroyWaveSurfer();
			setCurrentDuration((audioBuffer.duration * 1000) | 0);
			createWaveSurfer();
		}
	}, [audioBuffer, createWaveSurfer, destroyWaveSurfer, setCurrentDuration]);

	useEffect(() => {
		const handleMusicUnload = () => {
			destroyWaveSurfer();
			setCurrentDuration(0);
			setCurrentTime(0);
			setAudioPlaying(false);
		};

		let frameId: number | null = null;
		let anchorAudioTime = 0;
		let anchorRealTime = performance.now();
		let isDestroyed = false;

		const syncClock = () => {
			anchorAudioTime = audioEngine.musicCurrentTime;
			anchorRealTime = performance.now();
			setCurrentTime(Math.round(anchorAudioTime * 1000));
		};

		const handleTimeUpdate = () => {
			const elapsed = (performance.now() - anchorRealTime) / 1000;
			const interpolatedTime =
				anchorAudioTime + elapsed * audioEngine.musicPlayBackRate;

			// Correct stalls and long frame gaps without resetting the smooth clock.
			if (Math.abs(audioEngine.musicCurrentTime - interpolatedTime) > 0.1) {
				syncClock();
			}
		};

		const onFrame = () => {
			if (isDestroyed || !audioEngine.musicPlaying) {
				frameId = null;
				return;
			}

			const elapsed = (performance.now() - anchorRealTime) / 1000;
			const currentTime =
				anchorAudioTime + elapsed * audioEngine.musicPlayBackRate;
			setCurrentTime(Math.round(currentTime * 1000));
			frameId = requestAnimationFrame(onFrame);
		};

		const handlePlay = () => {
			syncClock();
			if (frameId === null) onFrame();
			setAudioPlaying(true);
		};
		const handlePause = () => {
			syncClock();
			setAudioPlaying(false);
		};
		const handleSeek = syncClock;
		const handlePlaybackRateChange = syncClock;

		audioEngine.addEventListener("music-unload", handleMusicUnload);
		audioEngine.addEventListener("music-resume", handlePlay);
		audioEngine.addEventListener("music-pause", handlePause);
		audioEngine.addEventListener("music-seeked", handleSeek);
		audioEngine.addEventListener("music-timeupdate", handleTimeUpdate);
		audioEngine.addEventListener(
			"music-playback-rate-change",
			handlePlaybackRateChange,
		);

		// Start loop if already playing
		if (audioEngine.musicPlaying) {
			handlePlay();
		}

		return () => {
			isDestroyed = true;
			if (frameId !== null) cancelAnimationFrame(frameId);
			destroyWaveSurfer();
			audioEngine.removeEventListener("music-unload", handleMusicUnload);
			audioEngine.removeEventListener("music-resume", handlePlay);
			audioEngine.removeEventListener("music-pause", handlePause);
			audioEngine.removeEventListener("music-seeked", handleSeek);
			audioEngine.removeEventListener("music-timeupdate", handleTimeUpdate);
			audioEngine.removeEventListener(
				"music-playback-rate-change",
				handlePlaybackRateChange,
			);
		};
	}, [destroyWaveSurfer, setCurrentDuration, setCurrentTime, setAudioPlaying]);

	const selectedRegions = useMemo(() => {
		if (currentDuration <= 0 || sliderWidthPx <= 0) return [];

		const pixelsPerMs = sliderWidthPx / currentDuration;
		const regions: { id: string; left: number; width: number }[] = [];

		for (const line of lyricLines.lyricLines) {
			if (selectedLines.has(line.id)) {
				const left = line.startTime * pixelsPerMs;
				const width = (line.endTime - line.startTime) * pixelsPerMs;
				regions.push({ id: line.id, left, width });
			}
		}
		return regions;
	}, [lyricLines.lyricLines, selectedLines, currentDuration, sliderWidthPx]);

	const markers = useMemo(() => {
		if (currentDuration <= 0 || sliderWidthPx <= 0 || !lyricLines.marks)
			return [];
		return lyricLines.marks.map((mark) => ({
			...mark,
			left: (mark.timeMs / currentDuration) * sliderWidthPx,
			timestamp: msToTimestamp(mark.timeMs),
		}));
	}, [lyricLines.marks, currentDuration, sliderWidthPx]);

	return (
		<Card
			style={{
				alignSelf: "center",
				width: "100%",
				height: "2.5em",
				padding: "0",
				backgroundColor: "var(--audio-bar-bg, var(--rt-color-panel-solid))",
			}}
		>
			<section
				className={styles.waveformContainer}
				aria-label={t("audio.waveform", "Audio Waveform")}
				ref={wsContainerRef}
				style={{ width: "100%", height: "100%", overflow: "hidden" }}
				onMouseDown={handleContainerMouseDown}
			>
				<InteractiveHoverOverlay
					sliderWidthPx={sliderWidthPx}
					isDraggingRef={isDraggingRef}
				/>

				{selectedRegions.map((region) => (
					<div
						key={region.id}
						className={styles.selectedLyricRegion}
						style={{
							left: `${region.left}px`,
							width: `${region.width}px`,
						}}
					/>
				))}

				<WaveformMarkers
					markers={markers}
					updateMark={updateMark}
					toggleMark={toggleMark}
				/>

				<AudioRegion
					sliderWidthPx={sliderWidthPx}
					containerRef={wsContainerRef}
					isDraggingRef={isDraggingRef}
				/>
			</section>
		</Card>
	);
});
