# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Onboarding for Projects & VGZ Features**:
  - The empty editor state now shows a single Projects shortcut next to Start Guide, Import Lyrics, and Open TTML.
  - The Start Guide covers the standard workflow only — intro, audio, lyrics, review, sync, songwriters, export, test — and closes with a VGZ step as the fork's plus: it highlights fork-only features and opens their VGZ-badged toggles in Settings.
  - Project guidance lives in its own primer: the first-run welcome dialog offers "Learn how projects work", which opens a short explanation of folder projects with a direct Open Projects action. Nothing in that primer mixes into the main guide flow.
  - External guide links (Full guide per step, testing instructions, Genius portal) now open through the Tauri shell opener with a browser fallback, fixing buttons that silently did nothing in the desktop app.
- **TTML v3/v4 Vocal Agent Round-Trip**:
  - Parser now maps `ttm:agent="v3"` to middle vocals (`isMiddle`) and `"v4"` to duet groups (`isDuetGroup`), propagating both roles into nested background sub-lines on import.
  - Writer emits matching `v3`/`v4` `ttm:agent` declarations in document metadata and per-line agent attributes for full round-trip fidelity.
- **Always-Standalone Background Export**: Background lines are now exported as their own `<p>` elements by default; the `allowConsecutiveBackgroundLines` option only controls whether consecutive background lines get grouped under one element.
- **Split Spectrogram Multi-Track Editing**:
  - Divide spectrogram into two synchronized parallel tracks for editing overlapping vocals, duets, and background ad-libs.
  - Right-click context menu action `Show on Top Track` to route specific lyric lines to the upper spectrogram track.
  - Floating quick-close button ("X") on the top track to easily collapse back to unified view.
  - Automatic split-state reset when opening or switching projects.
- **Multi-Background TTML Support (inherited from upstream)**:
  - Base support for multiple consecutive and overlapping background lines (`<span ttm:role="x-bg">`) plus the `allowConsecutiveBackgroundLines` writer option come from `upstream/main` (upstream commit `bbec2b1` by TX24, "feat(ttml): support flexible background vocal export", absorbed here via merge `34ba3df`). This fork keeps them and builds on top — see Always-Standalone Background Export and TTML v3/v4 Vocal Agent Round-Trip for the fork-specific extensions.
- **Lyricsfile v1.1 (.lyricsfile.yaml) Enhancements**:
  - Full support for the `.lyricsfile.yaml` standard extension across folder projects, export dialogs, and the converter tool.
  - Reliable Dual format detection in all project cards and browsers regardless of active format (TTML or YAML).
- **Dynamic Project Loading & Priority**:
  - Always default to opening `.ttml` if present in folder projects, falling back to `.lyricsfile.yaml`.
  - Real-time disk validation that cleans up deleted file references automatically from project manifests.
- **Upstream Integrations & Fixes (base inherited from upstream)**:
  - The Discord Rich Presence module, the Genius/LRCLIB/Lyrically/plain-text importers with their persisted preferences (Process Lyrics, songwriters, section headers), the NetEase Music integration used by color extraction, and the base spectrogram word audition are inherited from `upstream/main`.
  - Fork-side additions on top: cover art URL validation with safe fallback to application branding, and in-memory WAV slice encoding powering word audition playback.
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
  - Standard and Toxi preview modes now use the interactive `SpicyBackground` mesh-warp engine (engine component inherited from upstream; wiring into both previews is fork work) with full cover palette extraction from embedded audio, metadata, or custom backgrounds.
  - Cover art resolution chain for Discord Rich Presence — fork-built on top of upstream's presence module — with online NetEase API fallback (the NetEase integration itself is upstream's) for missing embedded art, and multi-host (tmpfiles, catbox, litterbox) image upload support.
  - Unified rendering for harmony pairs (`isDuetGroup`) side-by-side across Standard, Toxi, and Spicy preview styles.
  - Editor Auto-Scroll to Active Line toggle (`previewFollowsPlaybackAtom`) that automatically scrolls the editor in Edit and Sync modes to follow the playing line during audio playback.
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

- **Extended Background Line Illumination in Spicy Lyrics**: Fixed an issue where lead lines and standalone background lines remained frozen in the illuminated `.Active` state past their vocal duration when saved/exported TTML files were played in Spicy Lyrics.
  - **Origin & Root Cause**:
    - *Writer grouping (from commit `bbec2b1` by TX24)*: `collectFollowingBackgroundLines` previously checked only `if (!line.isBG) break;` and unconditionally nested any following background line inside the parent `<p>` element as `<span ttm:role="x-bg">`. When a background line was separated from the lead vocal by a long musical interlude (e.g. in `White Ball.ttml` where "Check it out" ends at `00:43.627` and `(tniop siht...)` starts 6.5 seconds later at `00:50.131`), the writer grouped them into a single `<p>` container. In Spicy Lyrics, this bound the lead line and the trailing background vocal to the same DOM unit, keeping the lead vocal frozen on screen and illuminated in solid white throughout the 7-second gap and while the background vocal played underneath.
    - *Parser timing inheritance (inherited from upstream by Steve Xiao)*: `parseLyric` previously assigned `line.endTime = parsedEndTime` from the `<p>` container's `end` attribute without verifying when the lead words (`line.words`) actually finished singing.
  - **The Fix**:
    - In `ttml-writer`: `collectFollowingBackgroundLines` now strictly requires temporal overlap (`line.startTime < mainEndTime`). Background lines that start after the lead vocal has finished (`startTime >= mainEndTime`) as well as standalone background lines are now exported into their own independent `<p begin="..." end="...">` elements with `<span ttm:role="x-bg">`.
    - In `ttml-parser`: `parseLyric` now derives line `startTime` and `endTime` directly from word-level token timestamps (`line.words`) when available, preventing lead lines from inheriting an extended container `end` attribute from child `<span ttm:role="x-bg">` spans.
  - **Automated Tests**:
    - `ttml-writer.test.ts`: `exports a non-overlapping background line after a main line as its own p tag` (verifies separate `<p>` emission for gap-separated backgrounds like in `White Ball`).
    - `ttml-writer.test.ts`: `exports consecutive standalone background lines with independent p elements and timestamps`.
    - `ttml-parser.test.ts`: `derives lead line endTime from its own words instead of inheriting the container end with background`.
- **Ghost Duet Agents on Export**: All TTML export paths (folder project save, Import/Export dialog, Lyricsfile Converter) now forward text normalization options and `allowConsecutiveBackgroundLines` to `exportTTMLText`, so saved files no longer gain phantom `v2` duet agents when the setting is disabled.
- **Reverse Playback Zone Audio**: Reworked into a fully passive, user-controlled flow — marking a zone (Ctrl+F / Ctrl+H) never plays anything by itself and there is no manual audition button; the zone simply exists on the spectrogram (Ctrl+click cancels it). While normal playback crosses the zone it sounds inverted via the seamless virtual transport, pausing the forward element so nothing mixes, and never rewinds when finishing. The overlay stays stable — words render upright and readable at their virtual positions (reversed spatial order, no mirrored glyphs), with labels "Reverse zone" / "Mirrored" reflecting state. Line timestamps mirror automatically after the first complete crossing through the zone; lyric data stays untouched until then.
- **Reverse Zone Mirroring Stability**: Completing the first crossing no longer lets in-zone lyrics snap back to their original positions under the "Mirrored" label. Mirroring now targets every line currently overlapping the zone bounds instead of only the selection snapshot captured while marking, and the effective mirrored set is stored on the zone so Ctrl+click undo stays symmetric. The overlay also keeps rendering any line or word that pokes past a zone edge at its virtual position (only fully-contained ranges switch to their real, mirrored timestamps), so the completed state looks pixel-identical to the ready state.
- **Seamless Reverse Crossing During Normal Playback**: Playing the song normally now sounds the marked zone inverted while the playhead keeps advancing forward through it — the rest of the track is untouched. The engine takes over with a sample-reversed WebAudio source only inside the zone bounds and hands back to the normal element at the zone end; pause/resume inside the zone rebuilds the remaining reversed slice from the exact stop point, seeks re-sync it, and playback-rate changes apply mid-crossing. The progress bar follows the same virtual clock, so it moves smoothly through the inverted section instead of freezing.
- **Split Word & Syllable Divider Resizing in Spectrogram & Reverse Zones**:
  - Fixed a drag locking bug in `getUpdatedLineForDivider` and `getUpdatedLineForWordPan` where an artificial pixel-based duration constraint (`minVisualDurationMs`) forced `minTime > maxTime` on short/split words and syllables ("los que están partidos"), completely blocking boundary adjustments at normal zoom levels. Replaced with safe boundary thresholds (`MIN_WORD_DURATION_MS = 10ms`).
  - Added visible interactive divider lines (`.dividerLine`) with accent color glow on `:hover` and `:focus-visible` inside `DividerSegment`, providing clear visual feedback and an accessible hit-target between contiguous words.
  - Added `virtual?: boolean` support to `DividerDragOperation` in `dnd.ts` and `LyricTimelineOverlay.tsx` to invert drag deltas (`effectiveDeltaTimeMs = -deltaTimeMs`) in real-time when resizing word dividers inside reverse playback zones, ensuring the divider follows the mouse position naturally in reversed/virtual space.
  - Integrated `DividerSegment` handles directly into `ReversedLyricLine` (`ReversePlaybackZone.tsx`) for every word boundary in reverse playback zones, allowing full fine-tuning of word cuts in reverse mode.
  - Updated line filtering in `LyricTimelineOverlay` to keep lines that partially overlap the reverse zone rendered in the main timeline rather than hiding them entirely.
- **Discord Rich Presence Cover Art**: Activity payload now uses `largeImage`, matching the upstream Tauri IPC contract (`large_image`), so cover art URLs actually render in the Discord status instead of being silently dropped. This restores compatibility with upstream's module after a fork-side field rename had broken it.
- **Editor Auto-Scroll Mode Scope**: Auto-scroll to the active line now tracks Edit and Sync modes (previously Edit/Time), matching where timestamp seeking actually happens.
- **Vocalist Rename Menu Label**: The rename vocalist context menu entry now shows the resolved vocalist label for the selected line.
- **Legacy Comment Cleanup**: Removed inherited Chinese `@fileoverview` / inline comments from fork-touched modules (`ttml-parser`, `ttml-writer`, audio engine, keybindings, segmentation) per repo conventions, keeping GPLv3 license headers intact.
- **Standard and Toxi Active Line Overlap Bug**: Refactored the core preview renderer (`AMLLWrapper`) to evaluate `isActive` and `isPast` on a per-line basis rather than the per-group block inherited from upstream. Co-timed or overlapping lines (like a duet overlapping a lead vocal) now illuminate individually and dim into gray *immediately* after their exact `endTime` finishes.
- **Standard and Toxi Preview Contrast**: Boosted inactive text color opacity (`rgba(255, 255, 255, 0.45)`) and added top/bottom alpha masks so upcoming and past lyrics remain perfectly readable when playback is paused. Secondary content (translations and romanization) now render correctly on inactive/static lines.
- **Auto-Scroll Jumping to Top**: Removed an outdated layout hack for `display: contents` in the preview auto-scroll system. The viewport now calculates the exact `offsetTop` of the active line container, preventing the view from erratically jumping to the beginning of the song during playback or line clicks.
- **Spectrogram & Waveform Overview Aesthetics**: Replaced solid red/pink overview region block with a subtle translucent highlight (`var(--accent-a3)`) with `backdrop-filter: brightness(1.2)` leaving audio waveforms clearly visible (`AudioSlider` selection region).
- **Harmony (`isDuetGroup`) pairs layout**: Both `AMLLWrapper` and `SpicyLyrics` properly wrap concurrent duet/harmony lines side-by-side without vertical stacking.
- **Vocalist rename context menu**: Cleaned up menu text without template placeholder artifacts.
- **Projects History deduplication**: Strict deduplication by project name ensuring each unique project appears exactly once with its latest timestamp and total snapshot count.
- **Autosave disk persistence**: Interval-based autosave writes directly to disk for open folder projects (`saveLyricsOnly({ silent: true })`).
- **Keyboard shortcuts during text input**: Registered `alwaysActiveKeyBindings` so essential shortcuts like `Ctrl+S` fire reliably even with input fields focused.
- **Spicy background node collision**: Dedicated slot node for Kawarp animations preventing React `insertBefore` reconciliation crashes.
- **Reverse sync order restoration**: Deactivating reverse sync properly restores the original line timing snapshots.

**Inherited from upstream/main** (shipped with upstream merges — not claimed by this fork):

- Multi-background `<span ttm:role="x-bg">` parsing/grouping and the `allowConsecutiveBackgroundLines` writer option base.
- Discord Rich Presence core (activity templates, `large_image`/truncate contract).
- NetEase Music integration used by color extraction; Genius/LRCLIB/Lyrically/plain-text importers and their persisted preferences.
- SpicyLyrics mesh-warp engine component and the group-based (`LineGroup`) preview rendering that our overlap fix refines.

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
- **Editor Auto-Scroll to Active Line (VGZ)**: When enabled, the Edit and Sync mode editor automatically scrolls to the currently playing line during playback, eliminating the need to manually scroll to find the current position.
- **Reverse Playback Zone (VGZ)**: Enables the reverse playback zone system in the spectrogram. Keyboard shortcuts allow marking a region to play backwards; if the selected lines are flagged for Reverse Sync, their timestamps are mirrored automatically on completion. Can be globally disabled here.
- **Multi-Track Split View (VGZ)**: Splits the spectrogram into two synchronized parallel tracks so overlapping vocals, duets, and background ad-libs can be managed side-by-side. Individual lines can be sent to the top track via right-click context menu.

### Features Without Global Toggle (Controlled Per-Line or Always Active)

- **Reverse Sync per line**: Toggled per-line from the right-click context menu (`Set Reverse Sync Order`). Timing snapshots are saved automatically before activation and restored if deactivated.
- **Folder Projects & Workspace System**: Always active. Open, create, and manage lyrics organized as project folders with a `project.json` manifest and workspace browser.
- **Dual Format Support (TTML + Lyricsfile YAML)**: Always active. Both `.ttml` and `.lyricsfile.yaml` companion files can coexist in the same project folder.
- **Lyricsfile Engine (YAML 1.x)**: Always active. Full bidirectional parser and exporter for Lyricsfile 1.x YAML with vocalist roles.

