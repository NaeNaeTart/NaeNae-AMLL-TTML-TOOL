import { Dismiss16Regular, Open16Regular } from "@fluentui/react-icons";
import {
	Badge,
	Button,
	Flex,
	IconButton,
	Spinner,
	Text,
} from "@radix-ui/themes";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { SpotifyIcon } from "$/modules/project/modals/PlatformIcons";
import { spotMatchDialogAtom } from "$/states/dialogs";
import {
	spotMatchDismissedWidgetAtom,
	spotMatchIsLoadingAtom,
	spotMatchMatchesAtom,
	spotMatchProgressMessageAtom,
	spotMatchSourceTrackAtom,
} from "../states";
import styles from "./SpotMatchFloatingWidget.module.css";

export const SpotMatchFloatingWidget = () => {
	const { t } = useTranslation();
	const [dialogState, setDialogState] = useAtom(spotMatchDialogAtom);
	const [isLoading] = useAtom(spotMatchIsLoadingAtom);
	const [progressMessage] = useAtom(spotMatchProgressMessageAtom);
	const [sourceTrack] = useAtom(spotMatchSourceTrackAtom);
	const [matches] = useAtom(spotMatchMatchesAtom);
	const [isDismissed, setIsDismissed] = useAtom(spotMatchDismissedWidgetAtom);

	const isDialogOpen =
		typeof dialogState === "boolean" ? dialogState : dialogState.open;

	// Show when dialog is closed and either loading or has matches (and not manually dismissed)
	const isVisible =
		!isDialogOpen && !isDismissed && (isLoading || matches.length > 0);

	const handleOpenDialog = () => {
		setDialogState({ open: true });
	};

	const handleDismiss = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsDismissed(true);
	};

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					initial={{ opacity: 0, y: 20, scale: 0.95 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 20, scale: 0.95 }}
					transition={{ duration: 0.2 }}
					className={styles.floatingWidget}
					onClick={handleOpenDialog}
				>
					<Flex align="center" gap="2">
						<SpotifyIcon
							style={{ width: "20px", height: "20px", color: "#1DB954" }}
						/>
						{isLoading ? (
							<Flex align="center" gap="2">
								<Spinner size="1" />
								<Flex direction="column" gap="0">
									<Text size="1" weight="bold">
										SpotMatch
									</Text>
									<Text
										size="1"
										color="gray"
										style={{ maxWidth: "220px" }}
										truncate
									>
										{progressMessage ||
											t(
												"spotmatch.searching",
												"Searching Spotify in background...",
											)}
									</Text>
								</Flex>
							</Flex>
						) : (
							<Flex align="center" gap="2">
								<div className={styles.pulsingDot} />
								<Flex direction="column" gap="0">
									<Flex align="center" gap="1">
										<Text size="1" weight="bold">
											SpotMatch
										</Text>
										<Badge color="green" size="1">
											{matches.length}
										</Badge>
									</Flex>
									<Text
										size="1"
										color="gray"
										style={{ maxWidth: "220px" }}
										truncate
									>
										{sourceTrack?.name ? `${sourceTrack.name} — ` : ""}
										{t("spotmatch.clickToReview", "Click to view matches")}
									</Text>
								</Flex>
							</Flex>
						)}
					</Flex>

					<Flex align="center" gap="1">
						<Button
							size="1"
							variant="soft"
							color="green"
							onClick={handleOpenDialog}
						>
							<Open16Regular />
							{t("common.open", "Open")}
						</Button>
						<IconButton
							size="1"
							variant="ghost"
							color="gray"
							onClick={handleDismiss}
						>
							<Dismiss16Regular />
						</IconButton>
					</Flex>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
