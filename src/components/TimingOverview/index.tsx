import { Box, Card, Checkbox, Flex, Text, Tooltip } from "@radix-ui/themes";
import classNames from "classnames";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ViewportList } from "react-viewport-list";
import { audioPlayingAtom, currentTimeAtom } from "$/modules/audio/states";
import { audioEngine } from "$/modules/audio/audio-engine";
import { timingOverviewAutoScrollAtom } from "$/modules/settings/states/sync.ts";
import { AUTO_SCROLL_PAUSE_MS } from "$/modules/lyric-editor/components/selection-scroll";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main.ts";
import { msToTimestamp } from "$/utils/timestamp";
import styles from "./index.module.css";

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
	const isActive = words.some(w => currentTime >= w.startTime && currentTime <= w.endTime);

	return (
		<div className={classNames(styles.wordGroup, isActive && styles.wordGroupActive)}>
			{words.map((word, idx) => (
				<div key={word.id || idx} style={{ display: "flex", alignItems: "center" }}>
					<WordPill word={word} currentTime={currentTime} isGrouped={true} />
					{idx < words.length - 1 && <div className={styles.wordDivider} />}
				</div>
			))}
		</div>
	);
}, (prev, next) => {
	const wasAnyActive = prev.words.some(w => prev.currentTime >= w.startTime && prev.currentTime <= w.endTime);
	const isAnyActive = next.words.some(w => next.currentTime >= w.startTime && next.currentTime <= next.endTime);
	
	if (wasAnyActive || isAnyActive) return false;
	if (prev.words.length !== next.words.length) return false;
	for (let i = 0; i < prev.words.length; i++) {
		if (prev.words[i] !== next.words[i]) return false;
	}
	return true;
});

const LineRow = memo(({ line, index, currentTime, totalDuration, onRowClick }: { 
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
			data-line-index={index}
			onClick={() => onRowClick(line)}
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
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const audioPlaying = useAtomValue(audioPlayingAtom);
	const [autoScroll, setAutoScroll] = useAtom(timingOverviewAutoScrollAtom);
	const scrollRef = useRef<HTMLDivElement>(null);
	const userScrolledAtRef = useRef<number>(0);
	const lastActiveIndexRef = useRef<number | undefined>(undefined);

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

	const handleRowClick = useMemo(() => (line: any) => {
		userScrolledAtRef.current = Date.now();
		setCurrentTime(line.startTime);
		setSelectedLines(new Set([line.id]));
		audioEngine.seekMusic(line.startTime / 1000);
	}, [setCurrentTime, setSelectedLines]);

	const scrollRafRef = useRef<number | null>(null);
	const lastProgrammaticScrollTimeRef = useRef<number>(0);
	const isPointerDownRef = useRef<boolean>(false);

	const cancelScrollAnimation = useCallback(() => {
		if (scrollRafRef.current !== null) {
			cancelAnimationFrame(scrollRafRef.current);
			scrollRafRef.current = null;
		}
	}, []);

	const smoothScrollTo = useCallback(
		(element: HTMLElement, targetTop: number, duration = 300) => {
			cancelScrollAnimation();
			const startTop = element.scrollTop;
			const distance = targetTop - startTop;
			if (Math.abs(distance) < 2) return;

			const startTime = performance.now();
			const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

			const step = (now: number) => {
				const elapsed = now - startTime;
				const progress = Math.min(elapsed / duration, 1);
				lastProgrammaticScrollTimeRef.current = performance.now();
				element.scrollTop = startTop + distance * easeOutCubic(progress);

				if (progress < 1) {
					scrollRafRef.current = requestAnimationFrame(step);
				} else {
					scrollRafRef.current = null;
				}
			};

			scrollRafRef.current = requestAnimationFrame(step);
		},
		[cancelScrollAnimation],
	);

	useEffect(() => {
		return () => {
			cancelScrollAnimation();
		};
	}, [cancelScrollAnimation]);

	useEffect(() => {
		const scrollEl = scrollRef.current;
		if (!scrollEl) return;
		const onPointerDown = () => {
			isPointerDownRef.current = true;
			cancelScrollAnimation();
			userScrolledAtRef.current = Date.now();
		};
		const onPointerUp = () => {
			if (!isPointerDownRef.current) return;
			isPointerDownRef.current = false;
			userScrolledAtRef.current = Date.now();
		};
		const onScroll = () => {
			if (performance.now() - lastProgrammaticScrollTimeRef.current < 50) return;
			cancelScrollAnimation();
			userScrolledAtRef.current = Date.now();
		};
		scrollEl.addEventListener("wheel", onPointerDown, { capture: true, passive: true });
		scrollEl.addEventListener("touchmove", onPointerDown, { capture: true, passive: true });
		scrollEl.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
		window.addEventListener("pointerup", onPointerUp, { capture: true, passive: true });
		window.addEventListener("pointercancel", onPointerUp, { capture: true, passive: true });
		scrollEl.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			scrollEl.removeEventListener("wheel", onPointerDown, { capture: true });
			scrollEl.removeEventListener("touchmove", onPointerDown, { capture: true });
			scrollEl.removeEventListener("pointerdown", onPointerDown, { capture: true });
			window.removeEventListener("pointerup", onPointerUp, { capture: true });
			window.removeEventListener("pointercancel", onPointerUp, { capture: true });
			scrollEl.removeEventListener("scroll", onScroll);
		};
	}, [cancelScrollAnimation]);

	useEffect(() => {
		if (!autoScroll || !audioPlaying) return;
		if (isPointerDownRef.current) return;
		if (selectedLines.size > 0) return;
		if (Date.now() - userScrolledAtRef.current < AUTO_SCROLL_PAUSE_MS) return;

		const activeIndex = sortedLines.findIndex(
			(l) => currentTime >= l.startTime && currentTime <= l.endTime,
		);
		if (activeIndex === -1 || activeIndex === lastActiveIndexRef.current) return;
		lastActiveIndexRef.current = activeIndex;

		const scrollEl = scrollRef.current;
		if (!scrollEl) return;
		const rowEl = scrollEl.querySelector<HTMLElement>(
			`[data-line-index="${activeIndex}"]`,
		);
		if (rowEl) {
			const rowRect = rowEl.getBoundingClientRect();
			const scrollRect = scrollEl.getBoundingClientRect();
			const targetTop =
				scrollEl.scrollTop +
				(rowRect.top - scrollRect.top) -
				scrollEl.clientHeight / 2 +
				rowRect.height / 2;
			smoothScrollTo(scrollEl, Math.max(0, targetTop), 300);
		}
	}, [autoScroll, audioPlaying, currentTime, sortedLines, smoothScrollTo, selectedLines]);

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
					<div
						className={styles.statItem}
						style={{
							marginLeft: "auto",
							display: "flex",
							alignItems: "center",
							gap: "6px",
						}}
					>
						<Text size="1">{t("timingOverview.autoScroll", "Auto-Scroll")}:</Text>
						<Checkbox
							checked={autoScroll}
							onCheckedChange={(v) => setAutoScroll(Boolean(v))}
						/>
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
