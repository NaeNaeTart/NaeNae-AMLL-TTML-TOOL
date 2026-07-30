import { Bot24Regular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Flex,
	Heading,
	Select,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
	aiSidebarBaseUrlAtom,
	aiSidebarModelAtom,
} from "$/modules/settings/states";
import { lyricLinesAtom } from "$/states/main";
import { AI_PERSONALITIES, type AiPersonality, requestAiReview } from "./logic";
import { MarkdownReview } from "./MarkdownReview";
import { aiSidebarApiKeyAtom, aiSidebarPersonalityAtom } from "./states";

const personalityLabels: Record<AiPersonality, string> = {
	helpful: "Helpful",
	constructive: "Constructive",
	strict: "Strict",
	glazer: "Glazer",
	hater: "Hater",
	roast: "Roast",
	unhinged: "Unhinged",
};

export function AiSidebar() {
	const [personality, setPersonality] = useAtom(aiSidebarPersonalityAtom);
	const baseUrl = useAtomValue(aiSidebarBaseUrlAtom);
	const model = useAtomValue(aiSidebarModelAtom);
	const apiKey = useAtomValue(aiSidebarApiKeyAtom);
	const lyrics = useAtomValue(lyricLinesAtom);
	const [review, setReview] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const { t } = useTranslation();

	const runReview = async () => {
		setLoading(true);
		setError(null);
		try {
			setReview(
				await requestAiReview({
					baseUrl,
					model,
					apiKey,
					lyrics,
					personality,
				}),
			);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setLoading(false);
		}
	};

	return (
		<Flex
			direction="column"
			gap="3"
			height="100%"
			p="3"
			style={{
				overflow: "hidden",
				minHeight: 0,
				minWidth: 0,
				borderLeft: "1px solid var(--gray-a5)",
			}}
		>
			<Flex align="center" gap="2">
				<Bot24Regular />
				<Heading size="4">{t("aiSidebar.title", "TTML Vibe Check")}</Heading>
			</Flex>
			<Text size="1" color="gray">
				{t(
					"aiSidebar.disclaimer",
					"For fun, not validation. It cannot hear your audio.",
				)}
			</Text>
			<Select.Root
				value={personality}
				onValueChange={(value) => setPersonality(value as AiPersonality)}
			>
				<Select.Trigger />
				<Select.Content>
					{AI_PERSONALITIES.map((value) => (
						<Select.Item key={value} value={value}>
							{personalityLabels[value]}
						</Select.Item>
					))}
				</Select.Content>
			</Select.Root>
			<Button
				onClick={runReview}
				loading={loading}
				disabled={lyrics.lyricLines.length === 0}
			>
				{t("aiSidebar.review", "Review this TTML")}
			</Button>
			{lyrics.lyricLines.length === 0 && (
				<Text size="1" color="gray">
					{t(
						"aiSidebar.emptyProject",
						"Add lyrics before asking the robot to judge them.",
					)}
				</Text>
			)}
			<Card
				style={{
					flex: 1,
					minHeight: 0,
					overflow: "hidden",
					minWidth: 0,
				}}
			>
				<Box height="100%" style={{ overflowY: "auto", overflowX: "hidden" }}>
					{error ? (
						<Text color="red" size="2">
							{error}
						</Text>
					) : review ? (
						<MarkdownReview>{review}</MarkdownReview>
					) : (
						<Text color="gray" size="2">
							{t(
								"aiSidebar.empty",
								"Pick a personality, then let it have opinions about your TTML.",
							)}
						</Text>
					)}
				</Box>
			</Card>
			<Box>
				<Text size="1" color="gray">
					{t(
						"aiSidebar.dataNotice",
						"A review sends this project’s lyric text, metadata, sections, and timing to your configured provider.",
					)}
				</Text>
			</Box>
		</Flex>
	);
}
