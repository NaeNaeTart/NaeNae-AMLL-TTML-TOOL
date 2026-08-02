import {
	assertMatchingVersions,
	assertStableVersion,
	loadVersionSources,
	readVersions,
} from "./version-utils.mjs";

const root = process.cwd();
const tagIndex = process.argv.indexOf("--tag");
const tag =
	tagIndex === -1 ? process.env.GITHUB_REF_NAME : process.argv[tagIndex + 1];

if (!tag?.startsWith("v")) {
	throw new Error("A release tag in the form vX.Y.Z is required.");
}

const version = tag.slice(1);
assertStableVersion(version, `Release tag ${tag}`);
const manifestVersion = assertMatchingVersions(
	readVersions(loadVersionSources(root)),
);
if (manifestVersion !== version)
	throw new Error(
		`Release tag ${tag} does not match version files (${manifestVersion}).`,
	);

console.log(`Validated release version ${version}.`);
