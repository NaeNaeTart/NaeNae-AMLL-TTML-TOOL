import {
	Button,
	Checkbox,
	Dialog,
	Flex,
	Text,
	Separator,
	Callout,
	Box,
} from "@radix-ui/themes";
import { Info24Regular, Warning24Regular } from "@fluentui/react-icons";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
	experimentalFeaturesDialogOpenAtom,
	geniusCategorizationEnabledAtom,
	geniusHeaderDetectionDialogShownAtom,
	geniusHeaderDetectionDialogOpenAtom,
} from "$/modules/settings/states/index.ts";

export const GeniusHeaderDetectionDialog = () => {
	const { t } = useTranslation();
	const [, setGeniusCategorizationEnabled] = useAtom(geniusCategorizationEnabledAtom);
	const [, setDialogShown] = useAtom(geniusHeaderDetectionDialogShownAtom);
	const [isOpen, setIsOpen] = useAtom(geniusHeaderDetectionDialogOpenAtom);

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 500 }}>
				<Dialog.Title>{t("experimentalFeatures.geniusCategorization.dialogTitle", "Genius Headers Detected!")}</Dialog.Title>
				<Dialog.Description mb="4">
					{t("experimentalFeatures.geniusCategorization.dialogDesc", "We've detected section headers in your lyrics. Would you like to enable the experimental 'Genius Header Categorization' feature to help with your workflow?")}
				</Dialog.Description>

				<Flex direction="column" gap="3">
					<Box p="3" style={{ backgroundColor: "var(--gray-2)", borderRadius: "var(--radius-2)" }}>
						<Flex gap="2" align="start">
							<Info24Regular style={{ color: "var(--accent-9)", marginTop: "2px" }} />
							<Text size="1">
								{t("experimentalFeatures.geniusCategorization.usageInfo", "Once enabled, section headers will be styled differently in the editor. You can click on them to access specialized tools like 'Copy Previous Timing' and 'Snap to Playhead'.")}
							</Text>
						</Flex>
					</Box>

					<Flex justify="end" gap="2">
						<Button variant="soft" color="gray" onClick={() => {
							setIsOpen(false);
							setDialogShown(true);
						}}>
							{t("experimentalFeatures.geniusCategorization.maybeLater", "Maybe Later")}
						</Button>
						<Button onClick={() => {
							setGeniusCategorizationEnabled(true);
							setDialogShown(true);
							setIsOpen(false);
						}}>
							{t("experimentalFeatures.geniusCategorization.enableNow", "Enable Now")}
						</Button>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};

export const ExperimentalFeaturesDialog = () => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(experimentalFeaturesDialogOpenAtom);
	const [geniusCategorizationEnabled, setGeniusCategorizationEnabled] = useAtom(
		geniusCategorizationEnabledAtom,
	);

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 500 }}>
				<Dialog.Title>{t("experimentalFeatures.title", "Experimental Features")}</Dialog.Title>
				<Dialog.Description mb="4">
					{t("experimentalFeatures.description", "These features are currently in development and may be unstable. Use with caution.")}
				</Dialog.Description>

				<Callout.Root color="amber" variant="soft" mb="4">
					<Callout.Icon>
						<Warning24Regular />
					</Callout.Icon>
					<Callout.Text>
						{t("experimentalFeatures.description", "These features are currently in development and may be unstable. Use with caution.")}
					</Callout.Text>
				</Callout.Root>

				<Flex direction="column" gap="4">
					<Flex direction="column" gap="2">
						<Flex align="center" gap="2" justify="between">
							<Flex direction="column">
								<Text weight="bold" size="3">
									{t("experimentalFeatures.geniusCategorization.title", "Genius Header Categorization")}
								</Text>
								<Text size="1" color="gray">
									{t("experimentalFeatures.geniusCategorization.description", "Detect, normalize, review, navigate, collapse, validate, and edit Genius-style song sections while preserving them in TTML exports.")}
								</Text>
							</Flex>
							<Checkbox
								checked={geniusCategorizationEnabled}
								onCheckedChange={(checked) => setGeniusCategorizationEnabled(!!checked)}
							/>
						</Flex>
						
						<Box p="3" style={{ backgroundColor: "var(--gray-2)", borderRadius: "var(--radius-2)" }}>
							<Flex gap="2" align="start">
								<Info24Regular style={{ color: "var(--accent-9)", marginTop: "2px" }} />
								<Text size="1">
									{t("experimentalFeatures.geniusCategorization.usageInfo", "Once enabled, section headers will be styled differently in the editor. You can click on them to access specialized tools like 'Copy Previous Timing' and 'Snap to Playhead'.")}
								</Text>
							</Flex>
						</Box>
					</Flex>

					<Separator size="4" />

					<Flex justify="end">
						<Dialog.Close>
							<Button variant="soft" color="gray">
								{t("common.close", "Close")}
							</Button>
						</Dialog.Close>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
