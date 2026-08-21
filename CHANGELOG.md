# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **TTML v3/v4 Vocal Agent Round-Trip**:
  - Parser now maps `ttm:agent="v3"` to middle vocals (`isMiddle`) and `"v4"` to duet groups (`isDuetGroup`), propagating both roles into nested background sub-lines on import.
  - Writer emits matching `v3`/`v4` `ttm:agent` declarations in document metadata and per-line agent attributes for full round-trip fidelity.
- **Always-Standalone Background Export**: Background lines are now exported as their own `<p>` elements by default; the `allowConsecutiveBackgroundLines` option only controls whether consecutive background lines get grouped under one element.
- **Split Spectrogram Multi-Track Editing**:
  - Divide spectrogram into two synchronized parallel tracks for editing overlapping vocals, duets, and background ad-libs.
  - Right-click context menu action `Show on Top Track` to route specific lyric lines to the upper spectrogram track.
  - Floating quick-close button ("X") on the top track to easily collapse back to unified view.
  - Automatic split-state reset when opening or switching projects.
- **Multi-Background TTML Support**:
  - Full parser and writer support for multiple consecutive and overlapping background lines (`<span ttm:role="x-bg">`) in TTML.
- **Lyricsfile v1.1 (.lyricsfile.yaml) Enhancements**:
  - Full support for the `.lyricsfile.yaml` standard extension across folder projects, export dialogs, and the converter tool.
  - Reliable Dual format detection in all project cards and browsers regardless of active format (TTML or YAML).
- **Dynamic Project Loading & Priority**:
  - Always default to opening `.ttml` if present in folder projects, falling back to `.lyricsfile.yaml`.
  - Real-time disk validation that cleans up deleted file references automatically from project manifests.
- **Upstream Integrations & Fixes**:
  - Discord RPC cover art URL validation with safe fallback to application branding.
  - Persisted lyric import preferences (Process Lyrics, Genius songwriters, and section headers).
  - Spectrogram word audition playback powered by in-memory WAV slice encoding.
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
  - Editor Auto-Scroll to Active Line toggle (`previewFollowsPlaybackAtom`) that automatically scrolls the editor in Edit and Time modes to follow the playing line during audio playback.
- **Lyricsfile Vocal Role Management**:
  - Dynamic **Vocalist** section in the RibbonBar (`RibbonSection`) that shows the custom name input specifically for the currently selected line's vocal role (`v1 Lead`, `v2 Duet`, `v3 Middle`, `v4 Harmony`).
  - Right-click line context menu (`Rename vocalist...`) to rename or clear custom vocalists per line role.
  - Double-click inline vocalist editing on lines with role-prefixed labels (`v1-lead (Principal): Name`, `v1-bg (Background): Name`) exclusively in YAML/Lyricsfile mode.
- **Projects & History Enhancements**:
  - Intelligent 1-hour time-bucket deduplication for auto-save snapshots in the Projects History tab, showing exact snapshot counts.
  - New **Clear History** button in the Projects dialog to wipe the auto-save database.
  - Workspace directory persistence (`workspaceDirAtom`) using `atomWithStorage` so last scanned folders survive application reloads.

### Changed

- **Upstream Alignment**: Multiple fork behaviors were adapted to follow `upstream/main` conventions, since absorbing upstream changes cleanly and staying compatible with future pull requests required adapting our side. This includes routing every TTML export through the shared `exportTTMLText(ttmlLyric, normalization?, options?)` contract instead of ad-hoc normalization at call sites, matching the Discord activity payload field names to the Tauri IPC contract (`largeImage` → `large_image`), adding a pnpm `onlyBuiltDependencies` allowlist for AMLL packages/esbuild, and dropping fork-only dead code that diverged from upstream APIs. Upstream-inherited user-facing strings and comments remain untouched by design.
- **TTML Export Semantics for Multi-Background Lyrics**: Background lines are serialized as independent `<p ttm:role="x-bg">` elements by default (with optional grouping of consecutive backgrounds via `allowConsecutiveBackgroundLines`), and middle / duet-group vocals now persist through `ttm:agent="v3"` / `"v4"`. Together with the parser changes this makes true multi-background, multi-vocalist TTML files possible that round-trip through the editor without losing vocal roles.

### Fixed

- **Ghost Duet Agents on Export**: All TTML export paths (folder project save, Import/Export dialog, Lyricsfile Converter) now forward text normalization options and `allowConsecutiveBackgroundLines` to `exportTTMLText`, so saved files no longer gain phantom `v2` duet agents when the setting is disabled.
- **Reverse Playback Zone Audio**: Added the missing reversed-audio engine implementation (`playReversedRange` / `stopReversePlayback`) that zone playback was already calling; playing a marked zone now works instead of failing.
- **Discord Rich Presence Cover Art**: Activity payload now uses `largeImage`, matching the Tauri IPC contract (`large_image`), so cover art URLs actually render in the Discord status instead of being silently dropped.
- **Editor Auto-Scroll Mode Scope**: Auto-scroll to the active line now tracks Edit and Sync modes (previously Edit/Time), matching where timestamp seeking actually happens.
- **Vocalist Rename Menu Label**: The rename vocalist context menu entry now shows the resolved vocalist label for the selected line.
- **Legacy Comment Cleanup**: Removed inherited Chinese `@fileoverview` / inline comments from fork-touched modules (`ttml-parser`, `ttml-writer`, audio engine, keybindings, segmentation) per repo conventions, keeping GPLv3 license headers intact.
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
---

## VGZ Settings & Feature Flags

All features unique to this fork are labeled with a dynamic **VGZ badge** in the Settings dialog for clear identification. This visual badge automatically adapts to the app's configured accent color.

### Configurable VGZ Features

| Feature | Location in Settings | Atom |
|---|---|---|
| **Sync F/G/H to Spectrogram Hover** | Editor & Sync | `syncFghToHoverAtom` |
| **Editor Auto-Scroll to Active Line** | General | `previewFollowsPlaybackAtom` |
| **Reverse Playback Zone** | Editor & Sync | `reversePlaybackEnabledAtom` |
| **Multi-Track Split View** | Audio → Spectrogram | `spectrogramSplitModeAtom` |

### Feature Descriptions

- **Sync F/G/H to Spectrogram Hover (VGZ)**: When hovering over the spectrogram, the F, G, and H keyboard shortcuts use the cursor hover timestamp instead of the audio playhead, allowing fast precision syncing without moving the playhead.
- **Editor Auto-Scroll to Active Line (VGZ)**: When enabled, the Edit and Time mode editor automatically scrolls to the currently playing line during playback, eliminating the need to manually scroll to find the current position.
- **Reverse Playback Zone (VGZ)**: Enables the reverse playback zone system in the spectrogram. Keyboard shortcuts allow marking a region to play backwards; if the selected lines are flagged for Reverse Sync, their timestamps are mirrored automatically on completion. Can be globally disabled here.
- **Multi-Track Split View (VGZ)**: Splits the spectrogram into two synchronized parallel tracks so overlapping vocals, duets, and background ad-libs can be managed side-by-side. Individual lines can be sent to the top track via right-click context menu.

### Features Without Global Toggle (Controlled Per-Line or Always Active)

- **Reverse Sync per line**: Toggled per-line from the right-click context menu (`Set Reverse Sync Order`). Timing snapshots are saved automatically before activation and restored if deactivated.
- **Folder Projects & Workspace System**: Always active. Open, create, and manage lyrics organized as project folders with a `project.json` manifest and workspace browser.
- **Dual Format Support (TTML + Lyricsfile YAML)**: Always active. Both `.ttml` and `.lyricsfile.yaml` companion files can coexist in the same project folder.
- **Lyricsfile Engine (YAML 1.x)**: Always active. Full bidirectional parser and exporter for Lyricsfile 1.x YAML with vocalist roles.

