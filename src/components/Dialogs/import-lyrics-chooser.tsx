import {
	DismissRegular,
	DocumentText24Regular,
	GlobeSearch24Regular,
	MusicNote1Regular,
	Search24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	Grid,
	Heading,
	Text,
} from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
	geniusImportLyricsDialogAtom,
	importFromLRCLIBDialogAtom,
	importFromTextDialogAtom,
	importLyricsChooserDialogAtom,
	lyricallyImportLyricsDialogAtom,
} from "$/states/dialogs.ts";
import styles from "./import-lyrics-chooser.module.css";

type ImportChoice = {
	id: "plainText" | "lrclib" | "lyrically" | "genius";
	icon: ReactNode;
	color: string;
	background: string;
	open: () => void;
};

export function ImportLyricsChooserDialog() {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(importLyricsChooserDialogAtom);
	const setImportFromText = useSetAtom(importFromTextDialogAtom);
	const setImportFromLRCLIB = useSetAtom(importFromLRCLIBDialogAtom);
	const setImportFromLyrically = useSetAtom(lyricallyImportLyricsDialogAtom);
	const setImportFromGenius = useSetAtom(geniusImportLyricsDialogAtom);

	const choices: ImportChoice[] = [
		{
			id: "plainText",
			icon: <DocumentText24Regular />,
			color: "var(--blue-11)",
			background: "var(--blue-3)",
			open: () => setImportFromText(true),
		},
		{
			id: "lrclib",
			icon: <Search24Regular />,
			color: "var(--green-11)",
			background: "var(--green-3)",
			open: () => setImportFromLRCLIB(true),
		},
		{
			id: "lyrically",
			icon: <GlobeSearch24Regular />,
			color: "var(--purple-11)",
			background: "var(--purple-3)",
			open: () => setImportFromLyrically(true),
		},
		{
			id: "genius",
			icon: <MusicNote1Regular />,
			color: "var(--orange-11)",
			background: "var(--orange-3)",
			open: () => setImportFromGenius(true),
		},
	];

	const openChoice = (choice: ImportChoice) => {
		setIsOpen(false);
		choice.open();
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 680 }}>
				<Flex justify="between" align="start" gap="3" mb="4">
					<Box>
						<Dialog.Title mb="1">
							{t("importChooser.title", "Import lyrics")}
						</Dialog.Title>
						<Dialog.Description>
							{t(
								"importChooser.description",
								"Choose where you want to import your lyrics from.",
							)}
						</Dialog.Description>
					</Box>
					<Dialog.Close>
						<Button variant="ghost" color="gray">
							<DismissRegular />
						</Button>
					</Dialog.Close>
				</Flex>

				<Grid columns={{ initial: "1", sm: "2" }} gap="3">
					{choices.map((choice) => (
						<Card
							key={choice.id}
							asChild
							variant="classic"
							style={{ padding: "var(--space-4)" }}
						>
							<button
								type="button"
								className={styles.optionCard}
								onClick={() => openChoice(choice)}
								style={
									{
										"--import-choice-color": choice.color,
										"--import-choice-background": choice.background,
									} as CSSProperties
								}
							>
								<Flex direction="column" gap="3" height="100%">
									<Flex align="center" gap="3">
										<span className={styles.icon}>{choice.icon}</span>
										<Heading size="3">
											{t(`importChooser.options.${choice.id}.title`)}
										</Heading>
									</Flex>
									<Text size="2" color="gray">
										{t(`importChooser.options.${choice.id}.description`)}
									</Text>
								</Flex>
							</button>
						</Card>
					))}
				</Grid>
			</Dialog.Content>
		</Dialog.Root>
	);
}
