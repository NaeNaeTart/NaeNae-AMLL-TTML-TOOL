import { MIGRATION_CHUNK_SIZE, MIGRATION_PROTOCOL_VERSION } from "./config";

export type MigrationCounts = {
	settings: number;
	keybindings: number;
	assets: boolean;
	projects: number;
	plugins: number;
};

type BaseMessage = {
	protocol: typeof MIGRATION_PROTOCOL_VERSION;
	nonce: string;
};

export type MigrationMessage =
	| (BaseMessage & { type: "receiver-ready" })
	| (BaseMessage & {
			type: "metadata";
			counts: MigrationCounts;
			totalChunks: number;
	  })
	| (BaseMessage & { type: "chunk"; index: number; data: ArrayBuffer })
	| (BaseMessage & { type: "chunk-ack"; index: number })
	| (BaseMessage & { type: "transfer-complete" })
	| (BaseMessage & { type: "migration-complete"; counts: MigrationCounts })
	| (BaseMessage & { type: "migration-error"; reason: string })
	| (BaseMessage & { type: "migration-cancelled" });

const isCounts = (value: unknown): value is MigrationCounts => {
	if (!value || typeof value !== "object") return false;
	const counts = value as Partial<MigrationCounts>;
	return (
		typeof counts.settings === "number" &&
		typeof counts.keybindings === "number" &&
		typeof counts.assets === "boolean" &&
		typeof counts.projects === "number" &&
		typeof counts.plugins === "number"
	);
};

export function isMigrationMessage(value: unknown): value is MigrationMessage {
	if (!value || typeof value !== "object") return false;
	const message = value as Partial<MigrationMessage>;
	if (
		message.protocol !== MIGRATION_PROTOCOL_VERSION ||
		typeof message.nonce !== "string" ||
		message.nonce.length !== 32 ||
		typeof message.type !== "string"
	)
		return false;

	switch (message.type) {
		case "receiver-ready":
		case "transfer-complete":
		case "migration-cancelled":
			return true;
		case "metadata":
			if (typeof message.totalChunks !== "number") return false;
			return (
				Number.isInteger(message.totalChunks) &&
				message.totalChunks > 0 &&
				message.totalChunks <= 2048 &&
				isCounts(message.counts)
			);
		case "chunk":
			if (typeof message.index !== "number") return false;
			return (
				Number.isInteger(message.index) &&
				message.index >= 0 &&
				message.data instanceof ArrayBuffer &&
				message.data.byteLength <= MIGRATION_CHUNK_SIZE
			);
		case "chunk-ack":
			if (typeof message.index !== "number") return false;
			return Number.isInteger(message.index) && message.index >= 0;
		case "migration-complete":
			return isCounts(message.counts);
		case "migration-error":
			return typeof message.reason === "string";
		default:
			return false;
	}
}

export function encodeMigrationPayload(value: unknown): ArrayBuffer[] {
	const encoded = new TextEncoder().encode(JSON.stringify(value));
	const chunks: ArrayBuffer[] = [];
	for (
		let offset = 0;
		offset < encoded.byteLength;
		offset += MIGRATION_CHUNK_SIZE
	) {
		chunks.push(encoded.slice(offset, offset + MIGRATION_CHUNK_SIZE).buffer);
	}
	return chunks.length > 0 ? chunks : [new ArrayBuffer(0)];
}

export function decodeMigrationPayload(chunks: ArrayBuffer[]): unknown {
	const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
	const joined = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		joined.set(new Uint8Array(chunk), offset);
		offset += chunk.byteLength;
	}
	return JSON.parse(new TextDecoder().decode(joined));
}
