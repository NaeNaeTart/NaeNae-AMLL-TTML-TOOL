export interface SpotifyArtist {
	id: string;
	name: string;
}

export interface SpotifyAlbum {
	id: string;
	name: string;
	images?: { url: string; height?: number; width?: number }[];
	release_date?: string;
}

export interface SpotifyTrack {
	id: string;
	name: string;
	artists: SpotifyArtist[];
	album?: SpotifyAlbum;
	duration_ms: number;
	external_urls?: {
		spotify?: string;
	};
	isrc?: string;
}

export interface SpotMatchCandidate {
	track_id: string;
	title: string;
	artists: string;
	album: string;
	cover_url?: string;
	duration_ms: number;
	score: number;
	duration_delta_ms: number;
	spotify_url?: string;
}

export type SpotMatchPresetKey =
	| "Quick"
	| "Balanced"
	| "Deep"
	| "Exhaustive"
	| (string & {});

export interface SpotMatchOptions {
	preset: SpotMatchPresetKey;
	minimum_score: number; // e.g. 60
	maximum_duration_seconds: number; // e.g. 10
	exact_title: boolean;
	search_pages: number; // 1-20
	search_repeats: number; // 1-3
	releases_per_artist: number;
	global_albums: number;
	global_playlists: number;
	tracks_per_playlist: number;
	minimum_title_similarity: number; // e.g. 58
	variant_queries: boolean;
}

export interface SpotifyTokenResponse {
	accessToken: string;
	accessTokenExpirationTimestampMs: number;
	isAnonymous: boolean;
	clientId: string;
}
