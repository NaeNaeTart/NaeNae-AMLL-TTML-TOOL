import { 
    LyricPlayer, 
    BackgroundRender,
    MeshGradientRenderer,
} from "@applemusic-like-lyrics/react";
import { useAtomValue } from "jotai";
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { audioEngine } from "$/modules/audio/audio-engine";
import { 
	accentColorAtom, 
	useCustomAccentAtom, 
	customAccentColorAtom 
} from "$/modules/settings/states/index.ts";
import { audioPlayingAtom } from "$/modules/audio/states/index.ts";
import { isDarkThemeAtom, lyricLinesAtom } from "$/states/main.ts";
import { customBackgroundImageAtom } from "$/modules/settings/modals/customBackground";
import styles from "./AMLL.module.css";
import classNames from "classnames";

/**
 * @description The high-performance AMLL player utilizing the local rendering engine.
 * Features: Mesh Warp background, Optimized CSS culling, and Fluid typography.
 */
export const AMLL = memo(() => {
	const { t } = useTranslation();
	const lyrics = useAtomValue(lyricLinesAtom);
	const darkMode = useAtomValue(isDarkThemeAtom);
	const albumImg = useAtomValue(customBackgroundImageAtom);
	const isPlaying = useAtomValue(audioPlayingAtom);
	const accentColor = useAtomValue(accentColorAtom);

	const amllLines = useMemo(() => {
        return (lyrics?.lyricLines as any) || [];
    }, [lyrics]);

	const useCustomAccent = useAtomValue(useCustomAccentAtom);
	const customAccentColor = useAtomValue(customAccentColorAtom);
	const [currentTime, setCurrentTime] = useState(0);

	useEffect(() => {
		let rafId = 0;
		let lastAudioTime = audioEngine.musicCurrentTime;
		let interpolatedTime = lastAudioTime;
		let lastRealTime = performance.now();

		const loop = () => {
			const now = performance.now();
			const audioTime = audioEngine.musicCurrentTime;
			const playing = audioEngine.musicPlaying;

			if (!playing) {
				setCurrentTime(audioTime * 1000);
				lastAudioTime = audioTime;
				interpolatedTime = audioTime;
				lastRealTime = now;
			} else {
				if (audioTime !== lastAudioTime) {
					interpolatedTime = audioTime;
					lastAudioTime = audioTime;
				} else {
					const dt = (now - lastRealTime) / 1000;
					interpolatedTime += dt * audioEngine.musicPlayBackRate;
				}
				lastRealTime = now;
				setCurrentTime(interpolatedTime * 1000);
			}

			rafId = requestAnimationFrame(loop);
		};

		rafId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafId);
	}, []);

	const fallbackColors = useMemo(() => {
		if (useCustomAccent && customAccentColor) {
			return [customAccentColor, "#121212", "#000000"];
		}
		return ["#f97316", "#8b5cf6", "#000000"];
	}, [useCustomAccent, customAccentColor, accentColor]);

	return (
		<div className={classNames(styles.amllContainer, darkMode && styles.isDark)}>
            {/* Fluid Background Layer */}
            <div className={styles.bgLayer}>
                <BackgroundRender 
					key={albumImg || "default"}
                    album={albumImg || undefined}
					colors={fallbackColors}
                    playing={isPlaying}
                    fps={60}
                    renderScale={0.7}
                    renderer={MeshGradientRenderer}
                />
            </div>

            {/* Lyrics Content Layer */}
            <div className={styles.lyricsLayer}>
                {amllLines.length > 0 ? (
                    <LyricPlayer
                        lyricLines={amllLines}
                        currentTime={currentTime}
                        className="amll-player-instance"
                        enableSpring={false}
                        enableBlur={false}
                        enableScale={true}
                        playing={isPlaying}
                    />
                ) : (
					<div className={styles.noLyrics}>{t("amll.noLyrics", "No lyrics available in store")}</div>
                )}
            </div>
		</div>
	);
});

export default AMLL;
