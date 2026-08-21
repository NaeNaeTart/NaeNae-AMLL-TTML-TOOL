import {
	DocumentText24Regular,
	GlobeSearch24Regular,
	MusicNote1Regular,
	Search24Regular,
} from "@fluentui/react-icons";
import { Card, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import styles from "./ImportSourceCards.module.css";

export type ImportSourceId = "plainText" | "lrclib" | "lyrically" | "genius";

type ImportSource = {
	id: ImportSourceId;
	icon: ReactNode;
	color: string;
	background: string;
};

const IMPORT_SOURCES: Record<ImportSourceId, ImportSource> = {
	plainText: {
		id: "plainText",
		icon: <DocumentText24Regular />,
		color: "var(--blue-11)",
		background: "var(--blue-3)",
	},
	lrclib: {
		id: "lrclib",
		icon: <Search24Regular />,
		color: "var(--green-11)",
		background: "var(--green-3)",
	},
	lyrically: {
		id: "lyrically",
		icon: <GlobeSearch24Regular />,
		color: "var(--purple-11)",
		background: "var(--purple-3)",
	},
	genius: {
		id: "genius",
		icon: <MusicNote1Regular />,
		color: "var(--orange-11)",
		background: "var(--orange-3)",
	},
};

const CHOOSER_SOURCE_ORDER: ImportSourceId[] = [
	"plainText",
	"lrclib",
	"lyrically",
	"genius",
];
const GUIDE_SOURCE_ORDER: ImportSourceId[] = [
	"genius",
	"lrclib",
	"plainText",
	"lyrically",
];

export function ImportSourceCards({
	compact = false,
	onSelect,
}: {
	compact?: boolean;
	onSelect: (source: ImportSourceId) => void;
}) {
	const { t } = useTranslation();
	const labels: Record<ImportSourceId, { title: string; description: string }> =
		{
			plainText: {
				title: t("importChooser.options.plainText.title"),
				description: t("importChooser.options.plainText.description"),
			},
			lrclib: {
				title: t("importChooser.options.lrclib.title"),
				description: t("importChooser.options.lrclib.description"),
			},
			lyrically: {
				title: t("importChooser.options.lyrically.title"),
				description: t("importChooser.options.lyrically.description"),
			},
			genius: {
				title: t("importChooser.options.genius.title"),
				description: t("importChooser.options.genius.description"),
			},
		};
	const sourceOrder = compact ? GUIDE_SOURCE_ORDER : CHOOSER_SOURCE_ORDER;

	return (
		<Grid
			columns={compact ? "2" : { initial: "1", sm: "2" }}
			gap={compact ? "2" : "3"}
		>
			{sourceOrder.map((sourceId) => {
				const source = IMPORT_SOURCES[sourceId];
				return (
					<Card
						key={source.id}
						asChild
						variant={compact ? "surface" : "classic"}
						style={{ padding: compact ? "var(--space-2)" : "var(--space-4)" }}
					>
						<button
							type="button"
							className={`${styles.optionCard} ${compact ? styles.compact : ""}`}
							onClick={() => onSelect(source.id)}
							style={
								{
									"--import-choice-color": source.color,
									"--import-choice-background": source.background,
								} as CSSProperties
							}
						>
							<Flex
								direction={compact ? "row" : "column"}
								align={compact ? "center" : undefined}
								gap={compact ? "2" : "3"}
								height="100%"
							>
								<Flex align="center" gap={compact ? "2" : "3"} minWidth="0">
									<span className={styles.icon}>{source.icon}</span>
									<Heading size={compact ? "2" : "3"} truncate={compact}>
										{labels[source.id].title}
									</Heading>
								</Flex>
								{!compact && (
									<Text size="2" color="gray">
										{labels[source.id].description}
									</Text>
								)}
							</Flex>
						</button>
					</Card>
				);
			})}
		</Grid>
	);
}
