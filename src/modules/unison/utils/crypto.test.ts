import { describe, expect, it } from "vitest";
import {
	canonicalJson,
	computeKeyId,
	generateUnisonKeypair,
	signUnisonPayload,
} from "./crypto";

describe("Unison Cryptography Utilities", () => {
	it("canonicalJson sorts keys lexicographically", () => {
		const obj1 = { b: 2, a: 1, c: { y: 20, x: 10 } };
		const obj2 = { a: 1, c: { x: 10, y: 20 }, b: 2 };

		expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
		expect(canonicalJson(obj1)).toBe('{"a":1,"b":2,"c":{"x":10,"y":20}}');
	});

	it("generates valid ECDSA P-256 keypair and computes deterministic keyId", async () => {
		const identity = await generateUnisonKeypair("Test User");
		expect(identity.keyId).toHaveLength(64); // 256-bit hex hash
		expect(identity.publicKey.kty).toBe("EC");
		expect(identity.publicKey.crv).toBe("P-256");
		expect(identity.privateKey.kty).toBe("EC");

		const recomputedKeyId = await computeKeyId(identity.publicKey);
		expect(recomputedKeyId).toBe(identity.keyId);
	});

	it("signs payload and creates valid signed wire body with base64 signature", async () => {
		const identity = await generateUnisonKeypair();
		const payload = {
			keyId: identity.keyId,
			timestamp: Date.now(),
			nonce: "test-nonce-1234",
			song: "Song Name",
			artist: "Artist Name",
			duration: 180,
			lyrics: "Test lyrics line",
			format: "text" as const,
		};

		const signed = await signUnisonPayload(payload, identity);
		expect(signed.payload).toEqual(payload);
		expect(signed.signature).toBeTruthy();
		expect(signed.publicKey).toEqual(identity.publicKey);

		// Verify signature using WebCrypto verify
		const publicKey = await crypto.subtle.importKey(
			"jwk",
			identity.publicKey,
			{ name: "ECDSA", namedCurve: "P-256" },
			false,
			["verify"],
		);

		const canonicalStr = canonicalJson(payload);
		const rawSig = Uint8Array.from(atob(signed.signature), (c) =>
			c.charCodeAt(0),
		);

		const isValid = await crypto.subtle.verify(
			{ name: "ECDSA", hash: { name: "SHA-256" } },
			publicKey,
			rawSig,
			new TextEncoder().encode(canonicalStr),
		);

		expect(isValid).toBe(true);
	});
});
