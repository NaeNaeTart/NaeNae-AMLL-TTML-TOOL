import { Box, Card, Flex, Text, Tooltip } from "@radix-ui/themes";
import classNames from "classnames";
import { useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ViewportList } from "react-viewport-list";
import { audioPlayingAtom, currentTimeAtom } from "$/modules/audio/states";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	editorAutoScrollEnabledAtom,
	previewModeTypeAtom,
	PreviewModeType,
} from "$/modules/settings/states/preview";
import { keyLocateActiveLineAtom } from "$/states/keybindings";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main.ts";
import { useKeyBindingAtom } from "$/utils/keybindings";
import { msToTimestamp } from "$/utils/timestamp";
import styles from "./index.module.css";

const easeInOutCubic = (x: number): number => {
	return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

const smoothScrollContainer = (
	element: HTMLElement,
	targetScrollTop: number,
	onStart?: () => void,
	onFinish?: () => void,
): (() => void) => {
	const start = element.scrollTop;
	const distance = targetScrollTop - start;
	if (Math.abs(distance) < 2) return () => {};

	const duration = Math.min(750, Math.max(350, Math.abs(distance) * 0.45));
	const startTime = performance.now();
	let cancelled = false;
	let animId = 0;

	onStart?.();

	const cancel = () => {
		if (cancelled) return;
		cancelled = true;
		if (animId) cancelAnimationFrame(animId);
		cleanup();
		onFinish?.();
	};

	const cleanup = () => {
		element.removeEventListener("wheel", cancel, true);
		element.removeEventListener("touchmove", cancel, true);
		element.removeEventListener("touchstart", cancel, true);
		element.removeEventListener("pointerdown", cancel, true);
		element.removeEventListener("mousedown", cancel, true);
		window.removeEventListener("wheel", cancel, true);
		window.removeEventListener("touchmove", cancel, true);
		window.removeEventListener("touchstart", cancel, true);
		window.removeEventListener("pointerdown", cancel, true);
		window.removeEventListener("mousedown", cancel, true);
	};

	element.addEventListener("wheel", cancel, { capture: true, passive: true });
	element.addEventListener("touchmove", cancel, { capture: true, passive: true });
	element.addEventListener("touchstart", cancel, { capture: true, passive: true });
	element.addEventListener("pointerdown", cancel, { capture: true, passive: true });
	element.addEventListener("mousedown", cancel, { capture: true, passive: true });
	window.addEventListener("wheel", cancel, { capture: true, passive: true });
	window.addEventListener("touchmove", cancel, { capture: true, passive: true });
	window.addEventListener("touchstart", cancel, { capture: true, passive: true });
	window.addEventListener("pointerdown", cancel, { capture: true, passive: true });
	window.addEventListener("mousedown", cancel, { capture: true, passive: true });

	const step = (now: number) => {
		if (cancelled) return;
		const elapsed = now - startTime;
		const progress = Math.min(1, elapsed / duration);
		const ease = easeInOutCubic(progress);
		element.scrollTop = start + distance * ease;

		if (progress < 1) {
			animId = requestAnimationFrame(step);
		} else {
			cleanup();
			onFinish?.();
		}
	};

	animId = requestAnimationFrame(step);
	return cancel;
};

const WordPill = memo(({ word, currentTime, isGrouped }: { word: any, currentTime: number, isGrouped?: boolean }) => {
	const { t } = useTranslation();
	const isWordActive = currentTime >= word.startTime && currentTime <= word.endTime;
	const wordDur = word.endTime - word.startTime;
	const isWhitespace = !word.word || word.word.trim() === "";

	if (isWhitespace && wordDur === 0 && word.emptyBeat === 0) {
		return <div style={{ width: "4px" }} />;
	}

	const content = (
		<div className={classNames(
			styles.wordPill, 
			isWordActive && styles.wordPillActive, 
			isWhitespace && styles.whitespacePill,
			isGrouped && styles.groupedWordPill
		)}>
			<Text className={styles.wordText}>
				{isWhitespace ? (word.word || <span className={styles.emptyBeat}>∅</span>) : word.word}
			</Text>
			{(!isWhitespace || wordDur > 0) && (
				<Text className={classNames(styles.wordTime, styles.monospaced)}>{wordDur}ms</Text>
			)}
		</div>
	);

	return (
		<Tooltip
			content={
				<Flex direction="column" gap="1">
					<Text size="1">{t("timingOverview.start", "Start")}: {msToTimestamp(word.startTime)}</Text>
					<Text size="1">{t("timingOverview.end", "End")}: {msToTimestamp(word.endTime)}</Text>
					<Text size="1">{t("timingOverview.duration", "Duration")}: {wordDur}ms</Text>
					{word.emptyBeat > 0 && <Text size="1" color="orange">{t("timingOverview.emptyBeat", "Empty Beat")}: {word.emptyBeat}</Text>}
					{word.romanWord && <Text size="1">{t("timingOverview.romanization", "Roman")}: {word.romanWord}</Text>}
				</Flex>
			}
		>
			{content}
		</Tooltip>
	);
}, (prev, next) => {
	const wasActive = prev.currentTime >= prev.word.startTime && prev.currentTime <= prev.word.endTime;
	const isActive = next.currentTime >= next.word.startTime && next.currentTime <= next.word.endTime;
	if (wasActive || isActive) return false;
	return prev.word === next.word;
});

const WordGroup = memo(({ words, currentTime }: { words: any[], currentTime: number }) => {
	return (
		<div className={styles.wordGroup}>
			{words.map((word, index) => (
				<WordPill key={word.id || index} word={word} currentTime={currentTime} isGrouped={true} />
			))}
		</div>
	);
});

const LineRow = memo(({ 
	line, 
	index, 
	currentTime, 
	totalDuration,
	onRowClick 
}: { 
	line: any, 
	index: number, 
	currentTime: number, 
	totalDuration: number,
	onRowClick: (line: any) => void
}) => {
	const { t } = useTranslation();
	const isActive = currentTime >= line.startTime && currentTime <= line.endTime;
	const duration = line.endTime - line.startTime;
	const durationPercent = totalDuration ? (duration / totalDuration) * 100 : 0;

	const wordGroups = useMemo(() => {
		const groups: { type: 'words' | 'whitespace', items?: any[], word?: any }[] = [];
		let currentGroup: any[] = [];
		
		for (const word of line.words) {
			const isWhitespace = !word.word || word.word.trim() === "";
			if (isWhitespace) {
				if (currentGroup.length > 0) {
					groups.push({ type: 'words', items: currentGroup });
					currentGroup = [];
				}
				groups.push({ type: 'whitespace', word });
			} else {
				currentGroup.push(word);
			}
		}
		if (currentGroup.length > 0) {
			groups.push({ type: 'words', items: currentGroup });
		}
		return groups;
	}, [line.words]);

	return (
		<div
			className={classNames(styles.row, isActive && styles.activeRow)}
			onClick={() => onRowClick(line)}
			data-timing-line-index={index}
			style={{ display: "flex", borderBottom: "1px solid var(--gray-4)" }}
		>
			<div className={classNames(styles.monospaced, styles.cell)} style={{ width: "40px", padding: "8px 12px" }}>{index + 1}</div>
			<div className={classNames(styles.monospaced, styles.cell)} style={{ width: "100px", padding: "8px 12px" }}>{msToTimestamp(line.startTime)}</div>
			<div className={classNames(styles.monospaced, styles.cell)} style={{ width: "100px", padding: "8px 12px" }}>{msToTimestamp(line.endTime)}</div>
			<div className={styles.cell} style={{ width: "80px", padding: "8px 12px" }}>
				<Flex direction="column" gap="1">
					<Text size="1" className={styles.monospaced}>{(duration / 1000).toFixed(3)}s</Text>
					<div className={styles.durationBar} style={{ width: `${Math.min(100, durationPercent * 10)}%` }} />
				</Flex>
			</div>
			<div className={styles.cell} style={{ flexGrow: 1, padding: "8px 12px", minWidth: 0 }}>
				<Box>
					<Flex align="center" gap="2" mb="1">
						<Text className={styles.lineText}>{line.words.map((w: any) => w.word).join("")}</Text>
						{line.isBG && <Text size="1" style={{ background: "var(--accent-9)", color: "white", padding: "0 4px", borderRadius: "2px", fontSize: "9px" }}>{t("timingOverview.backgroundVocal", "BG")}</Text>}
					</Flex>
					<div className={styles.wordPills}>
						{wordGroups.map((group, gIdx) => (
							group.type === 'words' ? (
								<WordGroup key={`g-${gIdx}`} words={group.items!} currentTime={currentTime} />
							) : (
								<WordPill key={`w-${gIdx}`} word={group.word} currentTime={currentTime} />
							)
						))}
					</div>
				</Box>
			</div>
		</div>
	);
}, (prev, next) => {
	const wasActive = prev.currentTime >= prev.line.startTime && prev.currentTime <= prev.line.endTime;
	const isActive = next.currentTime >= next.line.startTime && next.currentTime <= next.line.endTime;
	if (wasActive || isActive) return false;
	return prev.line === next.line && prev.totalDuration === next.totalDuration;
});

export const TimingOverview = memo(() => {
	const { t } = useTranslation();
	const lyrics = useAtomValue(lyricLinesAtom);
	const currentTime = useAtomValue(currentTimeAtom);
	const audioPlaying = useAtomValue(audioPlayingAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const scrollRef = useRef<HTMLDivElement>(null);

	const sortedLines = useMemo(() => {
		return [...lyrics.lyricLines].sort((a, b) => a.startTime - b.startTime);
	}, [lyrics.lyricLines]);

	const totalDuration = useMemo(() => {
		if (sortedLines.length === 0) return 0;
		return sortedLines[sortedLines.length - 1].endTime - sortedLines[0].startTime;
	}, [sortedLines]);

	const stats = useMemo(() => {
		const lineCount = sortedLines.length;
		const wordCount = sortedLines.reduce((acc, line) => acc + line.words.length, 0);
		const totalMs = lineCount > 0 ? sortedLines[lineCount - 1].endTime - sortedLines[0].startTime : 0;
		return { lineCount, wordCount, totalMs };
	}, [sortedLines]);

	const autoScrollEnabled = useAtomValue(editorAutoScrollEnabledAtom);
	const previewMode = useAtomValue(previewModeTypeAtom);
	const pauseUntilRef = useRef(0);
	const lastActiveIndexRef = useRef<number>(-1);
	const isProgrammaticScrollingRef = useRef(false);
	const activeScrollCancelRef = useRef<(() => void) | null>(null);

	const handleLocateTiming = useCallback(() => {
		const cur = currentTime;
		const activeIndex = sortedLines.findIndex((l) => cur >= l.startTime && cur <= l.endTime);
		if (activeIndex === -1) return;

		setSelectedLines(new Set());
		pauseUntilRef.current = 0;
		lastActiveIndexRef.current = -1;

		const viewport = scrollRef.current;
		if (!viewport) return;

		let target = 0;
		const el = viewport.querySelector(`[data-timing-line-index="${activeIndex}"]`) as HTMLElement | null;
		if (el) {
			target =
				el.getBoundingClientRect().top -
				viewport.getBoundingClientRect().top +
				viewport.scrollTop -
				viewport.clientHeight / 2 +
				el.clientHeight / 2;
		} else {
			const totalItems = Math.max(1, sortedLines.length);
			const avgHeight = Math.max(60, viewport.scrollHeight / totalItems);
			target = activeIndex * avgHeight - viewport.clientHeight / 2 + avgHeight / 2;
		}

		activeScrollCancelRef.current?.();
		activeScrollCancelRef.current = smoothScrollContainer(
			viewport,
			Math.max(0, target),
			() => {
				isProgrammaticScrollingRef.current = true;
			},
			() => {
				isProgrammaticScrollingRef.current = false;
				activeScrollCancelRef.current = null;
			},
		);
	}, [currentTime, setSelectedLines, sortedLines]);

	useKeyBindingAtom(keyLocateActiveLineAtom, handleLocateTiming, [handleLocateTiming]);

	useEffect(() => {
		const onUserInteraction = () => {
			activeScrollCancelRef.current?.();
			activeScrollCancelRef.current = null;
			isProgrammaticScrollingRef.current = false;
			pauseUntilRef.current = performance.now() + 3500;
			lastActiveIndexRef.current = -1;
		};
		const onScroll = () => {
			if (isProgrammaticScrollingRef.current) return;
			activeScrollCancelRef.current?.();
			activeScrollCancelRef.current = null;
			pauseUntilRef.current = performance.now() + 3500;
			lastActiveIndexRef.current = -1;
		};

		const el = scrollRef.current;
		el?.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("wheel", onUserInteraction, { capture: true, passive: true });
		window.addEventListener("touchmove", onUserInteraction, { capture: true, passive: true });
		window.addEventListener("touchstart", onUserInteraction, { capture: true, passive: true });
		window.addEventListener("pointerdown", onUserInteraction, { capture: true, passive: true });
		window.addEventListener("mousedown", onUserInteraction, { capture: true, passive: true });

		return () => {
			activeScrollCancelRef.current?.();
			activeScrollCancelRef.current = null;
			el?.removeEventListener("scroll", onScroll);
			window.removeEventListener("wheel", onUserInteraction, true);
			window.removeEventListener("touchmove", onUserInteraction, true);
			window.removeEventListener("touchstart", onUserInteraction, true);
			window.removeEventListener("pointerdown", onUserInteraction, true);
			window.removeEventListener("mousedown", onUserInteraction, true);
		};
	}, [sortedLines.length]);

	useEffect(() => {
		if (!autoScrollEnabled || !audioPlaying || selectedLines.size > 0) {
			activeScrollCancelRef.current?.();
			activeScrollCancelRef.current = null;
			lastActiveIndexRef.current = -1;
			return;
		}
		if (previewMode !== PreviewModeType.Timing) {
			activeScrollCancelRef.current?.();
			activeScrollCancelRef.current = null;
			lastActiveIndexRef.current = -1;
			return;
		}
		if (performance.now() < pauseUntilRef.current) return;

		const activeIndex = sortedLines.findIndex((line) => currentTime >= line.startTime && currentTime <= line.endTime);
		if (activeIndex === -1) {
			activeScrollCancelRef.current?.();
			activeScrollCancelRef.current = null;
			lastActiveIndexRef.current = -1;
			return;
		}

		if (activeIndex === lastActiveIndexRef.current) return;
		lastActiveIndexRef.current = activeIndex;

		const viewport = scrollRef.current;
		if (!viewport) return;

		let target = 0;
		const el = viewport.querySelector(`[data-timing-line-index="${activeIndex}"]`) as HTMLElement | null;
		if (el) {
			target =
				el.getBoundingClientRect().top -
				viewport.getBoundingClientRect().top +
				viewport.scrollTop -
				viewport.clientHeight / 2 +
				el.clientHeight / 2;
		} else {
			const totalItems = Math.max(1, sortedLines.length);
			const avgHeight = Math.max(60, viewport.scrollHeight / totalItems);
			target = activeIndex * avgHeight - viewport.clientHeight / 2 + avgHeight / 2;
		}

		activeScrollCancelRef.current?.();
		activeScrollCancelRef.current = smoothScrollContainer(
			viewport,
			Math.max(0, target),
			() => {
				isProgrammaticScrollingRef.current = true;
			},
			() => {
				isProgrammaticScrollingRef.current = false;
				activeScrollCancelRef.current = null;
			},
		);
	}, [autoScrollEnabled, audioPlaying, selectedLines.size, previewMode, currentTime, sortedLines]);

	const handleRowClick = useMemo(() => (line: any) => {
		setCurrentTime(line.startTime);
		setSelectedLines(new Set([line.id]));
		audioEngine.seekMusic(line.startTime / 1000);
	}, [setCurrentTime, setSelectedLines]);

	return (
		<Card className={styles.timingOverview}>
			<div className={styles.header}>
				<Text size="2" weight="bold">{t("timingOverview.title", "Technical Timing Overview")}</Text>
				<div className={styles.stats}>
					<div className={styles.statItem}>
						<Text size="1">{t("timingOverview.lines", "Lines")}:</Text>
						<Text size="1" weight="bold">{stats.lineCount}</Text>
					</div>
					<div className={styles.statItem}>
						<Text size="1">{t("timingOverview.words", "Words")}:</Text>
						<Text size="1" weight="bold">{stats.wordCount}</Text>
					</div>
					<div className={styles.statItem}>
						<Text size="1">{t("timingOverview.duration", "Duration")}:</Text>
						<Text size="1" weight="bold" className={styles.monospaced}>{msToTimestamp(stats.totalMs)}</Text>
					</div>
				</div>
			</div>
			<div className={styles.scrollArea} ref={scrollRef}>
				<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
					<div className={styles.tableHeader} style={{ display: "flex", borderBottom: "1px solid var(--gray-6)", background: "var(--gray-2)", position: "sticky", top: 0, zIndex: 10 }}>
						<div style={{ width: "40px", padding: "8px 12px", fontWeight: 500, color: "var(--gray-11)", fontSize: "12px" }}>#</div>
						<div style={{ width: "100px", padding: "8px 12px", fontWeight: 500, color: "var(--gray-11)", fontSize: "12px" }}>{t("timingOverview.start", "Start")}</div>
						<div style={{ width: "100px", padding: "8px 12px", fontWeight: 500, color: "var(--gray-11)", fontSize: "12px" }}>{t("timingOverview.end", "End")}</div>
						<div style={{ width: "80px", padding: "8px 12px", fontWeight: 500, color: "var(--gray-11)", fontSize: "12px" }}>{t("timingOverview.duration", "Duration")}</div>
						<div style={{ flexGrow: 1, padding: "8px 12px", fontWeight: 500, color: "var(--gray-11)", fontSize: "12px" }}>{t("timingOverview.lyricsAndTimings", "Lyrics & Word Timings")}</div>
					</div>
					<ViewportList items={sortedLines} viewportRef={scrollRef}>
						{(line, index) => (
							<LineRow 
								key={line.id || index} 
								line={line} 
								index={index} 
								currentTime={currentTime} 
								totalDuration={totalDuration}
								onRowClick={handleRowClick}
							/>
						)}
					</ViewportList>
				</div>
			</div>
		</Card>
	);
});

export default TimingOverview;
