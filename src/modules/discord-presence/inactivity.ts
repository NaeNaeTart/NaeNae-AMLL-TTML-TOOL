export const shouldResetInactivity = (
	isTrusted: boolean,
	visibilityState: DocumentVisibilityState,
) => isTrusted && visibilityState === "visible";

export class InactivityTimer {
	private timer: ReturnType<typeof setTimeout> | null = null;
	private inactive = false;

	constructor(
		private timeoutMs: number,
		private readonly onChange: (inactive: boolean) => void,
	) {}

	start() {
		this.schedule();
	}

	activity() {
		if (this.inactive) {
			this.inactive = false;
			this.onChange(false);
		}
		this.schedule();
	}

	setTimeoutMs(timeoutMs: number) {
		this.timeoutMs = timeoutMs;
		this.schedule();
	}

	stop() {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
	}

	private schedule() {
		this.stop();
		this.timer = setTimeout(() => {
			this.timer = null;
			if (this.inactive) return;
			this.inactive = true;
			this.onChange(true);
		}, this.timeoutMs);
	}
}
