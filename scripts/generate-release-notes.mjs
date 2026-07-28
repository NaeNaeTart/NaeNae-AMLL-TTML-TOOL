import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const getTagName = (node) =>
	node.tagName?.getText() ?? node.openingElement?.tagName?.getText();

const renderChildren = (children) => {
	let output = "";
	const append = (value) => {
		if (
			output &&
			value &&
			!/\s$/.test(output) &&
			!/^\s|^[.,;:!?)]/.test(value)
		) {
			output += " ";
		}
		output += value;
	};

	for (const child of children) {
		if (ts.isJsxText(child)) {
			append(child.getText());
			continue;
		}

		if (ts.isJsxExpression(child)) {
			if (child.expression) return null;
			continue;
		}

		if (!ts.isJsxElement(child) && !ts.isJsxSelfClosingElement(child)) {
			return null;
		}

		const tagName = getTagName(child);
		if (tagName === "br") {
			append("\n");
			continue;
		}
		if (ts.isJsxSelfClosingElement(child)) return null;

		const content = renderChildren(child.children);
		if (content === null) return null;

		switch (tagName) {
			case "strong":
				append(`**${content.trim()}**`);
				break;
			case "code":
				append(`\`${content.trim()}\``);
				break;
			case "em":
				append(`*${content.trim()}*`);
				break;
			default:
				append(content);
		}
	}

	return output.replace(/[\t\r\n ]+/g, " ").trim();
};

const getElementChildren = (element) =>
	element.children.filter((child) => ts.isJsxElement(child));

export const generateReleaseNotes = (source, version) => {
	const sourceFile = ts.createSourceFile(
		"changelog.tsx",
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	let result = null;

	const visit = (node) => {
		if (
			result ||
			!ts.isJsxElement(node) ||
			getTagName(node.openingElement) !== "Box"
		) {
			ts.forEachChild(node, visit);
			return;
		}

		const children = getElementChildren(node);
		const headingIndex = children.findIndex(
			(child) => getTagName(child.openingElement) === "Heading",
		);
		const heading = children[headingIndex];
		const content = children[headingIndex + 1];
		const headingText = heading && renderChildren(heading.children);

		if (
			headingText?.startsWith(`v${version}`) &&
			getTagName(content?.openingElement) === "Flex"
		) {
			const entries = getElementChildren(content)
				.filter((child) => getTagName(child.openingElement) === "Text")
				.map((child) => renderChildren(child.children));

			if (entries.length > 0 && entries.every((entry) => entry)) {
				result = entries.map((entry) => `- ${entry}`).join("\n");
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return result;
};

const readArgument = (name) => {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
};

const version = readArgument("--version");
const changelogPath = readArgument("--changelog");
const outputPath = readArgument("--output");

if (version && changelogPath && outputPath) {
	const notes = generateReleaseNotes(
		readFileSync(changelogPath, "utf8"),
		version,
	);
	if (!notes) {
		console.warn(`No readable changelog entry found for v${version}.`);
		process.exitCode = 2;
	} else {
		mkdirSync(dirname(resolve(outputPath)), { recursive: true });
		writeFileSync(outputPath, `${notes}\n`);
		console.log(`Generated release notes for v${version}.`);
	}
}
