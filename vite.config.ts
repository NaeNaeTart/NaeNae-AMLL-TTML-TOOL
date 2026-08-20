import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import jotaiDebugLabel from "jotai/babel/plugin-debug-label";
import jotaiReactRefresh from "jotai/babel/plugin-react-refresh";
import ConditionalCompile from "unplugin-preprocessor-directives/vite";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import i18nextLoader from "vite-plugin-i18next-loader";
import { VitePWA } from "vite-plugin-pwa";
import wasm from "vite-plugin-wasm";
import svgLoader from "vite-svg-loader";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AMLL_LOCAL_PATH = resolve(__dirname, "./applemusic-like-lyrics-main/applemusic-like-lyrics-main");
const AMLL_LOCAL_EXISTS = existsSync(AMLL_LOCAL_PATH);

process.env.AMLL_LOCAL_EXISTS = AMLL_LOCAL_EXISTS ? "true" : "false";

const localePaths: string[] = [resolve(__dirname, "./src/i18n/locales")]; 

const plugins: Plugin[] = [
	ConditionalCompile(),
	react({
		babel: {
			presets: ["jotai/babel/preset"],
			plugins: [
				jotaiDebugLabel,
				jotaiReactRefresh,
			],
		},
	}),
	svgLoader(),
	wasm(),
	i18nextLoader({
		paths: localePaths,
		namespaceResolution: "basename",
	}),
	{
		name: "buildmeta",
		async resolveId(id) {
			if (id === "virtual:buildmeta") {
				return id;
			}
		},
		async load(id) {
			if (id === "virtual:buildmeta") {
				let gitCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim();

				if (!gitCommit) {
					try {
						gitCommit = await new Promise<string>((resolve, reject) =>
							exec("git rev-parse HEAD", (err, stdout) => {
								if (err) {
									reject(err);
								} else {
									resolve(stdout.trim());
								}
							}),
						);
					} catch {}
				}

				// Default to upstream repository URL
				let gitRepo = "https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL";
				try {
					const originUrl = await new Promise<string>((resolve, reject) =>
						exec("git config --get remote.origin.url", (err, stdout) => {
							if (err) reject(err);
							else resolve(stdout.trim());
						}),
					);
					if (originUrl) {
						let normalized = originUrl.replace(/\.git$/, "");
						if (normalized.startsWith("git@github.com:")) {
							normalized = normalized.replace("git@github.com:", "https://github.com/");
						}
						if (normalized.startsWith("https://github.com/")) {
							gitRepo = normalized;
						}
					}
				} catch {}

				return `
					export const BUILD_TIME = ${JSON.stringify(new Date().toISOString())};
					export const GIT_COMMIT = ${JSON.stringify(gitCommit ?? "unknown")};
					export const GIT_REPO_URL = ${JSON.stringify(gitRepo)};
				`;
			}
		},
	},
	VitePWA({
		injectRegister: null,
		disable: !!process.env.TAURI_PLATFORM,
		workbox: {
			globPatterns: ["**/*.{js,css,html,wasm}"],
			maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
			navigateFallbackDenylist: [/^\/migration(?:\/|$)/],
		},
		manifest: {
			name: "Apple Music-like lyrics TTML Tool",
			id: "amll-ttml-tool",
			short_name: "AMLL TTML Tool",
			description: "一个用于 Apple Music 的逐词歌词 TTML 编辑和时间轴工具",
			theme_color: "#18a058",
			icons: [
				{
					src: "./icons/Square30x30Logo.png",
					sizes: "30x30",
					type: "image/png",
				},
				{
					src: "./logo.png",
					sizes: "1024x1024",
					type: "image/png",
				},
			],
		},
	}),
];

export default defineConfig({
	test: {
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/cypress/**",
			"**/.{idea,git,cache,output,temp}/**",
			"**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
			"scripts/**",
		],
	},
	plugins: [
		{
			name: "shim-module",
			transform(code, id) {
				if (id.includes("node_modules/hangul-romanize") || id.includes("node_modules/pinyin-pro") || id.includes("node_modules/wanakana")) {
					return {
						code: `var module = { exports: {} };\n${code}`,
						map: null,
					};
				}
			},
		},
		...plugins,
	],
	base: process.env.TAURI_ENV_PLATFORM ? "/" : "./",
	clearScreen: false,
	optimizeDeps: {
		include: ["jotai"],
		exclude: [
			"url",
			"@ffmpeg/ffmpeg", 
			"@ffmpeg/util", 
			"hangul-romanize"
		],
	},
	server: {
		watch: {
			ignored: [
				"**/src-tauri/target/**",
				"**/*.ttml",
				"**/*.mp3",
				"**/*.flac",
				"**/*.wav",
				"**/*.m4a",
				"**/*.aac",
				"**/*.ogg",
				"**/*.opus",
				"**/*.lrc",
				"**/project.json",
			],
		},
		headers: {
			"Cross-Origin-Embedder-Policy": "require-corp",
			"Cross-Origin-Opener-Policy": "same-origin",
		},
		strictPort: true,
	},
	envPrefix: ["VITE_", "TAURI_", "AMLL_", "SENTRY_"],
	build: {
		target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari15",
		minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
		sourcemap: true,
	},
	resolve: {
		mainFields: ["module", "jsnext:main", "jsnext", "main"],
		alias: {
			$: resolve(__dirname, "src"),
			url: resolve(__dirname, "src/utils/url-shim.ts"),
			...(AMLL_LOCAL_EXISTS
				? {
						"@applemusic-like-lyrics/core": resolve(
							AMLL_LOCAL_PATH,
							"packages/core/src",
						),
						"@applemusic-like-lyrics/react": resolve(
							AMLL_LOCAL_PATH,
							"packages/react/src",
						),
						"@applemusic-like-lyrics/lyric": resolve(
							AMLL_LOCAL_PATH,
							"packages/lyric/src",
						),
						"@applemusic-like-lyrics/ttml": resolve(
							AMLL_LOCAL_PATH,
							"packages/ttml/src",
						),
					}
				: {}),
		},
		dedupe: ["react", "react-dom"],
	},
	worker: {
		format: "es",
	},
	define: {
		global: "globalThis",
	},
});
