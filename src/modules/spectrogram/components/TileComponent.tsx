import { memo, useLayoutEffect, useRef } from "react";
import styles from "./AudioSpectrogram.module.css";

export interface TileComponentProps {
	tileId: string;
	left: number;
	width: number;
	height: number;
	canvasWidth: number;
	bitmap?: ImageBitmap;
}

export const TileComponent = memo(
	({
		tileId,
		left,
		width,
		height,
		canvasWidth,
		bitmap,
	}: TileComponentProps) => {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		useLayoutEffect(() => {
			if (bitmap && canvasRef.current) {
				const canvas = canvasRef.current;
				if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
				if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
				const ctx = canvas.getContext("2d");
				try {
					if (bitmap.width > 0 && bitmap.height > 0) {
						ctx?.clearRect(0, 0, canvas.width, canvas.height);
						ctx?.drawImage(bitmap, 0, 0);
					}
				} catch (e) {
					console.warn("TileComponent: Failed to draw bitmap", e);
				}
			}
		}, [bitmap, canvasWidth, height, left, width]);

		return (
			<canvas
				ref={canvasRef}
				id={tileId}
				width={canvasWidth > 0 ? canvasWidth : 1}
				height={height}
				className={styles.tileCanvas}
				style={{
					left: `${left}px`,
					width: `${width}px`,
					backgroundColor: bitmap ? "transparent" : "var(--gray-3)",
				}}
			/>
		);
	},
);
