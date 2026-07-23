/**
 * @description 将 Blob 编码为纯 base64 字符串（不含 data-URL 前缀）。
 * 使用 FileReader 以避免 `btoa` 在大文件上的调用栈限制。
 */
export function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			if (typeof result !== "string") {
				reject(new Error("Unexpected FileReader result"));
				return;
			}
			const commaIndex = result.indexOf(",");
			resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

/**
 * @description 将纯 base64 字符串解码为指定 MIME 类型的 Blob。
 */
export function base64ToBlob(base64: string, mime: string): Blob {
	const binary = atob(base64);
	const length = binary.length;
	const bytes = new Uint8Array(length);
	for (let i = 0; i < length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new Blob([bytes], { type: mime });
}
