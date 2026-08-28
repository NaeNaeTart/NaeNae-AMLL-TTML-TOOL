import type {
	UnisonIdentityKeyPair,
	UnisonSignedBody,
	UnisonSubmitPayload,
} from "../types";

const UNISON_IDENTITY_STORAGE_KEY = "unison_identity_keypair";

/**
 * Recursive canonical JSON stringifier with lexicographically sorted keys.
 * Required for deterministic signature verification on the Unison server.
 */
export function canonicalJson(obj: unknown): string {
	if (obj === null || typeof obj !== "object") {
		return JSON.stringify(obj);
	}
	if (Array.isArray(obj)) {
		return `[${obj.map(canonicalJson).join(",")}]`;
	}
	const keys = Object.keys(obj as Record<string, unknown>).sort();
	return `{${keys
		.map(
			(k) =>
				`${JSON.stringify(k)}:${canonicalJson(
					(obj as Record<string, unknown>)[k],
				)}`,
		)
		.join(",")}}`;
}

/**
 * Computes RFC 7638 JWK Thumbprint (SHA-256 hex string) for an ECDSA P-256 public key.
 */
export async function computeKeyId(jwkPublic: JsonWebKey): Promise<string> {
	const canonicalJwk = JSON.stringify({
		crv: jwkPublic.crv,
		kty: jwkPublic.kty,
		x: jwkPublic.x,
		y: jwkPublic.y,
	});

	const encoder = new TextEncoder();
	const data = encoder.encode(canonicalJwk);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Converts an ArrayBuffer to a Base64 string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Generates a fresh ECDSA P-256 cryptographic identity keypair.
 */
export async function generateUnisonKeypair(
	displayName?: string,
): Promise<UnisonIdentityKeyPair> {
	const keyPair = await crypto.subtle.generateKey(
		{
			name: "ECDSA",
			namedCurve: "P-256",
		},
		true,
		["sign", "verify"],
	);

	const jwkPublic = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
	const jwkPrivate = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

	const keyId = await computeKeyId(jwkPublic);

	return {
		keyId,
		publicKey: jwkPublic,
		privateKey: jwkPrivate,
		createdAt: Date.now(),
		displayName,
	};
}

/**
 * Retrieves the stored Unison identity keypair, or creates and saves a new one if none exists.
 */
export async function getOrCreateUnisonIdentity(): Promise<UnisonIdentityKeyPair> {
	if (typeof window !== "undefined" && window.localStorage) {
		try {
			const saved = localStorage.getItem(UNISON_IDENTITY_STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved) as UnisonIdentityKeyPair;
				if (parsed.keyId && parsed.publicKey && parsed.privateKey) {
					return parsed;
				}
			}
		} catch (e) {
			console.warn("Failed to load Unison identity from localStorage:", e);
		}
	}

	const newIdentity = await generateUnisonKeypair();
	saveUnisonIdentity(newIdentity);
	return newIdentity;
}

/**
 * Saves a Unison identity keypair to localStorage.
 */
export function saveUnisonIdentity(identity: UnisonIdentityKeyPair): void {
	if (typeof window !== "undefined" && window.localStorage) {
		try {
			localStorage.setItem(
				UNISON_IDENTITY_STORAGE_KEY,
				JSON.stringify(identity),
			);
		} catch (e) {
			console.warn("Failed to save Unison identity to localStorage:", e);
		}
	}
}

/**
 * Signs a Unison submission payload with the provided private key, returning the full signed wire body.
 */
export async function signUnisonPayload(
	payload: UnisonSubmitPayload,
	identity: UnisonIdentityKeyPair,
): Promise<UnisonSignedBody> {
	const privateKey = await crypto.subtle.importKey(
		"jwk",
		identity.privateKey,
		{
			name: "ECDSA",
			namedCurve: "P-256",
		},
		false,
		["sign"],
	);

	const canonicalStr = canonicalJson(payload);
	const encoder = new TextEncoder();
	const data = encoder.encode(canonicalStr);

	const signatureBuffer = await crypto.subtle.sign(
		{
			name: "ECDSA",
			hash: { name: "SHA-256" },
		},
		privateKey,
		data,
	);

	const signature = arrayBufferToBase64(signatureBuffer);

	return {
		payload,
		signature,
		publicKey: identity.publicKey,
	};
}
