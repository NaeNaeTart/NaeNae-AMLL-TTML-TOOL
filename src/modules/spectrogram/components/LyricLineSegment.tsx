import { useAtomValue, useSetAtom } from "jotai";
import React, { type FC, useCallback, useContext } from "react";
import classNames from "classnames";
import type { ProcessedLyricLine } from "$/modules/segmentation/utils/segment-processing.ts";
import {
	previewLineAtom,
	selectedWordIdAtom,
	timelineDragAtom,
} from "$/modules/spectrogram/states/dnd.ts";
import { editingTimeFieldAtom, selectedLinesAtom } from "$/states/main.ts";
import { DividerSegment } from "./DividerSegment.tsx";
import { GapSegment } from "./GapSegment.tsx";
import styles from "./LyricLineSegment.module.css";
import { LyricWordSegment } from "./LyricWordSegment.tsx";
import { SpectrogramContext } from "./SpectrogramContext.ts";

interface LyricLineSegmentProps {
	line: ProcessedLyricLine;
	allLines: ProcessedLyricLine[];
	isGhost?: boolean;
	offset?: number;
}

export const LyricLineSegment: FC<LyricLineSegmentProps> = ({
	line,
	allLines,
	isGhost = false,
	offset = 0,
}) => {
	const previewLine = useAtomValue(previewLineAtom);
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const setSelectedWordId = useSetAtom(selectedWordIdAtom);
	const { scrollContainerRef, zoom, scrollLeft } = useContext(SpectrogramContext);
	const editingTimeField = useAtomValue(editingTimeFieldAtom);
	const setTimelineDrag = useSetAtom(timelineDragAtom);

	let displayLine: ProcessedLyricLine;
	if (!isGhost && previewLine && previewLine.id === line.id) {
		displayLine = previewLine;
	} else {
		displayLine = line;
	}

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (isGhost) return;
			if (e.button !== 0) return;
			if (editingTimeField) return;

			if (!displayLine) return;
			e.stopPropagation();

			const { id, startTime } = displayLine;

			const scrollContainer = scrollContainerRef.current;
			if (!scrollContainer) return;

			const rect = scrollContainer.getBoundingClientRect();
			const mouseXPx = e.clientX - rect.left;
			const initialMouseTimeMS = ((scrollLeft + mouseXPx) / zoom) * 1000;

			setTimelineDrag({
				type: "line-pan",
				lineId: id,
				initialMouseTimeMS,
				initialLineStartMS: startTime,
			});

			setSelectedLines(new Set([id]));
			setSelectedWordId(null);
		},
		[
			isGhost,
			editingTimeField,
			displayLine,
			setSelectedLines,
			setSelectedWordId,
			scrollContainerRef,
			scrollLeft,
			zoom,
			setTimelineDrag,
		],
	);

	if (!displayLine) {
		return null;
	}

	const startTime = Math.max(0, (displayLine.startTime ?? 0) + offset);
	const endTime = Math.max(0, (displayLine.endTime ?? 0) + offset);
	const segments = displayLine.segments;
	const segmentsLength = segments.length;

	if (startTime == null || endTime == null || endTime <= startTime) {
		return null;
	}

	const left = (startTime / 1000) * zoom;
	const width = ((endTime - startTime) / 1000) * zoom;

	if (width < 1) {
		return null;
	}

	const isTouchingStart = allLines.some(
		(l) => l.id !== line.id && l.endTime === startTime,
	);
	const isTouchingEnd = allLines.some(
		(l) => l.id !== line.id && l.startTime === endTime,
	);

	const dynamicStyles = {
		left: `${left}px`,
		width: `${width}px`,
		cursor: isGhost ? "default" : "auto",
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: <button> 不适用
		<div
			className={classNames(
				styles.lineSegment,
				isGhost && styles.ghost,
				isTouchingStart && styles.touchingStart,
				isTouchingEnd && styles.touchingEnd,
			)}
			style={dynamicStyles}
			onMouseDown={handleMouseDown}
			tabIndex={isGhost ? -1 : 0}
			role={isGhost ? "presentation" : "button"}
			aria-label={isGhost ? "Ghost Lyric Line" : "Lyric Line"}
		>
			{!isGhost && (
				<DividerSegment
					key="divider-start"
					lineId={displayLine.id}
					segmentIndex={-1}
					timeMs={startTime}
					lineStartTime={startTime}
					segmentsLength={segmentsLength}
					isTouching={isTouchingStart}
				/>
			)}

			{segments.map((segment, index) => (
				<React.Fragment key={segment.id}>
					{segment.type === "word" ? (
						<LyricWordSegment
							lineId={displayLine.id}
							segment={segment}
							lineStartTime={startTime}
							offset={offset}
							isGhost={isGhost}
						/>
					) : (
						<GapSegment segment={segment} lineStartTime={startTime} offset={offset} isGhost={isGhost} />
					)}
					{!isGhost && (
						<DividerSegment
							key={`divider-${segment.id}`}
							lineId={displayLine.id}
							segmentIndex={index}
							timeMs={segment.endTime}
							lineStartTime={startTime}
							segmentsLength={segmentsLength}
							isTouching={index === segmentsLength - 1 ? isTouchingEnd : false}
						/>
					)}
				</React.Fragment>
			))}
		</div>
	);
};
