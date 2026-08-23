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

import { Flex, Grid, Separator } from "@radix-ui/themes";
import { motion } from "framer-motion";
import { type FC, forwardRef, type PropsWithChildren, type ReactNode, useImperativeHandle, useRef, useEffect } from "react";

export const RibbonSection: FC<PropsWithChildren<{ label: ReactNode; isSidebar?: boolean }>> = ({
	children,
	label,
	isSidebar,
}) => (
	<>
		<Flex
			direction="column"
			gap="1"
			flexShrink="0"
			style={{
				alignSelf: "stretch",
				width: isSidebar ? "100%" : "unset",
			}}
		>
			<Flex flexGrow="1" align="center" justify={isSidebar ? "start" : "center"} direction={isSidebar ? "column" : "row"} gap="2" p={isSidebar ? "2" : "0"}>
				{children}
			</Flex>
			{!isSidebar && (
				<Flex align="center" justify="center" px="2" style={{ color: "var(--ribbon-label-color)", fontSize: "var(--font-size-1)", whiteSpace: "nowrap" }}>
					{label}
				</Flex>
			)}
			{isSidebar && label && (
				<Flex px="3" py="1" style={{ backgroundColor: "var(--accent-3)", color: "var(--ribbon-label-color)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }}>
					{label}
				</Flex>
			)}
		</Flex>
		<Separator
			orientation={isSidebar ? "horizontal" : "vertical"}
			size="4"
			style={{ 
				height: isSidebar ? "1px" : "unset", 
				width: isSidebar ? "100%" : "1px",
				alignSelf: "stretch" 
			}}
		/>
	</>
);

const RibbonHeightReserve: FC<{ rows: number }> = ({ rows }) => (
	<Flex
		aria-hidden="true"
		direction="column"
		gap="1"
		flexShrink="0"
		style={{
			width: 0,
			minWidth: 0,
			overflow: "hidden",
			visibility: "hidden",
			pointerEvents: "none",
			marginInlineEnd: "calc(-1 * var(--space-3))",
		}}
	>
		<Grid rows={`repeat(${rows}, var(--space-5))`} gapY="1" />
		<Flex
			align="center"
			justify="center"
			px="2"
			style={{ fontSize: "var(--font-size-1)", whiteSpace: "nowrap" }}
		>
			Reserve
		</Flex>
	</Flex>
);

export const RibbonFrame = forwardRef<
	HTMLDivElement,
	PropsWithChildren<{ isSidebar?: boolean; reserveControlRows?: number }>
>(
	({ children, isSidebar, reserveControlRows }, ref) => {
		const frameRef = useRef<HTMLDivElement>(null);
		useImperativeHandle(ref, () => frameRef.current as HTMLDivElement, []);

		useEffect(() => {
			const frame = frameRef.current;
			if (!frame || isSidebar) return;

			let scrollTarget = frame.scrollLeft;
			let isAnimating = false;

			const handleWheel = (e: WheelEvent) => {
				if (e.deltaY !== 0) {
					const isScrollable = frame.scrollWidth > frame.clientWidth;
					if (isScrollable) {
						e.preventDefault();
						scrollTarget += e.deltaY;
						scrollTarget = Math.max(
							0,
							Math.min(scrollTarget, frame.scrollWidth - frame.clientWidth),
						);

						if (!isAnimating) {
							isAnimating = true;
							const animate = () => {
								const diff = scrollTarget - frame.scrollLeft;
								if (Math.abs(diff) > 0.5) {
									frame.scrollLeft += diff * 0.15;
									requestAnimationFrame(animate);
								} else {
									frame.scrollLeft = scrollTarget;
									isAnimating = false;
								}
							};
							requestAnimationFrame(animate);
						}
					}
				}
			};

			const handleScroll = () => {
				if (!isAnimating) {
					scrollTarget = frame.scrollLeft;
				}
			};

			frame.addEventListener("wheel", handleWheel, { passive: false });
			frame.addEventListener("scroll", handleScroll);
			return () => {
				frame.removeEventListener("wheel", handleWheel);
				frame.removeEventListener("scroll", handleScroll);
			};
		}, [isSidebar]);

		return (
			<Flex
				p={isSidebar ? "0" : "3"}
				direction={isSidebar ? "column" : "row"}
				gap={isSidebar ? "0" : "3"}
				align={isSidebar ? "stretch" : "center"}
				style={{
					overflowX: isSidebar ? "hidden" : "auto",
					overflowY: isSidebar ? "auto" : "clip",
					height: "100%",
					width: isSidebar ? undefined : "100%",
					scrollbarWidth: "thin",
					scrollbarColor: "var(--gray-a8) transparent",
				}}
				className="ribbon-scrollbar"
				asChild
			><motion.div
					initial={isSidebar ? { y: 10, opacity: 0 } : { x: 10, opacity: 0 }}
					animate={isSidebar ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
					exit={isSidebar ? { y: -10, opacity: 0 } : { x: -10, opacity: 0 }}
					layout
					ref={frameRef}
				>
					{!isSidebar && reserveControlRows && (
						<RibbonHeightReserve rows={reserveControlRows} />
					)}
					{children}
				</motion.div></Flex>
		);
	},
);
