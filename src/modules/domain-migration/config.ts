export const OFFICIAL_TOOL_ORIGIN = "https://tool.community.spicylyrics.org";

export const LEGACY_TOOL_ORIGINS = [
	"https://ttml.tx24.dev",
	"https://tool.knightryry.xyz",
	"https://verycool-ttml-tool-trust.vercel.app",
	"https://vercel-amll-ttml-tool-gokingmarine1-3200s-projects.vercel.app",
	"https://ttmltool.community.reel.peak.reelcertified.meow.spicylyrics.org",
] as const;

export const MIGRATION_COMPLETED_KEY = "domainMigrationCompleted:v1";
export const MIGRATION_PROTOCOL_VERSION = 1;
export const MIGRATION_CHUNK_SIZE = 1024 * 1024;

export type MigrationHostKind = "official" | "legacy" | "other";

export function classifyMigrationOrigin(
	origin: string,
	isTauri = false,
): MigrationHostKind {
	if (isTauri) return "other";
	if (origin === OFFICIAL_TOOL_ORIGIN) return "official";
	if ((LEGACY_TOOL_ORIGINS as readonly string[]).includes(origin))
		return "legacy";
	return "other";
}

export function isMigrationPath(pathname: string) {
	return pathname === "/migration/send" || pathname === "/migration/receive";
}

export function createMigrationNonce() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}
