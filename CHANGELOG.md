# Changelog

All notable changes to the AMLL TTML Tool are documented here.

## [0.6.0] - 2026-07-21

### ✨ New Features

- **Spicy Lyrics Preview Mode**: Added a high-fidelity Spicy Lyrics renderer with its dedicated SF Pro-derived font; animated/custom/cover-art backgrounds; karaoke, Simple Lyrics, and line-synced rendering; interlude dots; RTL and duet-aware layout; CJK/romanized word wrapping; automatic scrolling; and an optional FPS counter.
- **Timing Stretch**: Added a TTML timing-stretch tool that can import audio duration and scale lyric timing to match it.
- **Unified Lyrics Import**: Consolidated text, LRCLIB, Lyrically, and Genius imports behind one workflow with shared lyric preparation, replacement confirmation, and consistent handling of punctuation, CJK/Latin boundaries, word separators, and background vocals.
- **Genius Sections & Credits**: Restored Genius section headers as editor metadata, added automatic header restoration/categorization, improved section-wide timing actions, and resolve songwriter credits to real names by default.
- **Advanced Appearance**: Added Genius header color customization with presets and theme-accent fallback.

### 🐛 Bug Fixes

- **Preview Layout**: Fixed the Time-mode preview pane being pushed off-screen after its contents loaded, and hide the side preview pane when the full Preview screen is active.
- **Genius Import**: Switched Genius fetching to its CORS-enabled embed endpoint, fixed header categorization, and cleaned up parsed newlines and import-dialog crashes.

### 🛠️ Maintenance & Infrastructure

- **Tauri CI**: Repaired the GitHub Actions build key configuration.

---

6:
7: ## [0.5.0] - 2026-05-01
8:
9: ### ✨ New Features
10:
11: - **Snap to Playhead**: Added a new "Snap to Playhead" tool in the Time Shift toolbar. This allows for instant synchronization by moving the start of affected lyric lines to the current audio playback position with a single click.
12: - **Enhanced Lyric Line Context Menu**: Added a "Move line to playhead" action to the right-click menu, providing a quick way to align individual lines without opening the full toolbar.
13:
14: ### 🛠️ Maintenance & Infrastructure
15:
16: - **Project Migration**: Successfully migrated the repository from legacy locations to the new primary home at `NaeNaeTart/NaeNae-AMLL-TTML-TOOL`.
17: - **Global Repository Link Update**: Standardized all internal and external links, including documentation, about dialogs, and configuration files, to point to the new repository.
18: - **License Header Standardization**: Executed a global update of license headers across the entire codebase to ensure consistent compliance with the GPL-3.0 license.
19: - **Repository Cleanup**: Removed redundant `package-lock.json`, legacy workspace files, and temporary build logs to keep the repository clean and optimized for `pnpm`.
20: - **Improved .gitignore**: Updated exclusion rules to handle modern editor workspace files and temporary development directories.
21:
22: ---

## [0.4.2] - 2026-04-22

### ✨ New Features

- **Toxi Lyrics Engine**: A high-fidelity implementation of the "Toxi" lyric style, featuring "jump-down" word animations, instant-on bloom with smooth fade-out, and adjustable wipe softness.
- **High-Frequency Rendering Loop**: Developed a dedicated `requestAnimationFrame` interpolation engine for the previewer, bypassing React state bottlenecks to support true high-refresh-rate rendering (144Hz, 240Hz, etc.).
- **V-Sync & FPS Tools**: Added a global V-Sync toggle and a real-time FPS counter to monitor and unlock preview performance. Options are available in the Ribbon Bar and the Preferences Dev Tab.

### 🎨 UI / UX

- **Adjustable Wipe Softness**: The lyric fill "wipe" is now linked to the "Fade Width" setting, allowing users to customize the leading edge softness.
- **Improved Lyric Consistency**: Standardized the rendering path for all lyric states using consistent `background-clip: text` and `will-change` hints, eliminating font "thickening" and sub-pixel shifts when words finish.
- **Syllable Split Fix**: Removed artificial word gaps to ensure multi-syllable word fragments (e.g., "in sane") appear as solid words without visible splits.

---

## [0.3.2] - 2026-04-19

### 🐛 Bug Fixes

- **Preferences Tab Overflow**: Enabled horizontal scrolling and fixed-width triggers for the Preferences dialog tabs. This prevents labels from being cut off or compressed in languages with long strings (e.g., Russian).

---

## [0.3.1] - 2026-04-19

### ✨ New Features

- **Urban Dictionary Syllable Concatenation**: When fetching from Urban Dictionary, if multiple syllables or words are selected, they are now automatically combined into a single query term. This is especially useful for slang words that are split across multiple timing segments.

### 🎨 UI / UX

- **Header Glassmorphism Overhaul**: Fixed inconsistent blur effects in the top bar area. The TitleBar and RibbonBar are now unified with a more robust glassmorphism effect, featuring improved backdrop-filter settings (`blur(16px) saturate(160%)`) and matching semi-transparent backgrounds (`var(--gray-a5)`).
- **Integrated Header Layout**: Removed margins from the RibbonBar card and unified its style with the TitleBar to create a single, cohesive blurred header area.
- **Improved Layout Stability**: Fixed several invalid `0fr` CSS Grid column definitions in the preview and sync mode ribbon bars, ensuring more stable rendering across different window sizes.

---

## [0.3.0] - 2026-04-19

### ✨ New Features

- **AMLL Preview Mode**: Added a new dedicated "AMLL" preview mode powered by the local Apple Music-like lyrics rendering engine, featuring a fluid Mesh Gradient background renderer (MeshGradientRenderer) running at 60 FPS.
- **Background Vocal Grouping (Standard Mode)**: Main and background vocal lines that share the same start time are now rendered as a single unified visual block. When a group becomes active, both the main line and its BG vocal(s) scale up together, matching official Apple Music behavior.
- **Highlight-as-you-go Word Tracking**: Each word in the active lyric line now highlights instantly based on its exact timestamp, with no animation lag.

### ⚡ Performance

- **GPU Hardware Acceleration**: Applied `translate3d`, `backface-visibility: hidden`, and `will-change` hints across all lyric lines to maximize GPU compositing and minimize CPU usage.
- **Promotion-based Rendering Architecture**: Inactive lyric lines are now rendered as static lightweight elements with no time subscriptions. Only the currently active line "promotes" to a full dynamic render with per-word highlighting, reducing React reconciliation work by ~95%.
- **Eliminated Expensive CSS Filters**: Removed `blur()`, `text-shadow`, and SVG `feTurbulence` noise filter from the Standard mode background — all of which caused per-frame repaints. Replaced with opacity-based alternatives.
- **Content-Visibility Culling**: Applied `content-visibility: auto` and `contain: layout style` to all lyric lines, allowing the browser to skip rendering off-screen elements entirely.
- **Conditional State Subscriptions**: Inactive words no longer subscribe to the playback time atom, eliminating hundreds of unnecessary hook evaluations per frame.
- **Simplified Aurora Background**: Reduced the Standard mode background from 5 animated radial gradients to 2 static gradients, dramatically cutting GPU fill-rate cost.

### 🎨 UI / UX

- **Removed "Rendered" Mode**: Consolidated the legacy "Rendered" AMLL mode into the new dedicated AMLL mode. The preview selector now cleanly presents: **Standard**, **AMLL**, and **Timing**.
- **Cinematic Typography**: Updated Standard mode font size to `3.8rem` with consistent letter-spacing, line-height, and `0.22em` inter-word gaps that prevent layout shifts when lines transition between active and inactive states.
- **BG Vocal Visual Hierarchy**: Background vocals display in italic at `2.6rem` beneath their parent main line, with lower opacity when inactive and full brightness when their group is active.
- **Instant Highlights**: Word and line highlights in Standard mode are now immediate (`transition: none`), providing precise visual synchronization with audio playback.
- **Stable Scroll Centering**: Fixed lyric auto-scroll to correctly target the layout position of active lines, centering them at a comfortable 40% from the top of the viewport. Fixed a bug where `display: contents` wrapper divs were reporting `offsetTop = 0`, causing the scroll to snap to the top of the container.
- **AMLL Background Fix**: Resolved a bug where the AMLL Mesh Gradient background canvas was hidden behind a solid black container background due to its internal `z-index: -1`. The container is now transparent, letting the hardware-accelerated background render through correctly.

### 🐛 Bug Fixes

- Fixed "Atom is undefined or null" crash in Jotai caused by conditionally passing `null` to `useAtomValue`. Replaced with a static `zeroAtom` fallback.
- Fixed AMLL lyric player rendering empty/collapsed area due to the `LyricPlayer` wrapper `div` having no explicit size. Now uses `flex: 1` in a flex column container.
- Fixed background vocal lines appearing in the wrong position (centered) instead of below their associated main lyric line.
- Fixed lyric scroll snapping to the top of the page on every line change after the BG vocal grouping refactor.

---

## [0.2.0] - Previous Release

- Initial multi-preview mode support (Standard, AMLL, Rendered, Timing).
- Community-sourced translation integration via Crowdin.
- Phonetic auto-fetch for Japanese (Kuromoji), Chinese (Pinyin Pro), and Korean (Hangul Romanize).
- Spectrogram editor with left-mouse-button restricted drag interaction.
- Upstream sync with `spicylyrics` repository changes.
