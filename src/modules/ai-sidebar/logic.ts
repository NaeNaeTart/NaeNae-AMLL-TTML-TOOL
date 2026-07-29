import type { TTMLLyric } from "$/types/ttml";

export const AI_PERSONALITIES = [
	"helpful",
	"constructive",
	"strict",
	"glazer",
	"hater",
	"roast",
	"unhinged",
] as const;

export type AiPersonality = (typeof AI_PERSONALITIES)[number];

const personalityInstructions: Record<AiPersonality, string> = {
	helpful:
		"Be warm and playful. Point out fun observations without pretending they are hard facts.",
	constructive:
		"Be kindly blunt, but keep this light and entertaining rather than authoritative.",
	strict:
		"Be terse, picky, and dramatically unimpressed. Do not present guesses as validation failures.",
	glazer:
		"Be absurdly complimentary. Hype every questionable choice as if this TTML belongs in a museum.",
	hater:
		"Be a theatrical hater. Be mean to the TTML, never to the user, and keep it funny.",
	roast:
		"Roast the TTML with sharp, silly jokes. Keep it playful and avoid hateful or personal attacks.",
	unhinged:
		"Be surreal and chaotic, but still talk about the supplied TTML instead of inventing facts.",
};

export interface AiReviewPayload {
	metadata: Array<{ key: string; value: string[] }>;
	sections: Array<{
		label: string;
		category: string;
		ordinal?: number;
		notes?: string;
		vocalist?: string;
	}>;
	lyrics: Array<{
		index: number;
		startTime: number;
		endTime: number;
		text: string;
		translation?: string;
		romanization?: string;
		background: boolean;
		lineSynced: boolean;
	}>;
	truncated: boolean;
}

const MAX_LINES = 180;
const MAX_PAYLOAD_LENGTH = 12_000;
const MAX_TEXT_LENGTH = 280;
const MAX_METADATA_LENGTH = 120;
const MAX_SECTION_LENGTH = 160;

const trimText = (value: string | undefined) =>
	value?.slice(0, MAX_TEXT_LENGTH) || undefined;

export function createReviewPayload(lyrics: TTMLLyric): AiReviewPayload {
	const payload: AiReviewPayload = {
		metadata: lyrics.metadata.slice(0, 24).map(({ key, value }) => ({
			key: key.slice(0, MAX_METADATA_LENGTH),
			value: value
				.slice(0, 3)
				.map((item) => item.slice(0, MAX_METADATA_LENGTH)),
		})),
		sections: (lyrics.sections ?? []).slice(0, 40).map((section) => ({
			label: section.label.slice(0, MAX_SECTION_LENGTH),
			category: section.category,
			ordinal: section.ordinal,
			notes: trimText(section.notes),
			vocalist: trimText(section.vocalist),
		})),
		lyrics: lyrics.lyricLines.slice(0, MAX_LINES).map((line, index) => ({
			index,
			startTime: line.startTime,
			endTime: line.endTime,
			text: line.words
				.map((word) => word.word)
				.join("")
				.slice(0, MAX_TEXT_LENGTH),
			translation: trimText(line.translatedLyric),
			romanization: trimText(line.romanLyric),
			background: Boolean(line.isBG),
			lineSynced: Boolean(line.isLineSynced),
		})),
		truncated: lyrics.lyricLines.length > MAX_LINES,
	};

	while (
		payload.lyrics.length > 0 &&
		JSON.stringify(payload).length > MAX_PAYLOAD_LENGTH
	) {
		payload.lyrics.pop();
		payload.truncated = true;
	}
	return payload;
}

export function createReviewMessages(
	lyrics: TTMLLyric,
	personality: AiPersonality,
) {
	const payload = JSON.stringify(createReviewPayload(lyrics));
	return [
		{
			role: "system",
			content: `You are the AMLL TTML Tool fun sidebar. ${personalityInstructions[personality]} This is entertainment, not a validator. You cannot hear the song or audio, so never claim timing is definitely wrong; call timing opinions vibes or guesses. Do not claim that a TTML schema check was run. Give a short, plain-text reaction to the supplied project.`,
		},
		{
			role: "user",
			content: `Please react to this TTML project:\n${payload}`,
		},
	];
}

function getResponseText(content: unknown): string | null {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return (
			content
				.map((part) =>
					typeof part === "object" && part !== null && "text" in part
						? String(part.text)
						: "",
				)
				.join("") || null
		);
	}
	return null;
}

export async function requestAiReview({
	baseUrl,
	model,
	apiKey,
	lyrics,
	personality,
}: {
	baseUrl: string;
	model: string;
	apiKey: string;
	lyrics: TTMLLyric;
	personality: AiPersonality;
}): Promise<string> {
	if (!baseUrl.trim() || !model.trim() || !apiKey.trim()) {
		throw new Error(
			"Add an endpoint, model, and API key in Settings > AI first.",
		);
	}
	const response = await fetch(
		`${baseUrl.replace(/\/+$/, "")}/chat/completions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages: createReviewMessages(lyrics, personality),
				temperature: 1,
			}),
		},
	);
	if (!response.ok) {
		const error = await response.text();
		throw new Error(error || `AI request failed (${response.status}).`);
	}
	const data = await response.json();
	const content = getResponseText(data?.choices?.[0]?.message?.content);
	if (!content) throw new Error("The AI returned no review.");
	return content;
}
