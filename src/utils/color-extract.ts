export const COVER_ART_METADATA_KEYS = [
	"cover_art",
	"cover",
	"artwork",
	"albumart",
	"album_art",
	"albumarturl",
	"image",
	"musiccover",
	"music_cover",
	"coverart",
	"coverurl",
	"cover_url",
	"picture",
];

export function findMetadataCoverArt(
	metadata: { key: string; value: string[] }[],
): string | null {
	return (
		metadata
			.find((entry) => {
				const normalized = entry.key.toLowerCase().replace(/[-_]/g, "");
				return COVER_ART_METADATA_KEYS.some(
					(k) => k.replace(/[-_]/g, "") === normalized,
				);
			})
			?.value.find((value) => value.trim().length > 0)
			?.trim() ?? null
	);
}

const artworkCache = new Map<string, string | null>();

export async function resolveOnlineCoverArt(
	title: string,
	artist?: string,
	options?: {
		album?: string;
		ncmMusicId?: string;
		appleMusicId?: string;
	},
): Promise<string | null> {
	const cleanTitle = title.trim();
	const cleanArtist = (artist ?? "").trim();
	const cleanAlbum = (options?.album ?? "").trim();
	const cacheKey = `${options?.ncmMusicId || ""}:${options?.appleMusicId || ""}:${cleanArtist} - ${cleanAlbum} - ${cleanTitle}`.toLowerCase();

	if (artworkCache.has(cacheKey)) {
		return artworkCache.get(cacheKey) ?? null;
	}

	// 1. Try NetEase Music ID if available
	if (options?.ncmMusicId) {
		try {
			const res = await fetch(
				`https://music.163.com/api/song/detail/?id=${encodeURIComponent(options.ncmMusicId)}&ids=[${encodeURIComponent(options.ncmMusicId)}]`,
			);
			if (res.ok) {
				const json = (await res.json()) as {
					songs?: Array<{ album?: { picUrl?: string } }>;
				};
				const pic = json.songs?.[0]?.album?.picUrl;
				if (pic) {
					const securePic = pic.replace(/^http:\/\//i, "https://");
					artworkCache.set(cacheKey, securePic);
					return securePic;
				}
			}
		} catch {}
	}

	// 2. Try Apple Music ID if available
	if (options?.appleMusicId) {
		try {
			const res = await fetch(
				`https://itunes.apple.com/lookup?id=${encodeURIComponent(options.appleMusicId)}`,
			);
			if (res.ok) {
				const json = (await res.json()) as {
					results?: Array<{ artworkUrl100?: string }>;
				};
				const pic = json.results?.[0]?.artworkUrl100;
				if (pic) {
					const highRes = pic.replace("100x100bb", "512x512bb");
					artworkCache.set(cacheKey, highRes);
					return highRes;
				}
			}
		} catch {}
	}

	if (!cleanTitle) return null;

	// 3. Search iTunes by artist, title, and optional album
	try {
		const queryParts = [cleanArtist, cleanAlbum, cleanTitle].filter(Boolean);
		const query = queryParts.join(" ");
		const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
		const res = await fetch(url);
		if (res.ok) {
			const json = (await res.json()) as {
				resultCount?: number;
				results?: Array<{ artworkUrl100?: string }>;
			};
			if (json.results && json.results.length > 0 && json.results[0].artworkUrl100) {
				const highRes = json.results[0].artworkUrl100.replace(
					"100x100bb",
					"512x512bb",
				);
				artworkCache.set(cacheKey, highRes);
				return highRes;
			}
		}
	} catch {}

	// 4. Fallback search without album
	if (cleanAlbum) {
		try {
			const queryParts = [cleanArtist, cleanTitle].filter(Boolean);
			const query = queryParts.join(" ");
			const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
			const res = await fetch(url);
			if (res.ok) {
				const json = (await res.json()) as {
					resultCount?: number;
					results?: Array<{ artworkUrl100?: string }>;
				};
				if (json.results && json.results.length > 0 && json.results[0].artworkUrl100) {
					const highRes = json.results[0].artworkUrl100.replace(
						"100x100bb",
						"512x512bb",
					);
					artworkCache.set(cacheKey, highRes);
					return highRes;
				}
			}
		} catch {}
	}

	// 5. Try NetEase Search fallback
	try {
		const query = [cleanArtist, cleanTitle].filter(Boolean).join(" ");
		const res = await fetch(
			`https://music.163.com/api/search/get/web?csrf_token=&hlpretag=&hlposttag=&s=${encodeURIComponent(query)}&type=1&offset=0&total=true&limit=1`,
		);
		if (res.ok) {
			const json = (await res.json()) as {
				result?: {
					songs?: Array<{
						album?: { picUrl?: string };
						artists?: Array<{ picUrl?: string }>;
					}>;
				};
			};
			const song = json.result?.songs?.[0];
			const pic = song?.album?.picUrl || song?.artists?.[0]?.picUrl;
			if (pic) {
				const securePic = pic.replace(/^http:\/\//i, "https://");
				artworkCache.set(cacheKey, securePic);
				return securePic;
			}
		}
	} catch {}

	artworkCache.set(cacheKey, null);
	return null;
}

export async function extractDominantColor(
	imageSrc: string,
): Promise<string | null> {
	if (!imageSrc) return null;

	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";

		img.onload = () => {
			try {
				const canvas = document.createElement("canvas");
				const size = 32;
				canvas.width = size;
				canvas.height = size;
				const ctx = canvas.getContext("2d", { willReadFrequently: true });
				if (!ctx) {
					resolve(null);
					return;
				}

				ctx.drawImage(img, 0, 0, size, size);
				const imgData = ctx.getImageData(0, 0, size, size);
				const data = imgData.data;

				let bestR = 0;
				let bestG = 0;
				let bestB = 0;
				let maxScore = -1;

				let totalR = 0;
				let totalG = 0;
				let totalB = 0;
				let count = 0;

				for (let i = 0; i < data.length; i += 4) {
					const r = data[i];
					const g = data[i + 1];
					const b = data[i + 2];
					const a = data[i + 3];

					if (a < 128) continue;

					totalR += r;
					totalG += g;
					totalB += b;
					count++;

					const max = Math.max(r, g, b);
					const min = Math.min(r, g, b);
					const saturation = max === 0 ? 0 : (max - min) / max;
					const brightness = max / 255;

					if (brightness > 0.15 && brightness < 0.95 && saturation > 0.15) {
						const score = saturation * 2.5 + brightness;
						if (score > maxScore) {
							maxScore = score;
							bestR = r;
							bestG = g;
							bestB = b;
						}
					}
				}

				if (maxScore >= 0) {
					const hex = `#${((1 << 24) + (bestR << 16) + (bestG << 8) + bestB).toString(16).slice(1)}`;
					resolve(hex);
					return;
				}

				if (count > 0) {
					const avgR = Math.round(totalR / count);
					const avgG = Math.round(totalG / count);
					const avgB = Math.round(totalB / count);
					const hex = `#${((1 << 24) + (avgR << 16) + (avgG << 8) + avgB).toString(16).slice(1)}`;
					resolve(hex);
					return;
				}

				resolve(null);
			} catch {
				resolve(null);
			}
		};

		img.onerror = () => resolve(null);
		img.src = imageSrc;
	});
}
