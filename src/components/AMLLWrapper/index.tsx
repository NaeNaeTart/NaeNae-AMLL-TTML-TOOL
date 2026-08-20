import classNames from "classnames";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { type CSSProperties, memo, useEffect, useMemo, useRef, useState } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	activeLineIdsAtom,
	currentTimeAtom,
	audioCoverArtAtom,
} from "$/modules/audio/states/index.ts";
import {
	showRomanLinesAtom,
	showTranslationLinesAtom,
	vsyncAtom,
	showFpsCounterAtom,
	lyricWordFadeWidthAtom,
	instantHighlightFadeAtom,
	spicyBackgroundModeAtom,
} from "$/modules/settings/states/preview";
import {
	isDarkThemeAtom,
	lyricLinesAtom,
	projectIdentityAtom,
	selectedLinesAtom,
} from "$/states/main.ts";
import { 
	useCustomAccentAtom,
	customAccentColorAtom,
} from "$/modules/settings/states/index.ts";
import { customBackgroundImageAtom } from "$/modules/settings/modals/customBackground";
import { findMetadataCoverArt } from "$/utils/color-extract";
import { SpicyBackground, useCoverPalette } from "$/components/SpicyLyrics/SpicyBackground";
import styles from "./index.module.css";

const displayTimeAtom = atom(0);

/**
 * A registry to hold references to active word DOM elements.
 * This allows us to update the --progress CSS variable directly at high frequency
 * without triggering React re-renders.
 */
const wordRegistry = new Map<string, { el: HTMLSpanElement; word: any }>();

// A single word span - static version (no time subscription)
const StaticWord = memo(({ word }: { word: any }) => (
	<span className={styles.wordStatic}>{word.word}</span>
));

// A single word span - active version (subscribes to time at a lower frequency)
const ActiveWord = memo(({ word, onWordClick }: { word: any; onWordClick: (t: number) => void }) => {
	const currentTime = useAtomValue(displayTimeAtom);
	const spanRef = useRef<HTMLSpanElement>(null);
	
	const isWordActive = currentTime >= word.startTime && currentTime <= word.endTime;
	const isWordPast = currentTime > word.endTime;
	const fadeWidth = useAtomValue(lyricWordFadeWidthAtom);

	// Register the element for high-frequency direct DOM updates
	useEffect(() => {
		if (isWordActive && spanRef.current) {
			wordRegistry.set(word.id || `${word.startTime}`, { el: spanRef.current, word });
			return () => {
				wordRegistry.delete(word.id || `${word.startTime}`);
			};
		}
	}, [isWordActive, word]);

	// Initial progress for the first render or when state changes
	const progress = isWordActive 
		? Math.min(Math.max((currentTime - word.startTime) / (word.endTime - word.startTime), 0), 1)
		: (isWordPast ? 1 : 0);
	const progressPercent = (progress * 100).toFixed(2);

	return (
		<span
			ref={spanRef}
			className={classNames(styles.word, isWordActive && styles.wordActive, isWordPast && styles.wordPast)}
			data-active={isWordActive}
			style={{ 
				"--progress": `${progressPercent}%`,
				"--fade-width": `${(fadeWidth * 20).toFixed(2)}px` // Scale for visibility
			} as any}
			onClick={(e) => { e.stopPropagation(); onWordClick(word.startTime); }}
		>
			{word.word}
		</span>
	);
});

/**
 * A "line group" = one main line + any co-timed BG lines beneath it.
 */
interface LineGroup {
	main: any;
	bg: any[];
}

const LyricLineItem = memo(({ 
	line, 
	isBG, 
	onWordClick 
}: { 
	line: any; 
	isBG?: boolean; 
	onWordClick: (t: number) => void 
}) => {
	const displayTime = useAtomValue(displayTimeAtom);
	const showTranslation = useAtomValue(showTranslationLinesAtom);
	const showRoman = useAtomValue(showRomanLinesAtom);

	const isLineActive = displayTime >= line.startTime && displayTime <= line.endTime;
	const isLinePast = displayTime > line.endTime;

	return (
		<div className={classNames(
			styles.line,
			isBG && styles.lineBG,
			isLineActive && (isBG ? styles.lineBGActive : styles.lineActive),
			isLinePast && styles.linePast,
			line.isDuet && styles.lineDuetR,
			line.isMiddle && styles.lineMiddle,
		)}>
			<div className={styles.wordsContainer}>
				{line.words.map((w: any, i: number) => {
					if (isLineActive) {
						return <ActiveWord key={w.id || i} word={w} onWordClick={onWordClick} />;
					}
					return <StaticWord key={w.id || i} word={w} />;
				})}
			</div>
			{showTranslation && line.translatedLyric && <span className={styles.extraLine}>{line.translatedLyric}</span>}
			{showRoman && line.romanLyric && <span className={styles.extraLine}>{line.romanLyric}</span>}
		</div>
	);
});

const LineGroupView = memo(({ 
	group, 
	onLineClick, 
	onWordClick 
}: { 
	group: LineGroup; 
	onLineClick: (line: any) => void; 
	onWordClick: (t: number) => void 
}) => {
	const displayTime = useAtomValue(displayTimeAtom);
	const isMainActive = displayTime >= group.main.startTime && displayTime <= group.main.endTime;
	const isBgActive = group.bg.some((b: any) => displayTime >= b.startTime && displayTime <= b.endTime);
	const isAnyActive = isMainActive || isBgActive;

	const isMainPast = displayTime > group.main.endTime;
	const isAllPast = isMainPast && group.bg.every((b: any) => displayTime > b.endTime);

	return (
		<div 
			onClick={() => onLineClick(group.main)}
			className={classNames(
				styles.lineGroup,
				isAnyActive && styles.lineGroupActive,
				isAllPast && styles.lineGroupPast,
				group.main.isDuet && styles.lineGroupDuet,
				group.main.isMiddle && styles.lineGroupMiddle,
			)}
		>
			<LyricLineItem line={group.main} onWordClick={onWordClick} />
			{group.bg.map((bgLine, i) => (
				<LyricLineItem key={bgLine.id || i} line={bgLine} isBG onWordClick={onWordClick} />
			))}
		</div>
	);
});

export const AMLLWrapper = memo(({ variant }: { variant?: "standard" | "toxi" }) => {
	const isToxi = variant === "toxi";
	const vsync = useAtomValue(vsyncAtom);
	const showFps = useAtomValue(showFpsCounterAtom);
	const setDisplayTime = useSetAtom(displayTimeAtom);
	const lastUpdateRef = useRef(0);
	const [fps, setFps] = useState(0);
	const fpsRef = useRef({ frames: 0, lastTime: performance.now() });

	useEffect(() => {
		let rafId: number;
		let lastAudioTime = audioEngine.musicCurrentTime;
		let interpolatedTime = lastAudioTime;
		let lastRealTime = performance.now();

		const loop = () => {
			const now = performance.now();
			const audioTime = audioEngine.musicCurrentTime;
			const isPlaying = audioEngine.musicPlaying;

			if (!isPlaying) {
				setDisplayTime(audioTime * 1000);
				lastAudioTime = audioTime;
				interpolatedTime = audioTime;
				lastRealTime = now;
			} else {
				if (audioTime !== lastAudioTime) {
					interpolatedTime = audioTime;
					lastAudioTime = audioTime;
				} else {
					const dt = (now - lastRealTime) / 1000;
					interpolatedTime += dt * audioEngine.musicPlayBackRate;
				}
				lastRealTime = now;

				const displayMs = interpolatedTime * 1000;
				
				/**
				 * Split-Rate Optimization:
				 * 1. Visual updates (DOM) happen at the monitor's full refresh rate (rAF).
				 * 2. Logic updates (React State) happen at a capped rate (max 60Hz) to save CPU.
				 */
				
				// Update all registered active words directly via DOM
				wordRegistry.forEach(({ el, word }) => {
					const progress = Math.min(Math.max((displayMs - word.startTime) / (word.endTime - word.startTime), 0), 1);
					// Using simple rounding instead of toFixed to reduce string garbage
					el.style.setProperty("--progress", `${Math.round(progress * 1000) / 10}%`);
				});

				if (vsync) {
					// Even with vsync, we cap the React update if the frequency is extremely high, 
					// but we allow 60Hz for logic consistency.
					if (now - lastUpdateRef.current >= 16.6) { 
						setDisplayTime(displayMs);
						lastUpdateRef.current = now;
					}
				} else {
					// Capped logic update (30Hz) when vsync is off to maximize efficiency
					if (now - lastUpdateRef.current >= 33.3) { 
						setDisplayTime(displayMs);
						lastUpdateRef.current = now;
					}
				}
			}

			// Calculate FPS
			fpsRef.current.frames++;
			if (now - fpsRef.current.lastTime >= 1000) {
				setFps(Math.round((fpsRef.current.frames * 1000) / (now - fpsRef.current.lastTime)));
				fpsRef.current.frames = 0;
				fpsRef.current.lastTime = now;
			}

			rafId = requestAnimationFrame(loop);
		};

		rafId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafId);
	}, [vsync, setDisplayTime]);

	const lyrics = useAtomValue(lyricLinesAtom);
	const displayTime = useAtomValue(displayTimeAtom);
	const activeLineIds = useAtomValue(activeLineIdsAtom); 
	const darkMode = useAtomValue(isDarkThemeAtom);
	const projectIdentity = useAtomValue(projectIdentityAtom);
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const setSelectedLines = useSetAtom(selectedLinesAtom);

	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const lastScrolledId = useRef<string | null>(null);

	// Group lines: in the AMLL data format, a BG vocal line (isBG: true) is
	// ALWAYS placed immediately after its parent main line in the sorted array.
	// This is guaranteed by the TTML→AMLL converter (amll-converter.ts line 149-156).
	// So we just scan in order and attach BG lines to the preceding main line.
	const lineGroups = useMemo((): LineGroup[] => {
		const sorted = [...lyrics.lyricLines].sort((a, b) => a.startTime - b.startTime);
		const groups: LineGroup[] = [];

		for (let i = 0; i < sorted.length; i++) {
			const line = sorted[i];
			if (line.isBG) {
				// Attach to the last group if one exists
				if (groups.length > 0) {
					groups[groups.length - 1].bg.push(line);
				} else {
					groups.push({ main: line, bg: [] });
				}
			} else {
				groups.push({ main: line, bg: [] });
			}
		}

		return groups;
	}, [lyrics.lyricLines]);

	const activeLineIdsSet = useMemo(() => new Set(activeLineIds), [activeLineIds]);

	// Scroll to the active group
	useEffect(() => {
		const activeGroupIndex = lineGroups.findIndex(
			g => (displayTime >= g.main.startTime && displayTime <= g.main.endTime) ||
				g.bg.some(b => displayTime >= b.startTime && displayTime <= b.endTime)
		);
		if (activeGroupIndex === -1) { lastScrolledId.current = null; return; }

		const groupId = lineGroups[activeGroupIndex].main.id;
		if (groupId === lastScrolledId.current) return;
		lastScrolledId.current = groupId;

		const container = scrollContainerRef.current;
		if (container) {
			// +1 because of the <div className={styles.padding} /> at index 0
			const groupEl = container.children[activeGroupIndex + 1] as HTMLElement;
			if (groupEl) {
				const targetScroll = groupEl.offsetTop - (container.clientHeight * 0.40) + (groupEl.clientHeight / 2);
				container.scrollTo({ top: targetScroll, behavior: "smooth" });
			}
		}
	}, [displayTime, lineGroups]);

	const handleLineClick = (line: any) => {
		setCurrentTime(line.startTime);
		setSelectedLines(new Set([line.id]));
		audioEngine.seekMusic(line.startTime / 1000);
	};

	const handleWordClick = (time: number) => {
		setCurrentTime(time);
		audioEngine.seekMusic(time / 1000);
	};

	const instantFade = useAtomValue(instantHighlightFadeAtom);
	const embeddedCoverArt = useAtomValue(audioCoverArtAtom);
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const backgroundMode = useAtomValue(spicyBackgroundModeAtom);

	const useCustomAccent = useAtomValue(useCustomAccentAtom);
	const customAccentColor = useAtomValue(customAccentColorAtom);
	const accentColor = useCustomAccent && customAccentColor ? customAccentColor : "#5c6cff";

	// Resolve background image: embedded cover art > metadata cover art > custom background
	const coverArtFromMetadata = useMemo(
		() => findMetadataCoverArt(lyrics.metadata),
		[lyrics.metadata],
	);
	const backgroundImage = embeddedCoverArt ?? coverArtFromMetadata ?? customBackgroundImage;
	const coverPalette = useCoverPalette(backgroundImage);

	return (
		<div className={classNames(
			styles.amllWrapper, 
			darkMode && styles.isDark, 
			isToxi && styles.isToxi,
			instantFade && styles.hasInstantFade
		)}
		style={{
			"--spicy-accent": accentColor,
			"--spicy-cover-base": coverPalette?.base,
			"--spicy-cover-highlight": coverPalette?.highlight,
		} as CSSProperties}
		>
			{/* SpicyBackground — animated album art warp */}
			<SpicyBackground
				backgroundMode={backgroundMode}
				backgroundImage={backgroundImage}
				accentColor={accentColor}
			/>
			<div className={styles.contentOverlay}>
				<div className={styles.header}>
					<h3>{projectIdentity.name || "Untitled"}</h3>
					<span>{projectIdentity.artist || "Unknown Artist"}</span>
				</div>

				<div className={styles.lyricsViewport} ref={scrollContainerRef}>
					<div className={styles.padding} />
					{lineGroups.map((group) => (
						<LineGroupView
							key={group.main.id}
							group={group}
							onLineClick={handleLineClick}
							onWordClick={handleWordClick}
						/>
					))}
					<div className={styles.padding} />
				</div>
			</div>
			{showFps && (
				<div style={{
					position: "absolute",
					bottom: 10,
					right: 10,
					background: "rgba(0,0,0,0.5)",
					color: "#0f0",
					fontFamily: "monospace",
					fontSize: "12px",
					padding: "2px 6px",
					borderRadius: "4px",
					pointerEvents: "none",
					zIndex: 1000,
				}}>
					FPS: {fps}
				</div>
			)}
		</div>
	);
});

export default AMLLWrapper;

