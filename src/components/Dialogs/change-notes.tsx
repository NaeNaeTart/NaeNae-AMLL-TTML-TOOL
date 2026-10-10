import type { Heading } from "@radix-ui/themes";
import type { ComponentProps, ReactNode } from "react";

const colors = [
	"gray",
	"gold",
	"bronze",
	"brown",
	"yellow",
	"amber",
	"orange",
	"tomato",
	"red",
	"ruby",
	"crimson",
	"pink",
	"plum",
	"purple",
	"violet",
	"iris",
	"indigo",
	"blue",
	"cyan",
	"teal",
	"jade",
	"green",
	"grass",
	"lime",
	"mint",
	"sky",
] as const satisfies readonly NonNullable<
	ComponentProps<typeof Heading>["color"]
>[];

export const releaseColor = (color: string) =>
	colors.find((item) => item === color) ?? "blue";

export function releaseHighlights(
	releases: readonly {
		version: string;
		color: string;
		entries: readonly { title: string; body?: string; highlight?: boolean }[];
	}[],
) {
	return releases.flatMap((release) =>
		release.entries
			.filter((entry) => entry.highlight === true)
			.map((entry) => ({
				...entry,
				color: release.color,
				info: `v${release.version}`,
			})),
	);
}

// React escapes plain text; only this inline subset becomes markup.
// Italics are retained for the migrated release history.
export function ChangeMarkdown({ text }: { text: string }): ReactNode {
	const nodes: ReactNode[] = [];
	const pattern =
		/`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^\s)]+)\)|\*([^*]+)\*/gs;
	let offset = 0;
	for (const match of text.matchAll(pattern)) {
		const index = match.index;
		if (index > offset) nodes.push(text.slice(offset, index));
		if (match[1] !== undefined) nodes.push(<code key={index}>{match[1]}</code>);
		else if (match[2] !== undefined)
			nodes.push(
				<strong key={index}>
					<ChangeMarkdown text={match[2]} />
				</strong>,
			);
		else if (match[3] !== undefined) {
			if (/^(https?:\/\/|mailto:)/i.test(match[4]))
				nodes.push(
					<a key={index} href={match[4]} target="_blank" rel="noreferrer">
						<ChangeMarkdown text={match[3]} />
					</a>,
				);
			else nodes.push(match[0]);
		} else nodes.push(<em key={index}>{match[5]}</em>);
		offset = index + match[0].length;
	}
	nodes.push(text.slice(offset));
	return <>{nodes}</>;
}
