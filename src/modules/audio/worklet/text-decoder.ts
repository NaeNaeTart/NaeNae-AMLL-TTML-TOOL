/** wasm-bindgen decodes error messages in AudioWorkletGlobalScope, which lacks TextDecoder. */
if (typeof globalThis.TextDecoder === "undefined") {
	class WorkletTextDecoder {
		decode(bytes?: Uint8Array) {
			if (!bytes) return "";
			let encoded = "";
			for (const byte of bytes)
				encoded += `%${byte.toString(16).padStart(2, "0")}`;
			return decodeURIComponent(encoded);
		}
	}
	Object.defineProperty(globalThis, "TextDecoder", {
		value: WorkletTextDecoder,
	});
}
