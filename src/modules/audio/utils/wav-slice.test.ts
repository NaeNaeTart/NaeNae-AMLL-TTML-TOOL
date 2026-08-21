import { describe, expect, it } from "vitest";
import { bufferSliceToWav } from "./wav-slice";

describe("bufferSliceToWav", () => {
	it("encodes only the requested samples as 16-bit PCM", async () => {
		const buffer = {
			sampleRate: 2,
			numberOfChannels: 1,
			length: 4,
			getChannelData: () => new Float32Array([-1, -0.5, 0.5, 1]),
		} as unknown as AudioBuffer;

		const wav = new DataView(
			await bufferSliceToWav(buffer, 0.5, 1.5).arrayBuffer(),
		);

		expect(wav.getUint32(0, false)).toBe(0x52494646);
		expect(wav.getUint32(8, false)).toBe(0x57415645);
		expect(wav.getUint32(40, true)).toBe(4);
		expect(wav.getInt16(44, true)).toBe(-16_384);
		expect(wav.getInt16(46, true)).toBe(16_383);
	});
});
