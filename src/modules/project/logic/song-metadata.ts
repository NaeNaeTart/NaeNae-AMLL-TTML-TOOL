import type { TTMLMetadata } from "$/types/ttml";

export interface SongMetadata {
	title?: string;
	artist?: string;
	album?: string;
	isrc?: string;
	cover?: string;
}

/** Decoder tag names vary by container; keep that detail out of the UI. */
export const songMetadataFromTags = (
	tags: Record<string, string>,
): SongMetadata => {
	const normalized = new Map(
		Object.entries(tags).map(([key, value]) => [
			key.toLowerCase(),
			value.trim(),
		]),
	);
	const read = (...keys: string[]) =>
		keys.map((key) => normalized.get(key)).find((value) => value);
	return {
		title: read("title", "tit2"),
		artist: read("artist", "artists", "tpe1", "album_artist", "albumartist"),
		album: read("album", "talb"),
		isrc: read("isrc", "tsrc"),
	};
};

/** Fill blanks only, including blank placeholder rows in the metadata editor. */
export const fillEmptySongMetadata = (
	metadata: TTMLMetadata[],
	song: SongMetadata,
) => {
	let changed = false;
	for (const [key, value] of [
		["musicName", song.title],
		["artists", song.artist],
		["album", song.album],
		["isrc", song.isrc],
		["cover_art", song.cover],
	]) {
		if (!key || !value?.trim()) continue;
		const entries = metadata.filter((entry) => entry.key === key);
		if (entries.some((entry) => entry.value.some((item) => item.trim())))
			continue;
		const values = [value.trim()];
		if (entries[0]) entries[0].value = values;
		else metadata.push({ key, value: values });
		changed = true;
	}
	return changed;
};

export const getAudioSearchQuery = (song: SongMetadata, fileName: string) =>
	[song.artist, song.title].filter((value) => value?.trim()).join(" - ") ||
	fileName.replace(/\.[^.]+$/, "");

export const getImportFileName = (current: string, song: SongMetadata) => {
	if (
		!/^(?:lyric|untitled)(?:\.ttml)?$/i.test(current.trim()) &&
		current.trim()
	)
		return current;
	const name = [song.artist, song.title]
		.filter((value) => value?.trim())
		.join(" - ");
	return name ? `${name.replace(/[/\\?%*:|"<>]/g, "-").trim()}.ttml` : current;
};
