/** Run with Vite already serving: node scripts/verify-pcm-playback.mjs http://127.0.0.1:5185
 * Requires ffmpeg in PATH and Edge/Chromium (PCM_TEST_BROWSER overrides its path).
 * Uses Chromium's real decodeAudioData and AudioWorklet, with a muted gain.
 * This verifies digital frame positions, not physical speakers or perceptual quality.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.argv[2] ?? "http://127.0.0.1:5185";
const folder = await mkdtemp(join(root, ".pcm-check-"));
const profile = await mkdtemp(join(tmpdir(), "pcm-browser-"));
if (dirname(folder) !== root || dirname(profile) !== resolve(tmpdir()))
	throw new Error("Refusing cleanup outside the designated temporary roots");
const fixtureUrl = `${base}/${folder.slice(root.length + 1).replaceAll("\\", "/")}`;
let browser;
let socket;
try {
	const formats = [
		["cbr.mp3", "-c:a", "libmp3lame", "-b:a", "192k"],
		["vbr.mp3", "-c:a", "libmp3lame", "-q:a", "2"],
		["no-xing.mp3", "-c:a", "libmp3lame", "-q:a", "2", "-write_xing", "0"],
		["baseline.flac", "-c:a", "flac"],
	];
	for (const [name, ...encoder] of formats) {
		const result = spawnSync(
			"ffmpeg",
			[
				"-v",
				"error",
				"-f",
				"lavfi",
				"-i",
				"sine=frequency=440:sample_rate=44100:duration=151",
				...encoder,
				join(folder, name),
			],
			{ windowsHide: true, encoding: "utf8" },
		);
		if (result.error || result.status !== 0)
			throw result.error ?? new Error(result.stderr);
	}
	await writeFile(
		join(folder, "check.html"),
		"<!doctype html><title>PCM verification</title>",
	);
	const executable =
		process.env.PCM_TEST_BROWSER ??
		join(
			process.env["ProgramFiles(x86)"] ?? "/usr/bin",
			"Microsoft/Edge/Application/msedge.exe",
		);
	const debugPort = 9335;
	browser = spawn(
		executable,
		[
			"--headless",
			"--disable-gpu",
			"--no-first-run",
			"--autoplay-policy=no-user-gesture-required",
			`--remote-debugging-port=${debugPort}`,
			`--user-data-dir=${profile}`,
			"about:blank",
		],
		{ windowsHide: true, stdio: "ignore" },
	);
	let launchError;
	browser.on("error", (error) => {
		launchError = error;
	});
	let target;
	for (let attempt = 0; attempt < 100 && !target; attempt++) {
		if (launchError) throw launchError;
		try {
			const pages = await (
				await fetch(`http://127.0.0.1:${debugPort}/json/list`)
			).json();
			target = pages.find((page) => page.type === "page");
		} catch {
			/* Browser is still starting. */
		}
		if (!target) await new Promise((resolve) => setTimeout(resolve, 100));
	}
	if (!target) throw new Error("Browser debugger did not start");
	socket = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((resolve, reject) => {
		socket.onopen = resolve;
		socket.onerror = reject;
	});
	let id = 0;
	const pending = new Map();
	socket.onmessage = (event) => {
		const response = JSON.parse(event.data);
		if (
			response.method === "Runtime.exceptionThrown" ||
			response.method === "Log.entryAdded"
		) {
			console.error(JSON.stringify(response.params));
		}
		const request = pending.get(response.id);
		if (!request) return;
		pending.delete(response.id);
		clearTimeout(request.timer);
		if (response.error)
			request.reject(new Error(JSON.stringify(response.error)));
		else request.resolve(response.result);
	};
	const call = (method, params = {}) =>
		new Promise((resolve, reject) => {
			const requestId = ++id;
			const timer = setTimeout(() => {
				pending.delete(requestId);
				reject(new Error(`${method} timed out`));
			}, 60000);
			pending.set(requestId, { resolve, reject, timer });
			socket.send(JSON.stringify({ id: requestId, method, params }));
		});
	await call("Runtime.enable");
	await call("Log.enable");
	await call("Page.navigate", { url: `${fixtureUrl}/check.html` });
	await new Promise((resolve) => setTimeout(resolve, 500));
	const result = await call("Runtime.evaluate", {
		awaitPromise: true,
		returnByValue: true,
		expression: `(${async function verify(base, fixtures) {
			const { audioEngine: engine } = await import(
				`${new URL(base).origin}/src/modules/audio/audio-engine.ts`
			);
			engine.volume = 0;
			const rows = [];
			for (const name of fixtures) {
				const blob = await (await fetch(`${base}/${name}`)).blob();
				await engine.ctx.suspend();
				try {
					await engine.loadMusic(blob);
				} catch (error) {
					throw new Error(
						`${error.message}; state=${engine.ctx.state}, contextTime=${engine.ctx.currentTime}`,
					);
				}
				for (const seconds of [20, 90, 150]) {
					const requested = Math.round(seconds * engine.musicBuffer.sampleRate);
					engine.seekMusic(seconds);
					if (
						Math.round(
							engine.musicCurrentTime * engine.musicBuffer.sampleRate,
						) !== requested
					)
						throw new Error(`${name}: paused seek mismatch`);
					const report = new Promise((resolve) => {
						const listen = (event) => {
							if (event.data.type !== "render" || event.data.voice !== "music")
								return;
							engine.node.port.removeEventListener("message", listen);
							resolve(event.data.report);
						};
						engine.node.port.addEventListener("message", listen);
					});
					await engine.resumeOrSeekMusic(seconds);
					const rendered = await report;
					if (rendered.startFrame !== requested)
						throw new Error(`${name}: rendered frame mismatch`);
					engine.pauseMusic();
					const paused = engine.musicCurrentTime;
					await new Promise((resolve) => setTimeout(resolve, 30));
					if (engine.musicCurrentTime !== paused)
						throw new Error(`${name}: paused clock moved`);
					rows.push({
						format: name,
						seconds,
						requested,
						rendered: rendered.startFrame,
						errorFrames: rendered.startFrame - requested,
					});
				}
			}
			engine.musicPlayBackRate = 0.5;
			engine.preservesPitch = true;
			const ended = new Promise((resolve) => {
				const listen = (event) => {
					if (
						event.data.type !== "render" ||
						event.data.voice !== "audition" ||
						!event.data.report.ended
					)
						return;
					engine.node.port.removeEventListener("message", listen);
					resolve(event.data.report);
				};
				engine.node.port.addEventListener("message", listen);
			});
			await engine.auditionRange(0.2, 0.35);
			const audition = await ended;
			if (
				audition.endFrame !== Math.round(0.35 * engine.musicBuffer.sampleRate)
			)
				throw new Error("Stretched audition endpoint mismatch");
			engine.unloadMusic();
			return { seeks: rows, stretchedAuditionEndFrame: audition.endFrame };
		}})(${JSON.stringify(fixtureUrl)}, ${JSON.stringify(formats.map(([name]) => name))})`,
	});
	if (result.exceptionDetails)
		throw new Error(JSON.stringify(result.exceptionDetails));
	console.log(JSON.stringify(result.result.value, null, 2));
} finally {
	socket?.close();
	if (browser && browser.exitCode === null) {
		browser.kill();
		await new Promise((resolve) => {
			browser.once("exit", resolve);
			setTimeout(resolve, 2000);
		});
	}
	// Only remove this run's mkdtemp child of the verified repository root.
	await rm(folder, {
		recursive: true,
		force: true,
		maxRetries: 20,
		retryDelay: 100,
	});
	await rm(profile, {
		recursive: true,
		force: true,
		maxRetries: 20,
		retryDelay: 100,
	});
}
