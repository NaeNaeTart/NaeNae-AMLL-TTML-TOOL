import { type FC, useContext } from "react";
import type { GapSegment as GapSegmentType } from "$/modules/segmentation/utils/segment-processing.ts";
import styles from "./GapSegment.module.css";
import { SpectrogramContext } from "./SpectrogramContext.ts";

interface GapSegmentProps {
	segment: GapSegmentType;
	lineStartTime: number;
	isGhost?: boolean;
	offset?: number;
}

export const GapSegment: FC<GapSegmentProps> = ({
	segment,
	lineStartTime,
	isGhost = false,
	offset = 0,
}) => {
	const { zoom } = useContext(SpectrogramContext);
	const { startTime, endTime } = segment;

	if (startTime == null || endTime == null || endTime <= startTime) {
		return null;
	}

	const left =
		((startTime + (isGhost ? offset : 0) - lineStartTime) / 1000) * zoom;
	const width = ((endTime - startTime) / 1000) * zoom;

	if (width < 1) {
		return null;
	}

	const dynamicStyles = {
		left: `${left}px`,
		width: `${width}px`,
	};

	return <div className={styles.gapSegment} style={dynamicStyles} />;
};
