/**
 * LRCLIB API 返回的单曲数据结构
 * @see https://lrclib.net/docs
 */
export interface LrcLibTrack {
	id: number;
	/**
	 * 歌曲名
	 * @note 文档说是 `trackName` 但实际上返回的是 `name`
	 */
	name: string;
	artistName: string;
	albumName: string;
	duration: number;
	instrumental: boolean;
	/**
	 * 纯文本歌词
	 */
	plainLyrics: string | null;
	/**
	 * LRC 歌词
	 */
	syncedLyrics: string | null;
	/**
	 * Lyricsfile (YAML 1.x) 歌词
	 */
	lyricsfile?: string | null;
}

export interface LrcLibChallengeResponse {
	prefix: string;
	target: string;
}

export interface LrcLibPublishParams {
	trackName: string;
	artistName: string;
	albumName?: string;
	duration?: number;
	plainLyrics?: string;
	syncedLyrics?: string;
	lyricsfile?: string;
}

