export const PROJECT_TIME_STORAGE_KEY = "discordPresenceProjectTime";

type ProjectTimes = Record<string, number>;

interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

const readProjectTimes = (storage: StorageLike): ProjectTimes => {
	try {
		const parsed: unknown = JSON.parse(
			storage.getItem(PROJECT_TIME_STORAGE_KEY) ?? "{}",
		);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			return {};

		return Object.fromEntries(
			Object.entries(parsed).filter(
				(entry): entry is [string, number] =>
					typeof entry[1] === "number" &&
					Number.isFinite(entry[1]) &&
					entry[1] >= 0,
			),
		);
	} catch {
		return {};
	}
};

export class ProjectTimeTracker {
	private readonly times: ProjectTimes;
	private projectId: string | null = null;
	private startedAt = 0;

	constructor(
		private readonly storage: StorageLike,
		private readonly now: () => number = Date.now,
	) {
		this.times = readProjectTimes(storage);
	}

	switchProject(projectId: string) {
		const now = this.now();
		this.recordCurrent(now);
		this.projectId = projectId;
		this.startedAt = now;
	}

	getElapsedSeconds(projectId = this.projectId) {
		if (!projectId || projectId !== this.projectId) return 0;
		return (
			(this.times[projectId] ?? 0) +
			Math.max(0, this.now() - this.startedAt) / 1000
		);
	}

	flush() {
		this.recordCurrent(this.now());
		try {
			this.storage.setItem(
				PROJECT_TIME_STORAGE_KEY,
				JSON.stringify(this.times),
			);
		} catch {
			// Presence timing should never break the editor when storage is unavailable.
		}
	}

	private recordCurrent(now: number) {
		if (!this.projectId) return;
		this.times[this.projectId] =
			(this.times[this.projectId] ?? 0) +
			Math.max(0, now - this.startedAt) / 1000;
		this.startedAt = now;
	}
}
