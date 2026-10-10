import { DismissRegular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Dialog,
	Flex,
	Heading,
	ScrollArea,
	Text,
} from "@radix-ui/themes";
import { open } from "@tauri-apps/plugin-shell";
import { useAtom } from "jotai";
import changelog from "$/data/changelog.json";
import legacy from "$/data/changelog-legacy.json";
import { changelogDialogAtom } from "$/states/dialogs.ts";
import { ChangeMarkdown, releaseColor } from "./change-notes.tsx";

export function ChangelogDialog() {
	const [isOpen, setIsOpen] = useAtom(changelogDialogAtom);

	const openGitHub = async () => {
		const repoUrl =
			"https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/commits/main";
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open(repoUrl);
		} else {
			window.open(repoUrl, "_blank");
		}
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 650, height: "70vh", maxHeight: 600 }}>
				<Flex justify="between" align="center" mb="4">
					<Flex align="center" gap="3">
						<Dialog.Title mb="0">Changelog & Updates</Dialog.Title>
						<Button
							variant="soft"
							size="1"
							color="indigo"
							onClick={openGitHub}
							style={{ cursor: "pointer" }}
						>
							View Commits on GitHub
						</Button>
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
					style={{ height: "calc(100% - 60px)" }}
				>
					<Flex direction="column" gap="5" pr="4">
						{[
							...changelog.map((release) => ({
								...release,
								heading:
									release.heading ??
									`v${release.version} Updates (${release.summary})`,
							})),
							{ ...legacy, heading: legacy.summary },
						].map((release) => (
							<Box key={release.heading}>
								<Heading size="4" mb="2" color={releaseColor(release.color)}>
									{release.heading}
								</Heading>
								<Flex direction="column" gap="3">
									{release.entries.map((entry) => (
										<Text size="2" key={`${entry.title}:${entry.body ?? ""}`}>
											<strong>
												<ChangeMarkdown text={entry.title} />
												{entry.body ? ":" : ""}
											</strong>
											{entry.body && (
												<>
													{" "}
													<ChangeMarkdown text={entry.body} />
												</>
											)}
										</Text>
									))}
								</Flex>
							</Box>
						))}
					</Flex>
				</ScrollArea>
			</Dialog.Content>
		</Dialog.Root>
	);
}
