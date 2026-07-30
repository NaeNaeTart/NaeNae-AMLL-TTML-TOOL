import { BUILD_TIME, GIT_COMMIT } from "virtual:buildmeta";
import {
	CheckmarkCircle24Regular,
	CloudArrowDown24Regular,
	BoxRegular,
	MusicNote1Regular,
	Open16Regular,
	SettingsRegular,
	StarRegular,
} from "@fluentui/react-icons";
import {
	Avatar,
	AlertDialog,
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Grid,
	Heading,
	Link,
	Progress,
	Text,
} from "@radix-ui/themes";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppUpdate } from "$/utils/useAppUpdate";
import { clearWebsiteCache, forceWebsiteRefresh } from "$/utils/pwa";

export const SettingsAboutTab = () => {
	const { t } = useTranslation();
	const { status, update, progress, installUpdate } = useAppUpdate();
	const [cacheConfirmationOpen, setCacheConfirmationOpen] = useState(false);
	const [recoveryAction, setRecoveryAction] = useState<"refresh" | "clear" | null>(null);

	const showUpdateCard = ["available", "downloading", "ready"].includes(status);
	const isWebsite = !import.meta.env.TAURI_ENV_PLATFORM;

	const handleForceRefresh = async () => {
		setRecoveryAction("refresh");
		try {
			await forceWebsiteRefresh();
		} finally {
			setRecoveryAction(null);
		}
	};

	const handleClearCache = async () => {
		setRecoveryAction("clear");
		try {
			await clearWebsiteCache();
		} finally {
			setRecoveryAction(null);
			setCacheConfirmationOpen(false);
		}
	};

	return (
		<Flex direction="column" gap="4">
			<Flex direction="column" gap="1">
				<Heading size="4">
					{t("aboutModal.appName", "Apple Music-like lyrics TTML Tools")}
				</Heading>
				<Text as="div" size="2" color="gray">
					{t(
						"aboutModal.description",
						"A TTML lyric and timing editor designed for the Apple Music-like lyrics ecosystem",
					)}
				</Text>
			</Flex>


			<Card>
				<Flex direction="column" gap="3">
					<Heading size="3">
						{t("aboutModal.maintainers", "Fork Maintainers")}
					</Heading>
					<Text size="2" color="gray">
						{t(
							"aboutModal.maintainersDesc",
							"This fork is maintained and developed by:",
						)}
					</Text>
					<Flex gap="2">
						<Box p="3" style={{ flex: 1, background: "var(--gray-3)", borderRadius: "var(--radius-3)" }}>
							<Flex align="center">
								<Flex align="center" gap="2" style={{ minWidth: 0, flex: 1 }}>
									<Avatar src="https://avatars.githubusercontent.com/u/191877009?v=4" fallback="N" size="3" radius="small" />
									<Flex direction="column" gap="1">
										<Text as="div" weight="bold">NaeNaeTart</Text>
										<Text as="div" size="1" color="gray">
											{t("aboutModal.forkMaintainer", "Fork maintainer & contributor")}
										</Text>
									</Flex>
								</Flex>
								<Button asChild variant="soft" size="1">
									<a href="https://yoursit.ee/naenaetart" target="_blank" rel="noreferrer" aria-label={t("aboutModal.visitWebsite", "Visit website")}>
										<Open16Regular />
									</a>
								</Button>
							</Flex>
						</Box>
<Box p="3" style={{ flex: 1, background: "var(--gray-3)", borderRadius: "var(--radius-3)" }}>
							<Flex align="center">
								<Flex align="center" gap="2" style={{ minWidth: 0, flex: 1 }}>
									<Avatar src="https://avatars.githubusercontent.com/u/55551133?v=4" fallback="T" size="3" radius="small" />
									<Flex direction="column" gap="1">
										<Text as="div" weight="bold">TX24</Text>
										<Text as="div" size="1" color="gray">
											{t("aboutModal.forkMaintainer", "Fork maintainer & contributor")}
										</Text>
									</Flex>
								</Flex>
								<Button asChild variant="soft" size="1">
									<a href="https://tx24.dev" target="_blank" rel="noreferrer" aria-label={t("aboutModal.visitWebsite", "Visit website")}>
										<Open16Regular />
									</a>
								</Button>
							</Flex>
						</Box>
					</Flex>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="3">
					<Heading size="3">
						{t("aboutModal.credits", "Credits & Third-Party Notices")}
					</Heading>
					<Text size="2" color="gray">
						{t(
							"aboutModal.creditsIntro",
							"This project includes work adapted from the following open-source projects.",
						)}
					</Text>
					<Grid columns="2" gap="3">
						<Card variant="classic" style={{ padding: "var(--space-3)" }}>
							<Flex direction="column" gap="2">
								<Flex align="center" gap="2">
									<Box style={{ color: "var(--ruby-11)" }}><StarRegular /></Box>
									<Heading size="3">Spicy Lyrics</Heading>
								</Flex>
								<Text size="2" color="gray">
									Renderer and font adapted from <Link href="https://github.com/Spikerko/Spicy-Lyrics" target="_blank" rel="noreferrer">Spicy Lyrics</Link> by Spikerko and contributors, licensed under AGPL-3.0-or-later.
								</Text>
							</Flex>
						</Card>
						<Card variant="classic" style={{ padding: "var(--space-3)" }}>
							<Flex direction="column" gap="2">
								<Flex align="center" gap="2">
									<Box style={{ color: "var(--violet-11)" }}><SettingsRegular /></Box>
									<Heading size="3">Fraktality Spring</Heading>
								</Flex>
								<Text size="2" color="gray">
									Analytic spring implementation derived from Fraktality&apos;s <code>spr.lua</code>, licensed under the MIT License.
								</Text>
							</Flex>
						</Card>
						<Card variant="classic" style={{ padding: "var(--space-3)" }}>
							<Flex direction="column" gap="2">
								<Flex align="center" gap="2">
									<Box style={{ color: "var(--cyan-11)" }}><MusicNote1Regular /></Box>
									<Heading size="3">Prosodic Engine</Heading>
								</Flex>
								<Text size="2" color="gray">
									Syllabification engine and dictionary adapted from <Link href="https://github.com/amll-dev/amll-editor" target="_blank" rel="noreferrer">amll-dev/amll-editor</Link>, licensed under GNU AGPL-3.0-only.
								</Text>
							</Flex>
						</Card>
						<Card variant="classic" style={{ padding: "var(--space-3)" }}>
							<Flex direction="column" gap="2">
								<Flex align="center" gap="2">
									<Box style={{ color: "var(--gold-11)" }}><BoxRegular /></Box>
									<Heading size="3">AMLL TTML Tool</Heading>
								</Flex>
								<Text size="2" color="gray">
									Forked from <Link href="https://github.com/amll-dev/amll-ttml-tool" target="_blank" rel="noreferrer">amll-dev/amll-ttml-tool</Link>, licensed under GPL-3.0-or-later.
								</Text>
							</Flex>
						</Card>
					</Grid>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="3">
					<Heading size="3">
						{t("aboutModal.community", "Community & Contributions")}
					</Heading>
					<Text size="2" color="gray">
						{t(
							"aboutModal.communityDesc",
							"Help us make the tool better by contributing code, reporting issues, or providing translations.",
						)}
					</Text>
					<Flex gap="3" mt="1">
						<Button
							variant="soft"
							onClick={() => open("https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL")}
						>
							{t("aboutModal.github", "GitHub Repository")}
						</Button>
						<Button
							variant="soft"
							color="indigo"
							onClick={() => open("https://crowdin.com/project/very-cool-ttml-tool")}
						>
							{t("aboutModal.crowdin", "Help Translate in Crowdin")}
						</Button>
					</Flex>
				</Flex>
			</Card>


			{isWebsite && (
				<Card>
					<Flex direction="column" gap="3">
						<Heading size="3">
							{t("settings.about.websiteUpdate", "Website Update")}
						</Heading>
						<Text size="2" color="gray">
							{t(
								"settings.about.websiteUpdateDescription",
								"Refresh the website to retrieve the latest version if an update prompt did not appear.",
							)}
						</Text>
						<Flex gap="3" wrap="wrap">
							<Button onClick={handleForceRefresh} disabled={recoveryAction !== null}>
								{t("settings.about.forceRefresh", "Force refresh")}
							</Button>
							<Button
								variant="soft"
								color="red"
								onClick={() => setCacheConfirmationOpen(true)}
								disabled={recoveryAction !== null}
							>
								{t("settings.about.clearWebsiteCache", "Clear cached website data")}
							</Button>
						</Flex>
					</Flex>
				</Card>
			)}

			<AlertDialog.Root
				open={cacheConfirmationOpen}
				onOpenChange={setCacheConfirmationOpen}
			>
				<AlertDialog.Content maxWidth="420px">
					<AlertDialog.Title>
						{t("settings.about.clearWebsiteCacheTitle", "Clear cached website data?")}
					</AlertDialog.Title>
					<AlertDialog.Description size="2">
						{t(
							"settings.about.clearWebsiteCacheDescription",
							"This removes offline website files and reloads the page. Your saved projects and preferences will not be deleted.",
						)}
					</AlertDialog.Description>
					<Flex gap="3" mt="4" justify="end">
						<AlertDialog.Cancel>
							<Button variant="soft" color="gray" disabled={recoveryAction !== null}>
								{t("common.cancel", "Cancel")}
							</Button>
						</AlertDialog.Cancel>
						<AlertDialog.Action>
							<Button color="red" onClick={handleClearCache} disabled={recoveryAction !== null}>
								{t("settings.about.clearWebsiteCache", "Clear cached website data")}
							</Button>
						</AlertDialog.Action>
					</Flex>
				</AlertDialog.Content>
			</AlertDialog.Root>

			<Card>
				<Flex direction="column" gap="2">
					<Flex direction="column" gap="1">
						<Text as="div" size="2">
							{t("aboutModal.buildDate", "Build Date: {date}", {
								date: BUILD_TIME,
							})}
						</Text>
						<Text as="div" size="2">
							{t("aboutModal.gitCommit", "Git Commit: {commit}", {
								commit:
									GIT_COMMIT === "unknown" ? (
										t("aboutModal.unknown", "Unknown")
									) : (
										<Link
											href={`https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/commit/${GIT_COMMIT}`}
											target="_blank"
											rel="noreferrer"
										>
											{GIT_COMMIT}
										</Link>
									),
							})}
						</Text>
					</Flex>
				</Flex>
			</Card>

			{showUpdateCard && (
				<Card>
					<Flex direction="column" gap="3">
						<Flex align="center" gap="2">
							<Heading size="3">
								{t("settings.about.update", "Software Update")}
							</Heading>
							{status === "available" && (
								<Badge color="ruby">
									{t("settings.about.newVersion", "New Version")}
								</Badge>
							)}
						</Flex>

						<Box>
							{status === "available" && update && (
								<Flex direction="column" gap="3">
									<Flex
										direction="column"
										gap="1"
										style={{
											padding: "8px",
											background: "var(--gray-3)",
											borderRadius: "6px",
										}}
									>
										<Text weight="bold" size="2">
											{update.version}
										</Text>
										<Text size="1" style={{ whiteSpace: "pre-wrap" }}>
											{update.body}
										</Text>
									</Flex>
									<Flex gap="3">
										<Button onClick={installUpdate}>
											<CloudArrowDown24Regular />
											{t("settings.about.updateNow", "Update Now")}
										</Button>
									</Flex>
								</Flex>
							)}

							{status === "downloading" && (
								<Flex direction="column" gap="2">
									<Flex justify="between">
										<Text size="2">
											{t("settings.about.downloading", "Downloading update...")}
										</Text>
										<Text size="2">{progress.toFixed(0)}%</Text>
									</Flex>
									<Progress value={progress} />
								</Flex>
							)}

							{status === "ready" && (
								<Flex direction="column" gap="2">
									<Flex align="center" gap="2">
										<CheckmarkCircle24Regular color="var(--ruby-9)" />
										<Text size="2">
											{t(
												"settings.about.ready",
												"Update ready, restart application to apply",
											)}
										</Text>
									</Flex>
									<Button onClick={() => window.location.reload()}>
										{t("settings.about.restart", "Restart Application")}
									</Button>
								</Flex>
							)}
						</Box>
					</Flex>
				</Card>
			)}
		</Flex>
	);
};
