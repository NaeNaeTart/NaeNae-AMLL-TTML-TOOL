import { useAtomValue, useSetAtom } from "jotai";
import React, { type FC, type MouseEvent, useContext } from "react";
import { useTranslation } from "react-i18next";
import {
	type ProcessedLyricLine,
	processedLyricLinesAtom,
} from "$/modules/segmentation/utils/segment-processing.ts";
import {
	previewLineAtom,
	selectedWordIdAtom,
	timelineDragAtom,
} from "$/modules/spectrogram/states/dnd.ts";
import type { ReversePlaybackZone as ReversePlaybackZoneState } from "$/modules/spectrogram/states/reverse-playback";
import styles from "./AudioSpectrogram.module.css";
import { DividerSegment } from "./DividerSegment";
import { SpectrogramContext } from "./SpectrogramContext.ts";
import type { TileComponentProps } from "./TileComponent";
import { TileComponent } from "./TileComponent";
import { editingTimeFieldAtom, selectedLinesAtom } from "$/states/main.ts";

type ReversePlaybackZoneProps = {
	zone: ReversePlaybackZoneState;
	zoom: number;
	height: number;
	tiles: TileComponentProps[];
	onCancel: () => void;
};

export const ReversePlaybackZone: FC<ReversePlaybackZoneProps> = ({
	zone,
	zoom,
	height,
	tiles,
	onCancel,
}) => {
	const { t } = useTranslation();
	const processedLines = useAtomValue(processedLyricLinesAtom);
	const startPx = (zone.start / 1000) * zoom;
	const widthPx = ((zone.end - zone.start) / 1000) * zoom;
	const overlappingTiles = tiles.filter(
		(tile) => tile.left + tile.width > startPx && tile.left < startPx + widthPx,
	);

	const overlappingLines = processedLines.filter((line) => {
		if (line.startTime == null || line.endTime == null) return false;
		return line.endTime > zone.start && line.startTime < zone.end;
	});

	return (
		<div
			className={styles.reversePlaybackZone}
			style={{
				left: `${startPx}px`,
				width: `${widthPx}px`,
				height: `${height}px`,
			}}
			onMouseDown={(event) => {
				if (!event.ctrlKey && !event.metaKey) return;
				event.preventDefault();
				event.stopPropagation();
				onCancel();
			}}
			role="presentation"
		>
			<div className={styles.reversePlaybackTilesFlip}>
				{overlappingTiles.map((tile) => (
					<TileComponent
						key={`reverse-${tile.tileId}`}
						{...tile}
						left={tile.left - startPx}
					/>
				))}
			</div>
			<div className={styles.reversePlaybackTiles}>
				{overlappingLines.map((line) => (
					<ReversedLyricLine
						key={`rev-lyric-${line.id}`}
						line={line}
						zoneStart={zone.start}
						zoneEnd={zone.end}
						zoom={zoom}
						mirrored={zone.mirrored}
					/>
				))}
			</div>
			<div className={styles.reversePlaybackLabel}>
				{zone.status === "completed"
					? t("spectrogram.reversePlayback.mirrored", "Mirrored")
					: t("spectrogram.reversePlayback.ready", "Reverse zone")}
			</div>
		</div>
	);
};

const ReversedLyricLine: FC<{
	line: ProcessedLyricLine;
	zoneStart: number;
	zoneEnd: number;
	zoom: number;
	mirrored?: boolean;
}> = ({ line, zoneStart, zoneEnd, zoom, mirrored = false }) => {
	const toVirtual = (t: number) => zoneStart + (zoneEnd - t);
	const previewLine = useAtomValue(previewLineAtom);
	const displayLine =
		previewLine && previewLine.id === line.id ? previewLine : line;
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const setSelectedWordId = useSetAtom(selectedWordIdAtom);
	const setTimelineDrag = useSetAtom(timelineDragAtom);
	const editingTimeField = useAtomValue(editingTimeFieldAtom);
	const selectedWordId = useAtomValue(selectedWordIdAtom);
	const { scrollContainerRef, scrollLeft } = useContext(SpectrogramContext);

	const rawLineStart = displayLine.startTime ?? 0;
	const rawLineEnd = displayLine.endTime ?? 0;
	const lineMirrored =
		mirrored && rawLineStart >= zoneStart && rawLineEnd <= zoneEnd;
	const startTime = Math.max(
		lineMirrored ? rawLineStart : toVirtual(Math.min(rawLineEnd, zoneEnd)),
		zoneStart,
	);
	const endTime = Math.min(
		lineMirrored ? rawLineEnd : toVirtual(Math.max(rawLineStart, zoneStart)),
		zoneEnd,
	);
	if (endTime <= startTime) return null;

	const computeMouseTimeMS = (event: MouseEvent<HTMLDivElement>) => {
		const rect = scrollContainerRef.current?.getBoundingClientRect();
		if (!rect) return null;
		return ((scrollLeft + event.clientX - rect.left) / zoom) * 1000;
	};

	const handleLinePanStart = (event: MouseEvent<HTMLDivElement>) => {
		if (event.button !== 0 || event.ctrlKey || event.metaKey) return;
		if (editingTimeField) return;
		event.preventDefault();
		event.stopPropagation();
		const initialMouseTimeMS = computeMouseTimeMS(event);
		if (initialMouseTimeMS === null) return;
		setTimelineDrag({
			type: "line-pan",
			lineId: line.id,
			initialMouseTimeMS,
			initialLineStartMS: rawLineStart,
			virtual: !lineMirrored,
		});
		setSelectedLines(new Set([line.id]));
		setSelectedWordId(null);
	};

	const left = ((startTime - zoneStart) / 1000) * zoom;
	const width = ((endTime - startTime) / 1000) * zoom;
	const segmentsLength = displayLine.segments.length;
	const isVirtual = !lineMirrored;

	return (
		<div
			onMouseDown={handleLinePanStart}
			style={{
				position: "absolute",
				left: `${left}px`,
				width: `${width}px`,
				top: 0,
				height: "100%",
				backgroundColor: "var(--accent-a2)",
				border: "1px dashed var(--accent-6)",
				borderRadius: "var(--radius-1)",
				boxSizing: "border-box",
				pointerEvents: "auto",
				cursor: "grab",
			}}
		>
			<DividerSegment
				key="rev-divider-start"
				lineId={displayLine.id}
				segmentIndex={-1}
				timeMs={isVirtual ? toVirtual(rawLineStart) : rawLineStart}
				lineStartTime={startTime}
				segmentsLength={segmentsLength}
				isTouching={false}
				virtual={isVirtual}
			/>

			{displayLine.segments.map((segment, index) => {
				const rawStart = segment.startTime ?? 0;
				const rawEnd = segment.endTime ?? 0;
				if (rawEnd <= rawStart) return null;

				const segMirrored =
					lineMirrored && rawStart >= zoneStart && rawEnd <= zoneEnd;
				const segStart = Math.max(
					segMirrored ? rawStart : toVirtual(rawEnd),
					zoneStart,
				);
				const segEnd = Math.min(
					segMirrored ? rawEnd : toVirtual(rawStart),
					zoneEnd,
				);
				if (segEnd <= segStart) return null;

				const handleWordPanStart = (event: MouseEvent<HTMLDivElement>) => {
					if (event.button !== 0 || event.ctrlKey || event.metaKey) return;
					if (editingTimeField) return;
					event.preventDefault();
					event.stopPropagation();
					const initialMouseTimeMS = computeMouseTimeMS(event);
					if (initialMouseTimeMS === null) return;
					setTimelineDrag({
						type: "word-pan",
						lineId: line.id,
						wordId: segment.id,
						initialMouseTimeMS,
						initialWordStartMS: rawStart,
						virtual: !segMirrored,
					});
					setSelectedWordId(segment.id);
				};

				const segLeft = ((segStart - startTime) / 1000) * zoom;
				const segWidth = ((segEnd - segStart) / 1000) * zoom;

				return (
					<React.Fragment key={segment.id}>
						{segment.type === "word" ? (
							<div
								onMouseDown={handleWordPanStart}
								style={{
									position: "absolute",
									left: `${segLeft}px`,
									width: `${segWidth}px`,
									top: 0,
									height: "100%",
									border: "1px solid var(--accent-5)",
									borderRadius: "var(--radius-1)",
									backgroundColor:
										selectedWordId === segment.id
											? "var(--accent-a6)"
											: "transparent",
									color: "var(--gray-11)",
									display: "flex",
									flexDirection: "column",
									justifyContent: "flex-start",
									alignItems: "center",
									whiteSpace: "nowrap",
									overflow: "hidden",
									padding: "4px 4px 0 4px",
									fontSize: "14px",
									boxSizing: "border-box",
									cursor: "grab",
								}}
							>
								{segment.word}
							</div>
						) : null}
						<DividerSegment
							key={`rev-divider-${segment.id}`}
							lineId={displayLine.id}
							segmentIndex={index}
							timeMs={isVirtual ? toVirtual(segment.endTime) : segment.endTime}
							lineStartTime={startTime}
							segmentsLength={segmentsLength}
							isTouching={false}
							virtual={isVirtual}
						/>
					</React.Fragment>
				);
			})}
		</div>
	);
};
