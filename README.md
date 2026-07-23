<div align=center>

<img src="./public/logo.svg" align="center" width="256">

# NaeNae's Apple Music-like Lyrics TTML Tool Fork

A fork of the word-by-word lyrics editor designed specifically for the [Spicy Lyrics ecosystem](https://spicylyrics.org/).

<img width="1312" alt="image" src="https://github.com/user-attachments/assets/4db81b29-df0c-4f6e-819a-3b956b28247c">
<img width="1312" alt="image" src="https://github.com/user-attachments/assets/929eefee-ebda-43db-ad04-c0f099077053">
<img width="1312" alt="image" src="https://github.com/user-attachments/assets/7c80902e-45a9-42ae-b980-f5500069acb8">

[![Crowdin](https://badges.crowdin.net/very-cool-ttml-tool/localized.svg)](https://crowdin.com/project/very-cool-ttml-tool)

</div>

## Usage

> [!WARNING]
> This tool is not recommended for mobile phones or small screens, as the operation can be very cumbersome.

You can use the online version of this tool by visiting [`https://verycool-ttml-tool-trust.vercel.app/`](https://verycool-ttml-tool-trust.vercel.app/).

You can also use the Tauri desktop version built via GitHub Actions; see [GitHub Action Build Tauri Desktop Version](https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/actions/workflows/build-desktop.yaml) for details.

## New Editor Features over the Original AMLL TTML Tool

- **Spicy Lyrics Preview** — A high-fidelity Spicy Lyrics renderer with animated, custom, and cover-art backgrounds; karaoke, Simple Lyrics, and line-synced layouts; automatic scrolling; and an optional FPS counter.
- **Time Stretch** — Scale every TTML timestamp to fit a new song duration, with support for reading durations from audio files.
- **Unified Lyrics Import** — Text, LRCLIB, Lyrically, and Genius imports share one consistent preparation, replacement-confirmation, and formatting workflow.
- **Genius Header Categorization & Section Tools** — Preserve headers such as `[Chorus]` and `[Verse]` as color-coded section metadata, with whole-section timing controls.
- **Backup & Restore** — Export and restore selected settings, keybindings, appearance assets, projects and history, and plugins in a portable backup file.
- **Bouncy Word Indicator** — Long-duration syllables in Sync mode get a subtle bouncing dot, making held words easier to spot while timing.
- **Toxi Lyrics Engine** — High-fidelity jump-down animations, instant-on bloom with smooth fade-out, and adjustable wipe softness.
- **144Hz+ Rendering** — A dedicated interpolation engine for ultra-high refresh rates that bypasses React bottlenecks.
- **Millisecond Precision Sync** — Interpolated high-resolution performance markers for frame-accurate timing.
- **Cinematic Backgrounds** — Hardware-accelerated Mesh Gradient backgrounds running at 60 FPS.
- **Snap to Playhead** — One-click synchronization that snaps lyric start times directly to the audio playhead position.
- **Auto-Lyric Sanitizer** — Automatically strips Genius tags and cleans empty lines on import.
- **Advanced Phonetics** — Professional mora-aware Japanese romanization and capsule distribution.
- **Pre-Export Validator** — Checks for untimed or overlapping lyrics before saving.
- **Integrated Audio Bridge** — Built-in FFmpeg.wasm MP3-to-FLAC conversion to reduce decoding drift.
- **Appearance Editor** — More than 40 visual parameters and theme presets for customizing the editor.
- **Global Localization** — Full i18n support with community-driven translations.
- **Community Plugin Store** — Browse and install community-made WASM importers and exporters.

## Contribution

All active code and translation contributions are welcome! We also welcome bug reports and suggestions! See [CONTRIBUTING.md](./CONTRIBUTING.md).

If you want to provide a new language translation, please refer to [`./src/i18n/index.ts`](./src/i18n/index.ts) and [`./locales/zh-CN/translation.json`](./locales/zh-CN/translation.json)!
