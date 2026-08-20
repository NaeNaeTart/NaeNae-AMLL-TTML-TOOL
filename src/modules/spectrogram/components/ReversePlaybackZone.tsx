import { useAtomValue } from "jotai";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import {
	type ProcessedLyricLine,
	processedLyricLinesAtom,
} from "$/modules/segmentation/utils/segment-processing.ts";
import type { ReversePlaybackZone as ReversePlaybackZoneState } from "$/modules/spectrogram/states/reverse-playback";
import styles from "./AudioSpectrogram.module.css";
import type { TileComponentProps } from "./TileComponent";
import { TileComponent } from "./TileComponent";

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
			<div className={styles.reversePlaybackTiles}>
				{overlappingTiles.map((tile) => (
					<TileComponent
						key={`reverse-${tile.tileId}`}
						{...tile}
						left={tile.left - startPx}
					/>
				))}
				{overlappingLines.map((line) => (
					<ReversedLyricLine
						key={`rev-lyric-${line.id}`}
						line={line}
						zoneStart={zone.start}
						zoneEnd={zone.end}
						zoom={zoom}
					/>
				))}
			</div>
			<div className={styles.reversePlaybackLabel}>
				{t("spectrogram.reversePlayback.active", "Reversed playback")}
			</div>
		</div>
	);
};

const ReversedLyricLine: FC<{
	line: ProcessedLyricLine;
	zoneStart: number;
	zoneEnd: number;
	zoom: number;
}> = ({ line, zoneStart, zoneEnd, zoom }) => {
	const startTime = Math.max(line.startTime ?? 0, zoneStart);
	const endTime = Math.min(line.endTime ?? 0, zoneEnd);
	if (endTime <= startTime) return null;

	const startPx = (zoneStart / 1000) * zoom;
	const left = (startTime / 1000) * zoom - startPx;
	const width = ((endTime - startTime) / 1000) * zoom;

	return (
		<div
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
				pointerEvents: "none",
				overflow: "hidden",
			}}
		>
			{line.segments.map((segment) => {
				if (segment.type !== "word") return null;
				const segStart = Math.max(segment.startTime ?? 0, startTime);
				const segEnd = Math.min(segment.endTime ?? 0, endTime);
				if (segEnd <= segStart) return null;

				const segLeft = ((segStart - startTime) / 1000) * zoom;
				const segWidth = ((segEnd - segStart) / 1000) * zoom;

				return (
					<div
						key={segment.id}
						style={{
							position: "absolute",
							left: `${segLeft}px`,
							width: `${segWidth}px`,
							top: 0,
							height: "100%",
							border: "1px solid var(--accent-5)",
							borderRadius: "var(--radius-1)",
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
						}}
					>
						{segment.word}
					</div>
				);
			})}
		</div>
	);
};
