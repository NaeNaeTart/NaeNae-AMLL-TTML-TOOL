<div align=center>

<img src="./public/logo.svg" align="center" width="256">

# NaeNae's Apple Music-like Lyrics TTML Tool Fork

A feature-rich, high-performance word-by-word lyrics editor designed for the [Spicy Lyrics ecosystem](https://spicylyrics.org/) and modern lyrics synchronization workflows.

<img width="1312" alt="image" src="https://github.com/user-attachments/assets/4db81b29-df0c-4f6e-819a-3b956b28247c">
<img width="1312" alt="image" src="https://github.com/user-attachments/assets/929eefee-ebda-43db-ad04-c0f099077053">
<img width="1312" alt="image" src="https://github.com/user-attachments/assets/7c80902e-45a9-42ae-b980-f5500069acb8">

[![Crowdin](https://badges.crowdin.net/very-cool-ttml-tool/localized.svg)](https://crowdin.com/project/very-cool-ttml-tool)

</div>

---

## 🚀 Usage

> [!WARNING]
> This tool is designed for desktop screens and is not recommended for mobile phones or small displays.

- **Online Web App**: [https://nae-nae-amll-ttml-tool.vercel.app/](https://nae-nae-amll-ttml-tool.vercel.app/)
- **Desktop Application (Tauri v2)**: Built for Windows, macOS, and Linux. See the [Latest Release](https://github.com/olafix52/NaeNae-AMLL-TTML-TOOL/releases/latest) or [Upstream Releases](https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/releases/latest).
- **Arch Linux**: An official `PKGBUILD` is available under [`packaging/archlinux/PKGBUILD`](./packaging/archlinux/PKGBUILD) for building native Arch packages.

---

## ✨ Features & Enhancements in this Fork

### 📄 Lyricsfile (YAML 1.x) Processing & Conversion
- **Full YAML Specification Support** — Native parser and writer for Lyricsfile versions 1.0 and 1.1 with second-precision timestamps and structural metadata.
- **Bi-Directional Converter** — Convert seamlessly between Apple Music TTML and Lyricsfile YAML formats via the integrated Converter Dialog under *Tools → Lyricsfile (YAML) Converter*.
- **Vocalist Role Taxonomy** — Support for rich vocal roles (*Lead, Background, Duet, Unison, Choir, Backup, etc.*) with visual role badges in the editor and dedicated toolbar toggle controls.

### 🌐 High-Speed LRCLIB Publisher
- **One-Click LRCLIB Publishing** — Submit your synchronized lyrics directly to the public [LRCLIB](https://lrclib.net/) database from *File → Publish to LRCLIB...* or the Export menu.
- **Multi-Core Proof-of-Work Solver** — Sub-second challenge solving powered by multi-threaded Web Workers (`navigator.hardwareConcurrency`, up to 16 CPU threads) and hand-optimized 32-bit SHA-256 routines computing **15M–30M hashes/sec**.
- **Multi-Format Publishing** — Simultaneously publish Lyricsfile YAML, Synced LRC, and Plain Text with live tabbed payload previews and verification warnings.
- **Proxy Support** — Integrated local dev proxy to eliminate browser CORS preflight restrictions on publish requests.

### 🔍 SpotMatch — Spotify Alternate Track Finder
- **Alternate ID Discovery** — Deep search scanner for finding alternative Spotify track IDs, country-specific releases, and remastered editions.
- **Preset Search Profiles** — Choose from 5 tailored matching profiles (*Quick, Balanced, Deep, Exhaustive, Custom*) with configurable artist discography scans and album searches.
- **Direct Metadata Application** — Apply discovered metadata with one click, copy Spicy Lyrics track IDs, or export results as text files.
- **Background Execution** — Run long searches non-blockingly in the background with a floating minimize status widget.

### 🎵 Audio Engine & Spectrogram Precision
- **In-Memory WAV Auditioning** — Glitch-free, instant playback when auditioning individual words and syllables directly from the spectrogram timeline.
- **Integrated Audio Bridge** — Built-in FFmpeg.wasm MP3-to-FLAC conversion to eliminate browser audio decoding drift.
- **Millisecond Precision & Snap to Playhead** — High-resolution performance markers for frame-accurate timing and one-click playhead synchronization.

### ✂️ Smarter Syllabification & Multi-Language Support
- **11+ Dedicated Language Engines** — Syllabification support for English, Polish, Spanish, French, German, Indonesian, Italian, Portuguese, Russian, Japanese, and CJK lyrics.
- **Learned Word Splits** — Automatically remembers manual syllable cut boundaries and applies them to future occurrences of the same word.
- **Contextual Multilingual Romanization** — Automatic Japanese (Kana/Romaji), Mandarin (tone-aware Pinyin), and Korean (Hangul) romanization with per-word readings.

### 🔥 Spicy Lyrics & Toxi Rendering Engine
- **High-Fidelity Preview** — Spicy Lyrics renderer with animated mesh gradients, cover-art backgrounds, karaoke layout, Simple Lyrics view, and FPS counter.
- **Toxi Lyrics Animations** — Smooth jump-down line transitions, instant-on bloom with natural fade-out, adjustable wipe softness, and 144Hz+ display interpolation.
- **Bouncy Word Indicator** — Long-duration syllables in Sync mode display a bouncy rhythm dot for held notes.

### 🛠️ Workflow & Productivity
- **Guided Beginner Workflow** — Step-by-step onboarding tutorial using your own music files.
- **TTML Checklist** — Persistent local synchronization queue with progress tracking and history.
- **Time Stretch Tool** — Scale every TTML timestamp proportionally to match different audio durations.
- **Combine Words Across Lyrics** — Batch combine identical word sequences across the whole project with punctuation and case-sensitivity controls.
- **Section Categorization** — Preserve and color-code Genius headers (`[Verse]`, `[Chorus]`, `[Bridge]`) with section-wide timing tools.
- **Portable Backup & Restore** — Export and restore settings, keybindings, appearance themes, projects, and plugin states.

### 🎨 UI/UX & Performance Optimizations
- **Native Interface Scaling** — Adjustable UI Scale settings for high-DPI displays.
- **Startup Optimization** — Lazy-loaded NLP and syllabification libraries to minimize initial bundle loading time and RAM usage.
- **Persistent Viewport** — Retains scroll position and active line when switching between Sync, Time, and Edit modes.
- **Discord Rich Presence & PreMiD Bridge** — Live playback and editing status broadcasting to Discord and PreMiD.

---

## 🛠️ Building from Source

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) (`corepack enable && corepack prepare pnpm@latest --activate`)
- [Rust & Cargo](https://rustup.rs/) (for Tauri desktop builds)

### Web Development
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run unit tests
pnpm test

# Build production web bundle
pnpm build
```

### Desktop App (Tauri v2)
```bash
# Run desktop app in development
pnpm tauri dev

# Build desktop application binaries
pnpm tauri build
```

### Arch Linux (PKGBUILD)
```bash
cd packaging/archlinux
makepkg -si
```

---

## 👥 Contributors & Acknowledgements

This fork builds upon the incredible work of the AMLL community and the Spicy Lyrics team. Heartfelt thanks to all the authors, maintainers, and contributors:

### 🌟 Fork Maintainers & Key Contributors
- **[olafix52](https://github.com/olafix52)** — Lyricsfile (YAML) integration, LRCLIB publisher & multi-core PoW solver, SpotMatch tool, Polish syllabification, spectrogram audition fixes, Arch Linux packaging, and performance optimizations.
- **[NaeNae / NaeNaeTart](https://github.com/NaeNaeTart)** — Creator of NaeNae's AMLL TTML Tool Fork, Spicy Lyrics ecosystem integration, Discord presence, UI redesign, and Toxi animations.
- **[VictorGugug](https://github.com/VictorGugug)** — Lyricsfile specifications, parser algorithms, and YAML converter contributions.
- **[Miles Chase (bobjoerules)](https://github.com/bobjoerules)** — CI/CD workflows, build stabilization, and repository maintenance.

### 🏛️ Original AMLL TTML Tool Authors
- **[Steve-xmh (SteveXMH)](https://github.com/Steve-xmh)** — Creator of the original Apple Music-like Lyrics TTML Tool.
- **[Linho](https://github.com/linho1219)** — Core developer, audio processing, and performance optimizations.
- **[Miaoyww](https://github.com/Miaoyww)** — UI/UX and core features.
- **[碳烤八爪鱼 (ranhengzhang)](https://github.com/ranhengzhang)** — Core developer and algorithms.
- **[Xionghaizi001](https://github.com/Xionghaizi001)** — Developer and localization.
- **[XY Wang](https://github.com/wxy11787)** — Developer.

### 🤝 Community, Feature & Localization Contributors
- **[Arimodu](https://github.com/Arimodu)** — PreMiD bridge & integrations
- **[apoint123](https://github.com/apoint123)** — Feature and bugfix contributions
- **[Arashii (Stormanzanii)](https://github.com/Stormanzanii)** — Localization and testing
- **[Bajekek](https://github.com/BajekekButLost)** — Localization and testing
- **[ITMan_CHINA](https://github.com/ITManCHINA)** — Translations and bugfixes
- **[Keenan Yafiq](https://github.com/accbruh0)** — Translations and feedback
- **[Krash/2073](https://github.com/tsavpyn)** — Localization and features
- **[lastforathousandyears](https://github.com/lastForAThousandYears)** — Translations
- **[Ramadnintya](https://github.com/Ramadani1t)** — Translations and testing
- **[ShellWen](https://github.com/ShellWen)** — Core dependencies and infrastructure
- **[Super12138](https://github.com/Super12138)** — Translations
- **[TheX24 (TX24)](https://github.com/TheX24)** — Feature enhancements
- **[tiger shark (remiuku)](https://github.com/remiuku)** — Testing and feedback
- **喵锵** — Translations

---

## 📜 License

This project is licensed under the [GPL-3.0 License](./LICENSE). All contributions are subject to the same license.

