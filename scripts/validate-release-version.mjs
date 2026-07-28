import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const tagIndex = process.argv.indexOf("--tag");
const tag =
	tagIndex === -1 ? process.env.GITHUB_REF_NAME : process.argv[tagIndex + 1];

if (!tag?.startsWith("v")) {
	throw new Error("A release tag in the form vX.Y.Z is required.");
}

const version = tag.slice(1);
if (!/^\d+\.\d+\.\d+$/.test(version)) {
	throw new Error(`Release tag ${tag} must use stable SemVer (vX.Y.Z).`);
}

const packageVersion = JSON.parse(
	readFileSync(join(root, "package.json"), "utf8"),
).version;
const tauriVersion = JSON.parse(
	readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"),
).version;
const cargoToml = readFileSync(join(root, "src-tauri", "Cargo.toml"), "utf8");
const cargoVersion = cargoToml.match(/^version = "([^"]+)"$/m)?.[1];

const versions = {
	"package.json": packageVersion,
	"src-tauri/tauri.conf.json": tauriVersion,
	"src-tauri/Cargo.toml": cargoVersion,
};

const mismatches = Object.entries(versions).filter(
	([, value]) => value !== version,
);
if (mismatches.length > 0) {
	throw new Error(
		`Release tag ${tag} does not match version files:\n${Object.entries(
			versions,
		)
			.map(([file, value]) => `- ${file}: ${value ?? "missing"}`)
			.join("\n")}`,
	);
}

console.log(`Validated release version ${version}.`);
