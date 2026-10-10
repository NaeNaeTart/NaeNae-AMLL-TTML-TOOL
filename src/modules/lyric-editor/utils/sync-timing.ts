import { SyncJudgeMode } from "$/modules/settings/states";
import type { LyricLine, LyricWord } from "$/types/ttml";

export interface SyncKeyTiming {
	downTimeOffset: number;
	triggerTime: number;
}

interface CalculateSyncTimeOptions {
	audioTimeSeconds: number;
	playbackRate: number;
	isPlaying: boolean;
	event: SyncKeyTiming;
	judgeMode: SyncJudgeMode;
	syncTimeOffset: number;
	actionOffset?: number;
	performanceTime: number;
	performanceTimeOrigin?: number;
}

function eventTimeOnPerformanceClock(
	eventTime: number,
	performanceTimeOrigin: number,
) {
	return eventTime > 1_000_000_000_000
		? eventTime - performanceTimeOrigin
		: eventTime;
}

export function calculateSyncTime({
	audioTimeSeconds,
	playbackRate,
	isPlaying,
	event,
	judgeMode,
	syncTimeOffset,
	actionOffset = 0,
	performanceTime,
	performanceTimeOrigin = 0,
}: CalculateSyncTimeOptions) {
	// A paused playhead does not move while the key is held or handled, so there
	// is no delay to compensate: every press gives the same time.
	if (!isPlaying) {
		return Math.round(
			Math.max(0, audioTimeSeconds * 1000 + syncTimeOffset + actionOffset),
		);
	}

	const eventTime = eventTimeOnPerformanceClock(
		event.triggerTime,
		performanceTimeOrigin,
	);
	const rawProcessingDelay = performanceTime - eventTime;
	const processingDelay =
		Number.isFinite(rawProcessingDelay) && rawProcessingDelay >= 0
			? rawProcessingDelay
			: 0;
	const audioTimeAtEvent =
		audioTimeSeconds * 1000 - processingDelay * playbackRate;

	let keyAdjustment = 0;
	if (judgeMode === SyncJudgeMode.FirstKeyDownTimeLegacy) {
		keyAdjustment = -event.downTimeOffset;
	} else if (isPlaying) {
		switch (judgeMode) {
			case SyncJudgeMode.FirstKeyDownTime:
				keyAdjustment = -event.downTimeOffset * playbackRate;
				break;
			case SyncJudgeMode.MiddleKeyTime:
				keyAdjustment = -(event.downTimeOffset / 2) * playbackRate;
				break;
		}
	}

	return Math.round(
		Math.max(
			0,
			audioTimeAtEvent + keyAdjustment + syncTimeOffset + actionOffset,
		),
	);
}

function cloneWordWithRuby(word: LyricWord): LyricWord {
	return {
		...word,
		ruby: word.ruby ? word.ruby.map((ruby) => ({ ...ruby })) : undefined,
	};
}

function updateRubyParentTime(word: LyricWord) {
	const ruby = word.ruby;
	if (!ruby || ruby.length === 0) return;
	word.startTime = Math.min(...ruby.map((part) => part.startTime));
	word.endTime = Math.max(...ruby.map((part) => part.endTime));
}

export function setPendingUnitTimeCloned(
	line: LyricLine,
	wordIndex: number,
	rubyIndex: number | undefined,
	time: number,
) {
	const previousWord = line.words[wordIndex];
	if (!previousWord) return;
	const nextWord = cloneWordWithRuby(previousWord);

	if (rubyIndex !== undefined && nextWord.ruby?.[rubyIndex]) {
		nextWord.ruby[rubyIndex] = {
			...nextWord.ruby[rubyIndex],
			startTime: time,
			endTime: time,
		};
		updateRubyParentTime(nextWord);
	} else {
		nextWord.startTime = time;
		nextWord.endTime = time;
	}

	line.words[wordIndex] = nextWord;
}
