# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Folder Projects & Workspace System**:
  - Open, create, save, and manage lyrics organized as project folders with a `project.json` manifest.
  - Workspace scanner that discovers and lists all project folders in a directory.
  - Recent projects history with quick access and auto-saving to disk.
- **Dual Format Support (TTML + Lyricsfile YAML)**:
  - Detect and maintain companion `.ttml` and `.lyricsfile.yaml` / `.yaml` files side-by-side in the same project folder.
  - Format switching directly from the File menu with dirty-state confirmation guard and a new **Save & Switch** option to seamlessly save and transition.
  - Dual format visual badges in `ProjectBrowser`, `ProjectManager`, and `WorkspaceBrowser`.
- **Lyricsfile Engine (YAML 1.x)**:
  - Bidirectional parser, editor, and exporter for the Lyricsfile 1.x YAML format with vocal roles (`v1`–`v4`, lead, duet, harmony, background).
  - Vocalist Real Names editor in the Metadata dialog for YAML exports.
  - Lyricsfile Converter dialog (`Tools → Lyricsfile Converter (TTML ↔ YAML)`) with drag-and-drop, direct file loading, and live preview.
- **Spectrogram Hover Sync (F/G/H)**:
  - F, G, and H keyboard shortcuts to quickly synchronize lyric timestamps to the spectrogram cursor hover position.
- **Reverse Playback Zones & Reverse Sync**:
  - Mark spectrogram zones for inverted playback and sync direction with seamless virtual-to-real timestamp mapping.
  - Reverse sync order mode for right-to-left / reverse-word timing with timing snapshot backup and restoration.
- **Preview & Discord Integration**:
  - Standard and Toxi preview modes now use the interactive `SpicyBackground` mesh-warp engine with full cover palette extraction from embedded audio, metadata, or custom backgrounds.
  - Cover art resolution chain for Discord Rich Presence with online NetEase API fallback for missing embedded art, and multi-host (tmpfiles, catbox, litterbox) image upload support.
  - Unified rendering for harmony pairs (`isDuetGroup`) side-by-side across Standard, Toxi, and Spicy preview styles.
  - Preview follows playback toggle (`previewFollowsPlayback`) that synchronizes scroll position seamlessly when switching between Preview, Edit, and Time modes.
- **Lyricsfile Vocal Role Management**:
  - Dynamic **Vocalist** section in the RibbonBar (`RibbonSection`) that shows the custom name input specifically for the currently selected line's vocal role (`v1 Lead`, `v2 Duet`, `v3 Middle`, `v4 Harmony`).
  - Right-click line context menu (`Rename vocalist...`) to rename or clear custom vocalists per line role.
  - Double-click inline vocalist editing on lines with role-prefixed labels (`v1-lead (Principal): Name`, `v1-bg (Background): Name`) exclusively in YAML/Lyricsfile mode.
- **Projects & History Enhancements**:
  - Intelligent 1-hour time-bucket deduplication for auto-save snapshots in the Projects History tab, showing exact snapshot counts.
  - New **Clear History** button in the Projects dialog to wipe the auto-save database.
  - Workspace directory persistence (`workspaceDirAtom`) using `atomWithStorage` so last scanned folders survive application reloads.

### Fixed

- **Standard and Toxi Active Line Overlap Bug**: Refactored the core preview renderer (`AMLLWrapper`) to evaluate `isActive` and `isPast` on a per-line basis rather than a per-group block. Co-timed or overlapping lines (like a duet overlapping a lead vocal) now illuminate individually and dim into gray *immediately* after their exact `endTime` finishes.
- **Standard and Toxi Preview Contrast**: Boosted inactive text color opacity (`rgba(255, 255, 255, 0.45)`) and added top/bottom alpha masks so upcoming and past lyrics remain perfectly readable when playback is paused. Secondary content (translations and romanization) now render correctly on inactive/static lines.
- **Auto-Scroll Jumping to Top**: Removed an outdated layout hack for `display: contents` in the preview auto-scroll system. The viewport now calculates the exact `offsetTop` of the active line container, preventing the view from erratically jumping to the beginning of the song during playback or line clicks.
- **Spectrogram & Waveform Overview Aesthetics**: Replaced solid red/pink overview viewport block with a subtle translucent highlight (`var(--accent-a3)`) with `backdrop-filter: brightness(1.2)` leaving audio waveforms clearly visible.
- **Harmony (`isDuetGroup`) pairs layout**: Both `AMLLWrapper` and `SpicyLyrics` properly wrap concurrent duet/harmony lines side-by-side without vertical stacking.
- **Vocalist rename context menu**: Cleaned up menu text without template placeholder artifacts.
- **Projects History deduplication**: Strict deduplication by project name ensuring each unique project appears exactly once with its latest timestamp and total snapshot count.
- **Autosave disk persistence**: Interval-based autosave writes directly to disk for open folder projects (`saveLyricsOnly({ silent: true })`).
- **Keyboard shortcuts during text input**: Registered `alwaysActiveKeyBindings` so essential shortcuts like `Ctrl+S` fire reliably even with input fields focused.
- **Spicy background node collision**: Dedicated slot node for Kawarp animations preventing React `insertBefore` reconciliation crashes.
- **Reverse sync order restoration**: Deactivating reverse sync properly restores the original line timing snapshots.

Note: Some of these corrections arose during the development process.