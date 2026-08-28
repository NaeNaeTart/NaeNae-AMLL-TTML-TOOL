/**
 * Format of the lyrics payload for Unison
 */
export type UnisonLyricFormat = "ttml" | "lrc" | "text";

/**
 * Parameters for submitting lyrics to Unison
 */
export interface UnisonPublishParams {
	song: string;
	artist: string;
	album?: string;
	duration: number; // in seconds
	lyrics: string;
	format: UnisonLyricFormat;
	language?: string;
	videoId?: string; // YouTube video ID (e.g. dQw4w9WgXcQ)
	isrc?: string;
}

/**
 * Canonical payload signed by the client
 */
export interface UnisonSubmitPayload extends UnisonPublishParams {
	keyId: string;
	timestamp: number;
	nonce: string;
}

/**
 * Wire body sent to POST /lyrics/submit
 */
export interface UnisonSignedBody {
	payload: UnisonSubmitPayload;
	signature: string; // Base64 encoded IEEE P1363 signature (64 bytes)
	publicKey: JsonWebKey;
}

/**
 * Server response for lyrics submission
 */
export interface UnisonSubmitResponse {
	success: boolean;
	data?: {
		id: number;
		created: boolean;
	};
	error?: string;
	code?: string;
	hint?: string;
}

/**
 * Track information in Unison search / get response
 */
export interface UnisonTrack {
	id: number;
	videoId?: string;
	song: string;
	artist: string;
	album?: string;
	isrc?: string;
	duration: number;
	format: UnisonLyricFormat;
	language?: string;
	syncType?: "richsync" | "linesync" | "unsynced";
	score?: number;
	voteCount?: number;
	lyrics?: string;
	submitter?: {
		keyId: string;
		reputation?: number;
		displayName?: string;
	};
}

export interface UnisonSearchResponse {
	success: boolean;
	data?: UnisonTrack[];
	error?: string;
	code?: string;
	hint?: string;
}

export interface UnisonLyricsResponse {
	success: boolean;
	data?: UnisonTrack;
	error?: string;
	code?: string;
	hint?: string;
}

/**
 * Stored cryptographic identity keypair
 */
export interface UnisonIdentityKeyPair {
	keyId: string;
	publicKey: JsonWebKey;
	privateKey: JsonWebKey;
	createdAt: number;
	displayName?: string;
}
