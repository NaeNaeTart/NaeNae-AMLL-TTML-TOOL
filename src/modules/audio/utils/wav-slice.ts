export function bufferSliceToWav(
	buffer: AudioBuffer,
	startSec: number,
	endSec: number,
): Blob {
	const sampleRate = buffer.sampleRate;
	const numChannels = buffer.numberOfChannels;
	const startSample = Math.max(0, Math.floor(startSec * sampleRate));
	const endSample = Math.min(buffer.length, Math.ceil(endSec * sampleRate));
	const length = Math.max(0, endSample - startSample);
	const bytesPerSample = 2;
	const blockAlign = numChannels * bytesPerSample;
	const dataSize = length * blockAlign;
	const arrayBuffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(arrayBuffer);

	view.setUint32(0, 0x52494646, false); // RIFF
	view.setUint32(4, 36 + dataSize, true);
	view.setUint32(8, 0x57415645, false); // WAVE
	view.setUint32(12, 0x666d7420, false); // fmt
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * blockAlign, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, 16, true);
	view.setUint32(36, 0x64617461, false); // data
	view.setUint32(40, dataSize, true);

	const channels = Array.from({ length: numChannels }, (_, channel) =>
		buffer.getChannelData(channel),
	);
	let offset = 44;
	for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex++) {
		for (const channel of channels) {
			const sample = Math.max(-1, Math.min(1, channel[sampleIndex]));
			view.setInt16(
				offset,
				sample < 0 ? sample * 0x8000 : sample * 0x7fff,
				true,
			);
			offset += bytesPerSample;
		}
	}

	return new Blob([arrayBuffer], { type: "audio/wav" });
}
