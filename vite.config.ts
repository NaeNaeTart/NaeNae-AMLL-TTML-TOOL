import { exec } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import jotaiDebugLabel from "jotai/babel/plugin-debug-label";
import jotaiReactRefresh from "jotai/babel/plugin-react-refresh";
import ConditionalCompile from "unplugin-preprocessor-directives/vite";
import { defineConfig, type Plugin } from "vite";
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

				return `
					export const BUILD_TIME = ${JSON.stringify(new Date().toISOString())};
					export const GIT_COMMIT = ${JSON.stringify(gitCommit ?? "unknown")};
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
			ignored: ["**/src-tauri/target/**"],
		},
		headers: {
			"Cross-Origin-Embedder-Policy": "require-corp",
			"Cross-Origin-Opener-Policy": "same-origin",
		},
		strictPort: true,
		proxy: {
			"/api/spotify-embed": {
				target: "https://open.spotify.com",
				changeOrigin: true,
				secure: true,
				rewrite: (path) => path.replace(/^\/api\/spotify-embed/, "/embed"),
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				},
			},
			"/api/spotify-pathfinder": {
				target: "https://api-partner.spotify.com",
				changeOrigin: true,
				secure: true,
				rewrite: (path) => path.replace(/^\/api\/spotify-pathfinder/, "/pathfinder"),
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					Referer: "https://open.spotify.com/",
					Origin: "https://open.spotify.com",
					"App-Platform": "WebPlayer",
				},
			},
			"/api/spotify-api": {
				target: "https://api.spotify.com",
				changeOrigin: true,
				secure: true,
				rewrite: (path) => path.replace(/^\/api\/spotify-api/, ""),
			},
			"/api/lrclib": {
				target: "https://lrclib.net",
				changeOrigin: true,
				secure: true,
				rewrite: (path) => path.replace(/^\/api\/lrclib/, "/api"),
			},
			"/api/unison": {
				target: "https://unison.boidu.dev",
				changeOrigin: true,
				secure: true,
				rewrite: (path) => path.replace(/^\/api\/unison/, ""),
			},
		},
	},
	envPrefix: ["VITE_", "TAURI_", "AMLL_", "SENTRY_"],
	build: {
		target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari15",
		minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
		sourcemap: true,
		rollupOptions: {
			output: {
				manualChunks: {
					"vendor-react": ["react", "react-dom", "jotai", "jotai-immer", "jotai-optics", "jotai-history"],
					"vendor-ui": ["@radix-ui/themes", "radix-ui", "framer-motion"],
					"vendor-icons": ["@fluentui/react-icons"],
					"vendor-wavesurfer": ["wavesurfer.js"],
					"vendor-i18n": ["i18next", "react-i18next", "i18next-icu"],
				},
			},
		},
	},
	resolve: {
		alias: Object.assign(
			{
				$: resolve(__dirname, "src"),
				url: resolve(__dirname, "src/utils/url-shim.ts"),
			},
			AMLL_LOCAL_EXISTS
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
				: {},
		),
		dedupe: ["react", "react-dom"],
	},
	worker: {
		format: "es",
	},
	define: {
		global: "globalThis",
	},
});
