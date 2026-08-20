/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/blob/main/LICENSE
 */

/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module "virtual:i18next-loader" {
	const value: Record<
		string,
		{ translation: typeof import("../i18n/locales/zh-CN/translation.json") }
	>;
	export default value;
}

declare module "virtual:buildmeta" {
	export const BUILD_TIME: string;
	export const GIT_COMMIT: string;
	export const GIT_REPO_URL: string;
}

interface ImportMetaEnv {
	readonly TAURI_ENV_DEBUG?: string;
	readonly TAURI_ENV_TARGET_TRIPLE?: string;
	readonly TAURI_ENV_ARCH?: string;
	readonly TAURI_ENV_PLATFORM?: string;
	readonly TAURI_ENV_FAMILY?: string;
	// 更多环境变量...
}

// biome-ignore lint/correctness/noUnusedVariables: 环境声明文件
interface ImportMeta {
	readonly env: ImportMetaEnv;
}
