import { describe, expect, it } from "vitest";
import {
	hexToBytes,
	isDigestWithinTarget,
	solveChallenge,
	verifyChallengeToken,
} from "./challenge-solver";

describe("LRCLIB Challenge Solver", () => {
	it("converts hex strings to 32-byte Uint8Array correctly", () => {
		const bytes = hexToBytes("000000ff00000000000000000000000000000000000000000000000000000000");
		expect(bytes.length).toBe(32);
		expect(bytes[0]).toBe(0x00);
		expect(bytes[1]).toBe(0x00);
		expect(bytes[2]).toBe(0x00);
		expect(bytes[3]).toBe(0xff);
		expect(bytes[4]).toBe(0x00);
	});

	it("correctly compares digest vs target threshold", () => {
		const target = hexToBytes("000000ff00000000000000000000000000000000000000000000000000000000");
		const smaller = hexToBytes("0000001000000000000000000000000000000000000000000000000000000000");
		const exact = hexToBytes("000000ff00000000000000000000000000000000000000000000000000000000");
		const larger = hexToBytes("0000010000000000000000000000000000000000000000000000000000000000");

		expect(isDigestWithinTarget(smaller, target)).toBe(true);
		expect(isDigestWithinTarget(exact, target)).toBe(true);
		expect(isDigestWithinTarget(larger, target)).toBe(false);
	});

	it("solves a fast test challenge and verifies the solution token", async () => {
		// Easy target for test speed: starts with 0x0F... (1 in 16 nonces)
		const prefix = "test_prefix_12345";
		const target = "0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

		let progressCount = 0;
		const token = await solveChallenge(prefix, target, {
			batchSize: 50,
			onProgress: () => {
				progressCount++;
			},
		});

		expect(token.startsWith(`${prefix}:`)).toBe(true);
		const nonceStr = token.split(":")[1];
		const nonce = Number.parseInt(nonceStr, 10);
		expect(Number.isNaN(nonce)).toBe(false);

		const isValid = await verifyChallengeToken(prefix, nonce, target);
		expect(isValid).toBe(true);
	});

	it("solves a moderate difficulty challenge quickly", async () => {
		// Target with 4 leading hex zeros (1 in 65536)
		const prefix = "test_moderate_prefix";
		const target = "0000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

		const token = await solveChallenge(prefix, target, {
			batchSize: 5000,
		});

		expect(token.startsWith(`${prefix}:`)).toBe(true);
		const nonceStr = token.split(":")[1];
		const nonce = Number.parseInt(nonceStr, 10);
		expect(Number.isNaN(nonce)).toBe(false);

		const isValid = await verifyChallengeToken(prefix, nonce, target);
		expect(isValid).toBe(true);
	});

	it("aborts when AbortSignal is triggered", async () => {
		const controller = new AbortController();
		const prefix = "test_abort";
		// Impossible target to force looping
		const target = "0000000000000000000000000000000000000000000000000000000000000001";

		setTimeout(() => {
			controller.abort();
		}, 15);

		await expect(
			solveChallenge(prefix, target, {
				batchSize: 20,
				signal: controller.signal,
			}),
		).rejects.toThrow("Challenge solving aborted");
	});
});
