export const easeInOutCubic = (x: number): number => {
	return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

export const calculateSmoothDuration = (distance: number): number => {
	return Math.min(850, Math.max(350, Math.abs(distance) * 0.45));
};

export interface SmoothScrollController {
	cancel: () => void;
	getExpectedScrollTop: () => number;
}

export const smoothScrollContainer = (
	element: HTMLElement,
	getTargetTop: number | (() => number),
	onStart?: () => void,
	onFinish?: () => void,
): SmoothScrollController => {
	const getTarget =
		typeof getTargetTop === "function" ? getTargetTop : () => getTargetTop;
	const start = element.scrollTop;
	let currentTarget = getTarget();
	let distance = currentTarget - start;
	if (Math.abs(distance) < 2) {
		return {
			cancel: () => {},
			getExpectedScrollTop: () => element.scrollTop,
		};
	}

	const duration = calculateSmoothDuration(distance);
	const startTime = performance.now();
	let cancelled = false;
	let animId = 0;
	let expectedScrollTop = element.scrollTop;

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
	element.addEventListener("touchmove", cancel, {
		capture: true,
		passive: true,
	});
	element.addEventListener("touchstart", cancel, {
		capture: true,
		passive: true,
	});
	element.addEventListener("pointerdown", cancel, {
		capture: true,
		passive: true,
	});
	element.addEventListener("mousedown", cancel, {
		capture: true,
		passive: true,
	});
	window.addEventListener("wheel", cancel, { capture: true, passive: true });
	window.addEventListener("touchmove", cancel, {
		capture: true,
		passive: true,
	});
	window.addEventListener("touchstart", cancel, {
		capture: true,
		passive: true,
	});
	window.addEventListener("pointerdown", cancel, {
		capture: true,
		passive: true,
	});
	window.addEventListener("mousedown", cancel, {
		capture: true,
		passive: true,
	});

	const step = (now: number) => {
		if (cancelled) return;
		const elapsed = now - startTime;
		const progress = Math.min(1, elapsed / duration);
		const ease = easeInOutCubic(progress);

		// Dynamically refine target if it shifted as virtual items mount
		const latestTarget = getTarget();
		if (Math.abs(latestTarget - currentTarget) > 1) {
			currentTarget = latestTarget;
			distance = currentTarget - start;
		}

		expectedScrollTop = Math.round(start + distance * ease);
		element.scrollTop = expectedScrollTop;

		if (progress < 1) {
			animId = requestAnimationFrame(step);
		} else {
			cleanup();
			element.scrollTop = currentTarget;
			onFinish?.();
		}
	};

	animId = requestAnimationFrame(step);
	return {
		cancel,
		getExpectedScrollTop: () => expectedScrollTop,
	};
};
