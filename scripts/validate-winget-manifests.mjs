import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const readArgument = (name) => {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
};

const version = readArgument("--version");
const outputRoot = readArgument("--output");
if (!version || !outputRoot)
	throw new Error("Both --version and --output are required.");

const metadata = JSON.parse(
	readFileSync(join(process.cwd(), "winget", "package.json"), "utf8"),
);
const manifestDirectory = join(
	resolve(outputRoot),
	"manifests",
	metadata.packageIdentifier[0].toLowerCase(),
	...metadata.packageIdentifier.split("."),
	version,
);
const manifests = {
	version: readFileSync(
		join(manifestDirectory, `${metadata.packageIdentifier}.yaml`),
		"utf8",
	),
	installer: readFileSync(
		join(manifestDirectory, `${metadata.packageIdentifier}.installer.yaml`),
		"utf8",
	),
	locale: readFileSync(
		join(manifestDirectory, `${metadata.packageIdentifier}.locale.en-US.yaml`),
		"utf8",
	),
};

const requiredFields = [
	[manifests.version, `PackageIdentifier: ${metadata.packageIdentifier}`],
	[manifests.version, `PackageVersion: ${version}`],
	[manifests.version, "ManifestType: version"],
	[manifests.installer, "InstallerType: wix"],
	[manifests.installer, "Architecture: x64"],
	[manifests.installer, "ManifestType: installer"],
	[manifests.locale, `PackageName: ${JSON.stringify(metadata.packageName)}`],
	[manifests.locale, "ManifestType: defaultLocale"],
];

for (const [manifest, field] of requiredFields) {
	if (!manifest.includes(field))
		throw new Error(`Missing required field: ${field}`);
}

const installerUrl = manifests.installer.match(/^\s+InstallerUrl: (.+)$/m)?.[1];
const installerHash = manifests.installer.match(
	/^\s+InstallerSha256: (.+)$/m,
)?.[1];
if (!installerUrl?.startsWith('"https://')) {
	throw new Error("InstallerUrl must be an HTTPS URL.");
}
if (!/^[A-F0-9]{64}$/.test(installerHash ?? "")) {
	throw new Error(
		"InstallerSha256 must be a 64-character uppercase SHA-256 hash.",
	);
}

console.log(
	`Validated Winget manifests for ${metadata.packageIdentifier} ${version}.`,
);
