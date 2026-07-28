import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const readArgument = (name) => {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
};

const requiredArguments = [
	"--version",
	"--installer-url",
	"--installer-sha256",
	"--output",
];
for (const argument of requiredArguments) {
	if (!readArgument(argument)) throw new Error(`Missing ${argument}.`);
}

const version = readArgument("--version");
const installerUrl = readArgument("--installer-url");
const installerSha256 = readArgument("--installer-sha256").toUpperCase();
const outputRoot = resolve(readArgument("--output"));
const metadata = JSON.parse(
	readFileSync(join(process.cwd(), "winget", "package.json"), "utf8"),
);
const manifestVersion = "1.10.0";
const manifestDirectory = join(
	outputRoot,
	"manifests",
	metadata.packageIdentifier[0].toLowerCase(),
	...metadata.packageIdentifier.split("."),
	version,
);

const yaml = (value) => JSON.stringify(value);
const writeManifest = (suffix, content) => {
	mkdirSync(manifestDirectory, { recursive: true });
	writeFileSync(
		join(
			manifestDirectory,
			suffix
				? `${metadata.packageIdentifier}.${suffix}.yaml`
				: `${metadata.packageIdentifier}.yaml`,
		),
		`${content}\n`,
	);
};

writeManifest(
	undefined,
	`# yaml-language-server: $schema=https://aka.ms/winget-manifest.version.${manifestVersion}.schema.json
PackageIdentifier: ${metadata.packageIdentifier}
PackageVersion: ${version}
DefaultLocale: ${metadata.packageLocale}
ManifestType: version
ManifestVersion: ${manifestVersion}`,
);

writeManifest(
	"installer",
	`# yaml-language-server: $schema=https://aka.ms/winget-manifest.installer.${manifestVersion}.schema.json
PackageIdentifier: ${metadata.packageIdentifier}
PackageVersion: ${version}
InstallerType: wix
Installers:
  - Architecture: x64
    InstallerUrl: ${yaml(installerUrl)}
    InstallerSha256: ${installerSha256}
ManifestType: installer
ManifestVersion: ${manifestVersion}`,
);

writeManifest(
	"locale.en-US",
	`# yaml-language-server: $schema=https://aka.ms/winget-manifest.defaultLocale.${manifestVersion}.schema.json
PackageIdentifier: ${metadata.packageIdentifier}
PackageVersion: ${version}
PackageLocale: ${metadata.packageLocale}
Publisher: ${yaml(metadata.publisher)}
PublisherUrl: ${yaml(metadata.publisherUrl)}
PublisherSupportUrl: ${yaml(metadata.publisherSupportUrl)}
PackageName: ${yaml(metadata.packageName)}
PackageUrl: ${yaml(metadata.packageUrl)}
License: ${yaml(metadata.license)}
LicenseUrl: ${yaml(metadata.licenseUrl)}
ShortDescription: ${yaml(metadata.shortDescription)}
Description: ${yaml(metadata.description)}
Moniker: ${metadata.moniker}
Tags:
${metadata.tags.map((tag) => `  - ${tag}`).join("\n")}
ManifestType: defaultLocale
ManifestVersion: ${manifestVersion}`,
);

console.log(
	`Generated Winget manifests for ${metadata.packageIdentifier} ${version}.`,
);
