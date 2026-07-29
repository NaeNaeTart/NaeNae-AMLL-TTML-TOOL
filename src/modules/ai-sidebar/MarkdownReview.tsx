import type { ReactNode } from "react";

const inlineToken =
	/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\)|\*[^*]+\*|_[^_]+_)/g;

function renderInline(text: string): ReactNode[] {
	return text.split(inlineToken).map((part) => {
		if (part.startsWith("**") && part.endsWith("**")) {
			return <strong key={part}>{part.slice(2, -2)}</strong>;
		}
		if (part.startsWith("`") && part.endsWith("`")) {
			return <code key={part}>{part.slice(1, -1)}</code>;
		}
		const link = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(part);
		if (link) {
			const [, label, href] = link;
			if (/^https?:\/\//i.test(href)) {
				return (
					<a key={part} href={href} target="_blank" rel="noreferrer">
						{label}
					</a>
				);
			}
		}
		if (
			(part.startsWith("*") && part.endsWith("*")) ||
			(part.startsWith("_") && part.endsWith("_"))
		) {
			return <em key={part}>{part.slice(1, -1)}</em>;
		}
		return part;
	});
}

export function MarkdownReview({ children }: { children: string }) {
	const lines = children.split("\n");
	const blocks: ReactNode[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index];
		if (line.startsWith("```")) {
			const code: string[] = [];
			index += 1;
			while (index < lines.length && !lines[index].startsWith("```")) {
				code.push(lines[index]);
				index += 1;
			}
			blocks.push(
				<pre key={index}>
					<code>{code.join("\n")}</code>
				</pre>,
			);
		} else if (/^#{1,3}\s/.test(line)) {
			const [, hashes, content] = /^(#{1,3})\s+(.*)$/.exec(line) ?? [];
			const Tag = `h${hashes.length}` as "h1" | "h2" | "h3";
			blocks.push(<Tag key={index}>{renderInline(content)}</Tag>);
		} else if (/^[-*+]\s+/.test(line)) {
			const items: ReactNode[] = [];
			while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
				items.push(
					<li key={index}>
						{renderInline(lines[index].replace(/^[-*+]\s+/, ""))}
					</li>,
				);
				index += 1;
			}
			blocks.push(<ul key={index}>{items}</ul>);
			index -= 1;
		} else if (/^\d+\.\s+/.test(line)) {
			const items: ReactNode[] = [];
			while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
				items.push(
					<li key={index}>
						{renderInline(lines[index].replace(/^\d+\.\s+/, ""))}
					</li>,
				);
				index += 1;
			}
			blocks.push(<ol key={index}>{items}</ol>);
			index -= 1;
		} else if (line.startsWith("> ")) {
			blocks.push(
				<blockquote key={index}>{renderInline(line.slice(2))}</blockquote>,
			);
		} else if (line.trim() === "---") {
			blocks.push(<hr key={index} />);
		} else if (line.trim()) {
			blocks.push(<p key={index}>{renderInline(line)}</p>);
		}
		index += 1;
	}

	return (
		<div
			style={{
				overflowWrap: "anywhere",
				wordBreak: "break-word",
				whiteSpace: "pre-wrap",
			}}
		>
			{blocks}
		</div>
	);
}
