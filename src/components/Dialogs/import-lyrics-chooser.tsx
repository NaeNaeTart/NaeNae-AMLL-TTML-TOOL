import { DismissRegular } from "@fluentui/react-icons";
import { Box, Button, Dialog, Flex } from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
	ImportSourceCards,
	type ImportSourceId,
} from "$/modules/lyrics-import/components/ImportSourceCards";
import {
	geniusImportLyricsDialogAtom,
	importFromLRCLIBDialogAtom,
	importFromTextDialogAtom,
	importLyricsChooserDialogAtom,
	lyricallyImportLyricsDialogAtom,
} from "$/states/dialogs.ts";

export function ImportLyricsChooserDialog() {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(importLyricsChooserDialogAtom);
	const setImportFromText = useSetAtom(importFromTextDialogAtom);
	const setImportFromLRCLIB = useSetAtom(importFromLRCLIBDialogAtom);
	const setImportFromLyrically = useSetAtom(lyricallyImportLyricsDialogAtom);
	const setImportFromGenius = useSetAtom(geniusImportLyricsDialogAtom);

	const openChoice = (source: ImportSourceId) => {
		setIsOpen(false);
		if (source === "plainText") setImportFromText(true);
		if (source === "lrclib") setImportFromLRCLIB(true);
		if (source === "lyrically") setImportFromLyrically(true);
		if (source === "genius") setImportFromGenius(true);
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

				<ImportSourceCards onSelect={openChoice} />
			</Dialog.Content>
		</Dialog.Root>
	);
}
