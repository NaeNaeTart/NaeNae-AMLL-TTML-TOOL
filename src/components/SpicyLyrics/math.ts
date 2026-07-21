/*
 * Adapted from Spicy Lyrics' Spring module (AGPL-3.0-or-later).
 * Original project: https://github.com/Spikerko/Spicy-Lyrics
 */

const EPS = 1e-5;

export class Spring {
	private goal: number;
	private position: number;
	private velocity = 0;

	constructor(
		start: number,
		private frequency: number,
		private damping: number,
	) {
		this.goal = start;
		this.position = start;
	}

	setGoal(goal: number, snap = false) {
		this.goal = goal;
		if (snap) {
			this.position = goal;
			this.velocity = 0;
		}
	}

	step(seconds: number) {
		const dt = Math.min(Math.max(seconds, 0), 0.1);
		const f = this.frequency * 2 * Math.PI;
		const d = this.damping;
		const offset = this.position - this.goal;

		if (d === 1) {
			const q = Math.exp(-f * dt);
			const w = dt * q;
			this.position = offset * (q + w * f) + this.velocity * w + this.goal;
			this.velocity = this.velocity * (q - w * f) - offset * w * f * f;
		} else if (d < 1) {
			const q = Math.exp(-d * f * dt);
			const c = Math.sqrt(1 - d * d);
			const i = Math.cos(dt * f * c);
			const j = Math.sin(dt * f * c);
			const z = c > EPS ? j / c : dt * f;
			const y = f * c > EPS ? j / (f * c) : dt;
			this.position =
				(offset * (i + z * d) + this.velocity * y) * q + this.goal;
			this.velocity = (this.velocity * (i - z * d) - offset * z * f) * q;
		} else {
			const c = Math.sqrt(d * d - 1);
			const r1 = -f * (d + c);
			const r2 = -f * (d - c);
			const co2 = (this.velocity - offset * r1) / (2 * f * c);
			const co1 = Math.exp(r1 * dt) * (offset - co2);
			this.position = co1 + co2 * Math.exp(r2 * dt) + this.goal;
			this.velocity = co1 * r1 + co2 * Math.exp(r2 * dt) * r2;
		}
		return this.position;
	}
}

export const clamp = (value: number, min = 0, max = 1) =>
	Math.min(max, Math.max(min, value));

/** Natural cubic spline, intentionally self-contained to avoid a renderer dependency. */
export class CubicSpline {
	private a: number[];
	private b: number[] = [];
	private c: number[] = [];
	private d: number[] = [];
	private xs: number[];

	constructor(points: ReadonlyArray<readonly [number, number]>) {
		this.xs = points.map(([x]) => x);
		this.a = points.map(([, y]) => y);
		const n = points.length - 1;
		const h = Array.from({ length: n }, (_, i) => this.xs[i + 1] - this.xs[i]);
		const alpha = Array.from({ length: n }, () => 0);
		for (let i = 1; i < n; i++)
			alpha[i] =
				(3 / h[i]) * (this.a[i + 1] - this.a[i]) -
				(3 / h[i - 1]) * (this.a[i] - this.a[i - 1]);
		const l = Array.from({ length: n + 1 }, () => 0);
		const mu = Array.from({ length: n + 1 }, () => 0);
		const z = Array.from({ length: n + 1 }, () => 0);
		l[0] = 1;
		for (let i = 1; i < n; i++) {
			l[i] = 2 * (this.xs[i + 1] - this.xs[i - 1]) - h[i - 1] * mu[i - 1];
			mu[i] = h[i] / l[i];
			z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
		}
		l[n] = 1;
		this.c[n] = 0;
		for (let j = n - 1; j >= 0; j--) {
			this.c[j] = z[j] - mu[j] * this.c[j + 1];
			this.b[j] =
				(this.a[j + 1] - this.a[j]) / h[j] -
				(h[j] * (this.c[j + 1] + 2 * this.c[j])) / 3;
			this.d[j] = (this.c[j + 1] - this.c[j]) / (3 * h[j]);
		}
	}

	at(x: number) {
		let i = this.xs.length - 2;
		for (let j = 0; j < this.xs.length - 1; j++)
			if (x < this.xs[j + 1]) {
				i = j;
				break;
			}
		const dx = x - this.xs[i];
		return (
			this.a[i] + this.b[i] * dx + this.c[i] * dx ** 2 + this.d[i] * dx ** 3
		);
	}
}

export const stateAt = (time: number, start: number, end: number) =>
	time < start ? "not-sung" : time >= end ? "sung" : "active";
export const progressAt = (time: number, start: number, end: number) =>
	end <= start ? 1 : clamp((time - start) / (end - start));
