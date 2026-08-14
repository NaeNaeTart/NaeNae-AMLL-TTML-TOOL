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

import { Card, Inset } from "@radix-ui/themes";
import { AnimatePresence } from "framer-motion";
import { useAtomValue } from "jotai";
import { forwardRef, memo } from "react";
import { lazy } from "$/utils/lazy.ts";
import SuspensePlaceHolder from "$/components/SuspensePlaceHolder";
import { ToolMode, toolModeAtom } from "$/states/main.ts";

const EditModeRibbonBar = lazy(() => import("./edit-mode"));
const SyncModeRibbonBar = lazy(() => import("./sync-mode"));
const PreviewModeRibbonBar = lazy(() => import("./preview-mode"));

export const RibbonBar = memo(
	forwardRef<HTMLDivElement>(({ isSidebar, position = "top" }: { isSidebar?: boolean, position?: "top" | "bottom" | "left" | "right" }, ref) => {
		const toolMode = useAtomValue(toolModeAtom);

		return (
			<Card
				data-guide-target="ribbon"
				style={{
					minHeight: isSidebar ? "100%" : "fit-content",
					minWidth: isSidebar ? "240px" : undefined,
					maxWidth: isSidebar ? "240px" : undefined,
					flexShrink: "0",
					borderRadius: 0,
					borderLeft: position === "right" ? "1px solid var(--gray-5)" : "none",
					borderRight: position === "left" ? "1px solid var(--gray-5)" : "none",
					borderTop: position === "bottom" ? "1px solid var(--gray-5)" : "none",
					borderBottom: position === "top" ? "1px solid var(--gray-5)" : "none",
					backgroundColor: "var(--titlebar-bg, var(--color-panel-translucent))",
					backdropFilter: "blur(var(--custom-backdrop-blur, 16px)) saturate(160%)",
					zIndex: 10,
				}}
				ref={ref}
			>
				<Inset>
					<div
						style={{
							height: "100%",
							overflowY: isSidebar ? "auto" : "clip",
							overflowX: "clip",
						}}
					>
						<AnimatePresence mode="wait">
							{toolMode === ToolMode.Edit && (
								<SuspensePlaceHolder key="edit">
									<EditModeRibbonBar isSidebar={isSidebar} />
								</SuspensePlaceHolder>
							)}
							{toolMode === ToolMode.Sync && (
								<SuspensePlaceHolder key="sync">
									<SyncModeRibbonBar isSidebar={isSidebar} />
								</SuspensePlaceHolder>
							)}
							{toolMode === ToolMode.Preview && (
								<SuspensePlaceHolder key="preview">
									<PreviewModeRibbonBar isSidebar={isSidebar} />
								</SuspensePlaceHolder>
							)}
						</AnimatePresence>
					</div>
				</Inset>
			</Card>
		);
	}),
);

export default RibbonBar;
