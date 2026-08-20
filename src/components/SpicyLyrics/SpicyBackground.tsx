import classNames from "classnames";
import {
	type CSSProperties,
	useEffect,
	useRef,
	useState,
} from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import styles from "./index.module.css";

export type CoverPalette = { base: string; highlight: string };

const colorToHex = (red: number, green: number, blue: number) => {
	const clamp = (channel: number) => Math.max(0, Math.min(255, Math.round(channel)));
	return `#${((1 << 24) + (clamp(red) << 16) + (clamp(green) << 8) + clamp(blue)).toString(16).slice(1)}`;
};

export function useCoverPalette(imageSource: string | null) {
	const [palette, setPalette] = useState<CoverPalette | null>(null);
	useEffect(() => {
		if (!imageSource) {
			setPalette(null);
			return;
		}
		let cancelled = false;
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.src = imageSource;
		void image
			.decode()
			.then(() => {
				const canvas = document.createElement("canvas");
				canvas.width = 32;
				canvas.height = 32;
				const context = canvas.getContext("2d", { willReadFrequently: true });
				if (!context) return;
				context.drawImage(image, 0, 0, canvas.width, canvas.height);
				const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
				const base = { red: 0, green: 0, blue: 0, weight: 0 };
				let highlight = { red: 0, green: 0, blue: 0, saturation: -1 };
				for (let index = 0; index < data.length; index += 4) {
					const red = data[index];
					const green = data[index + 1];
					const blue = data[index + 2];
					const alpha = data[index + 3] / 255;
					const max = Math.max(red, green, blue);
					const min = Math.min(red, green, blue);
					const saturation = max === 0 ? 0 : (max - min) / max;
					const weight = alpha * (0.35 + saturation * 0.65);
					base.red += red * weight;
					base.green += green * weight;
					base.blue += blue * weight;
					base.weight += weight;
					if (saturation > highlight.saturation && max > 38 && max < 235)
						highlight = { red, green, blue, saturation };
				}
				if (!base.weight || cancelled) return;
				const baseColor = colorToHex(
					base.red / base.weight,
					base.green / base.weight,
					base.blue / base.weight,
				);
				setPalette({
					base: baseColor,
					highlight:
						highlight.saturation >= 0
							? colorToHex(highlight.red, highlight.green, highlight.blue)
							: baseColor,
				});
			})
			.catch(() => {
				if (!cancelled) setPalette(null);
			});
		return () => {
			cancelled = true;
		};
	}, [imageSource]);
	return palette;
}

type KawarpInstance = {
	dispose(): void;
	loadImage(url: string): Promise<void>;
	start(): void;
	setOptions(options: {
		animationSpeed?: number;
		transitionDuration?: number;
	}): void;
};

function useKawarpBackground(
	container: { current: HTMLDivElement | null },
	image: string | null,
	mode: "animated" | "color" | "static",
) {
	useEffect(() => {
		if (mode !== "animated" || !image || !container.current) return;
		let disposed = false;
		let instance: KawarpInstance | null = null;
		let frame = 0;
		const canvas = document.createElement("canvas");
		canvas.className = styles.backgroundCanvas;
		container.current.replaceChildren(canvas);
		void import("@kawarp/core")
			.then(async ({ default: Kawarp }) => {
				if (disposed) return;
				instance = new Kawarp(canvas, {
					warpIntensity: 1,
					blurPasses: 8,
					animationSpeed: 0.1,
					saturation: 1.5,
					dithering: 0.008,
					tintIntensity: 0,
					scale: 1,
					transitionDuration: 500,
				}) as KawarpInstance;
				await instance.loadImage(image);
				if (disposed) return;
				instance.start();
				const bins = new Uint8Array(audioEngine.analyserNode.frequencyBinCount);
				const animate = () => {
					audioEngine.analyserNode.getByteFrequencyData(bins);
					const energy =
						bins.reduce((sum, value) => sum + value, 0) / (bins.length * 255);
					instance?.setOptions({ animationSpeed: 0.1 + energy * 0.35 });
					frame = requestAnimationFrame(animate);
				};
				frame = requestAnimationFrame(animate);
			})
			.catch(() => container.current?.replaceChildren());
		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			instance?.dispose();
			// Safe here: this container is the dedicated Kawarp slot, never a
			// node React also renders JSX children into (see SpicyBackground).
			container.current?.replaceChildren();
		};
	}, [container, image, mode]);
}

export function SpicyBackground({
	backgroundMode,
	backgroundImage,
	accentColor,
}: {
	backgroundMode: "animated" | "color" | "static";
	backgroundImage: string | null;
	accentColor: string;
}) {
	const backgroundRef = useRef<HTMLDivElement>(null);
	// Kawarp owns this node's children imperatively (replaceChildren). It
	// must never be the same node React renders JSX children into — mixing
	// the two causes a "Failed to execute 'insertBefore' on 'Node'" crash
	// the next time React reconciles a sibling (e.g. switching background
	// mode), because React still expects the children it rendered to be
	// there and Kawarp already wiped them out from under it.
	const kawarpSlotRef = useRef<HTMLDivElement>(null);
	const coverPalette = useCoverPalette(backgroundImage);
	useKawarpBackground(kawarpSlotRef, backgroundImage, backgroundMode);
	return (
		<div
			className={classNames(
				styles.background,
				backgroundMode === "animated" && styles.animatedBackground,
			)}
			ref={backgroundRef}
			style={
				{
					"--spicy-accent": accentColor,
					"--spicy-cover-base": coverPalette?.base,
					"--spicy-cover-highlight": coverPalette?.highlight,
				} as CSSProperties
			}
		>
			<div ref={kawarpSlotRef} className={styles.backgroundCanvas} />
			{backgroundMode === "color" ? (
				<div className={styles.colorBackground} />
			) : null}
			{backgroundMode === "static" && backgroundImage ? (
				<div
					className={styles.staticBackground}
					style={{ backgroundImage: `url("${backgroundImage}")` }}
				/>
			) : null}
			{backgroundMode === "static" && !backgroundImage ? (
				<div className={styles.staticFallback} />
			) : null}
			<div className={styles.overlay} />
		</div>
	);
}