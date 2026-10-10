import type { RenderReport } from "../worklet/protocol";

export function seekFrame(seconds: number, sampleRate: number, length: number) {
	if (Number.isNaN(seconds)) return 0;
	return Math.max(0, Math.min(length, Math.round(seconds * sampleRate)));
}

export function replayFrame(frame: number, sampleRate: number, length: number) {
	return frame >= length - Math.max(1, sampleRate * 0.01) ? 0 : frame;
}

/** A bounded history of frames actually rendered, never a wall-clock extrapolation. */
export class PcmClock {
	private reports: RenderReport[] = [];
	private initialFrame = 0;
	generation = 0;

	reset(generation: number, frame: number) {
		this.generation = generation;
		this.initialFrame = frame;
		this.reports = [];
	}

	/** Keep the history and accept a generation that resumes where the last one stopped. */
	continueAs(generation: number) {
		this.generation = generation;
	}

	/** The last frame handed to the device, ahead of what is audible by the output latency. */
	get renderedFrame() {
		return this.reports[this.reports.length - 1]?.endFrame ?? this.initialFrame;
	}

	push(report: RenderReport) {
		if (report.generation !== this.generation) return false;
		this.reports.push(report);
		// Covers unusually large device latency without retaining a song of reports.
		if (this.reports.length > 4096) {
			this.initialFrame = this.reports[0].endFrame;
			this.reports.shift();
		}
		return true;
	}

	frameAt(audibleContextTime: number, sampleRate: number) {
		// Audible time only moves forward, so blocks already fully heard can go.
		while (
			this.reports.length > 1 &&
			this.reports[1].contextTime <= audibleContextTime
		) {
			this.initialFrame = this.reports[0].endFrame;
			this.reports.shift();
		}
		let frame = this.initialFrame;
		for (const report of this.reports) {
			if (audibleContextTime < report.contextTime) break;
			const duration = report.renderedFrames / sampleRate;
			const ratio =
				duration > 0
					? Math.min(1, (audibleContextTime - report.contextTime) / duration)
					: 1;
			frame = report.startFrame + (report.endFrame - report.startFrame) * ratio;
		}
		return frame;
	}
}
