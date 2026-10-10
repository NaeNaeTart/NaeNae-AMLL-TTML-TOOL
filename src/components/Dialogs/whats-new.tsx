import {
	BoxRegular,
	CheckmarkCircleRegular,
	DismissRegular,
	FlashRegular,
	FolderRegular,
	InfoRegular,
	LocalLanguageRegular,
	MusicNote1Regular,
	RecordRegular,
	SettingsRegular,
	ShieldCheckmarkRegular,
	Sparkle24Regular,
	StarRegular,
	TaskListLtrRegular,
	TimerRegular,
	TranslateRegular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	Grid,
	Heading,
	IconButton,
	Popover,
	ScrollArea,
	Text,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import changelog from "$/data/changelog.json";
import whatsNew from "$/data/whats-new.json";
import { whatsNewDialogAtom } from "$/states/dialogs.ts";
import {
	ChangeMarkdown,
	releaseColor,
	releaseHighlights,
} from "./change-notes.tsx";

const icons: Record<string, ReactNode> = {
	FolderRegular: <FolderRegular />,
	TaskListLtrRegular: <TaskListLtrRegular />,
	FlashRegular: <FlashRegular />,
	MusicNote1Regular: <MusicNote1Regular />,
	CheckmarkCircleRegular: <CheckmarkCircleRegular />,
	TimerRegular: <TimerRegular />,
	SettingsRegular: <SettingsRegular />,
	StarRegular: <StarRegular />,
	ShieldCheckmarkRegular: <ShieldCheckmarkRegular />,
	Sparkle24Regular: <Sparkle24Regular />,
	RecordRegular: <RecordRegular />,
	TranslateRegular: <TranslateRegular />,
	LocalLanguageRegular: <LocalLanguageRegular />,
	BoxRegular: <BoxRegular />,
};

export function WhatsNewDialog() {
	const [isOpen, setIsOpen] = useAtom(whatsNewDialogAtom);
	const { t } = useTranslation();

	const features = [
		...releaseHighlights(changelog).map((entry) => ({
			...entry,
			icon: <StarRegular />,
		})),
		...whatsNew.features
			.filter((feature) => !("retired" in feature && feature.retired))
			.map((feature) => ({
				...feature,
				icon: icons[feature.icon] ?? <StarRegular />,
			})),
	];

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 850, height: "85vh", maxHeight: 800 }}>
				<Flex justify="between" align="center" mb="4">
					<Flex direction="column">
						<Dialog.Title mb="1">What's New in NaeNae's Fork</Dialog.Title>
						<Text size="2" color="gray">
							{t("changeNotes.highlightsDescription")}
						</Text>
					</Flex>
					<Dialog.Close>
						<Button variant="ghost" color="gray">
							<DismissRegular />
						</Button>
					</Dialog.Close>
				</Flex>

				<ScrollArea
					type="always"
					scrollbars="vertical"
					style={{ height: "calc(100% - 80px)" }}
				>
					<Flex direction="column" gap="4" pr="4">
						<Card
							variant="surface"
							style={{ backgroundColor: "var(--accent-2)" }}
						>
							<Text size="2" style={{ fontStyle: "italic" }}>
								"This fork focuses on professional-grade performance, cinematic
								visual fidelity, and streamlined synchronization workflows that
								go beyond the original tool's scope."
							</Text>
						</Card>

						<Grid columns="2" gap="3">
							{features.map((f) => (
								<Card
									key={`${f.info}:${f.title}`}
									variant="classic"
									style={{ padding: "var(--space-3)" }}
								>
									<Flex direction="column" gap="2">
										<Flex align="center" justify="between">
											<Flex align="center" gap="2">
												<Box style={{ color: `var(--${f.color}-11)` }}>
													{f.icon}
												</Box>
												<Heading size="3">{f.title}</Heading>
											</Flex>
											<Popover.Root>
												<Popover.Trigger>
													<IconButton
														size="1"
														variant="ghost"
														color="gray"
														style={{ cursor: "pointer" }}
													>
														<InfoRegular />
													</IconButton>
												</Popover.Trigger>
												<Popover.Content style={{ width: 300 }} size="2">
													<Flex direction="column" gap="2">
														<Text
															size="2"
															weight="bold"
															color={releaseColor(f.color)}
														>
															{f.title}
														</Text>
														<Text size="2" color="gray">
															{f.info}
														</Text>
													</Flex>
												</Popover.Content>
											</Popover.Root>
										</Flex>
										<Text size="2" color="gray">
											<ChangeMarkdown text={f.body ?? ""} />
										</Text>
									</Flex>
								</Card>
							))}
						</Grid>

						<Box mt="2" mb="4">
							<Heading size="3" mb="2">
								Other Enhancements
							</Heading>
							<Flex direction="column" gap="2">
								{whatsNew.enhancements.map((entry) => (
									<Text size="2" key={entry.title}>
										• <strong>{entry.title}</strong>:{" "}
										<ChangeMarkdown text={entry.body} />
									</Text>
								))}
							</Flex>
						</Box>
					</Flex>
				</ScrollArea>
			</Dialog.Content>
		</Dialog.Root>
	);
}
