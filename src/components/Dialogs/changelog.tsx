import { DismissRegular } from "@fluentui/react-icons";
import { Box, Button, Dialog, Flex, Heading, ScrollArea, Text } from "@radix-ui/themes";
import { open } from "@tauri-apps/plugin-shell";
import { useAtom } from "jotai";
import { changelogDialogAtom } from "$/states/dialogs.ts";

export function ChangelogDialog() {
	const [isOpen, setIsOpen] = useAtom(changelogDialogAtom);

	const openGitHub = async () => {
		const repoUrl = "https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL/commits/main";
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open(repoUrl);
		} else {
			window.open(repoUrl, "_blank");
		}
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 650, height: "70vh", maxHeight: 600 }}>
				<Flex justify="between" align="center" mb="4">
					<Flex align="center" gap="3">
						<Dialog.Title mb="0">
							Changelog & Updates
						</Dialog.Title>
						<Button variant="soft" size="1" color="indigo" onClick={openGitHub} style={{ cursor: "pointer" }}>
							View Commits on GitHub
						</Button>
					</Flex>
					<Dialog.Close>
						<Button variant="ghost" color="gray">
							<DismissRegular />
						</Button>
					</Dialog.Close>
				</Flex>

				<ScrollArea type="always" scrollbars="vertical" style={{ height: "calc(100% - 60px)" }}>
					<Flex direction="column" gap="5" pr="4">
						<Box>
							<Heading size="4" mb="2" color="ruby">Unreleased</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Line Reordering Fix:</strong> Dragging lyric lines now scrolls the editor reliably at its edges and supports mouse-wheel and trackpad scrolling while held.
								</Text>
								<Text size="2">
									<strong>Website Update Recovery:</strong> Website users can now force a refresh or clear cached website files when an update prompt fails to appear.
								</Text>
								<Text size="2">
									<strong>TTML Checklist:</strong> Keep a persistent local queue of songs to sync, with notes and a completed history.
								</Text>
								<Text size="2">
									<strong>Linux AppImage Fix:</strong> AppImages now use the host Wayland libraries and show their window reliably, preventing startup failures on newer Linux graphics stacks.
								</Text>
								<Text size="2">
									<strong>External Links & Build Info Fix:</strong> About and changelog links now open correctly in the desktop app, and hosted builds show their Git commit instead of “unknown.”
								</Text>
							</Flex>
						</Box>
						<Box>
							<Heading size="4" mb="2" color="ruby">v0.7.4 Updates</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Optional AI Fun Sidebar:</strong> Enable a manual, bring-your-own-provider TTML vibe check with personalities ranging from Glazer to Unhinged. It stays off by default and never changes your lyrics.
								</Text>
								<Text size="2">
									<strong>Cyrillic E Import Preference:</strong> Added an optional workaround that corrects Cyrillic Е/е lookalikes inside otherwise Latin lyric words.
								</Text>
								<Text size="2">
									<strong>Apostrophe Import Preference:</strong> Added a setting to standardize curly and other apostrophe-like characters when importing lyrics.
								</Text>
								<Text size="2">
									<strong>Genius Import Fix:</strong> Restored the Change API Key button in the Genius lyric-import dialog.
								</Text>
								<Text size="2">
									<strong>Playback Timeline Fix:</strong> The waveform playhead now recovers from audio stalls and long frame gaps without sacrificing smooth playback at slower speeds.
								</Text>
							</Flex>
						</Box>
						<Box>
							<Heading size="4" mb="2" color="ruby">v0.7.3 Updates</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Genius Section Improvements:</strong> Duplicated lyric lines now create independent repeat-linked sections; collapsed headers select their whole section; unassigned lyric blocks can be merged into neighboring sections; repeated-section timing copy matches lyric text and skips mismatches; and a section manager makes reviewing and editing sections easier.
								</Text>
								<Text size="2">
									<strong>Auto Segment Shortcut:</strong> Press the configured Auto Segment key once or twice, with a Keybindings option to choose the preferred behavior. It applies immediately when the saved engine matches the detected lyric language, otherwise it opens the engine picker.
								</Text>
								<Text size="2">
									<strong>Spicy Lyrics Option:</strong> Added a preview toggle to force every lyric line to use line rendering due to unreliable line-synced lyrics detection.
								</Text>
								<Text size="2">
									<strong>Localization:</strong> Added missing translation keys and localized section, timing, and auto-segmentation controls.
								</Text>
								<Text size="2">
									<strong>Prosodic Segmentation Fix:</strong> English contractions using typographic apostrophes, such as “we’re” and “they’re”, now stay together.
								</Text>
								<Text size="2">
									<strong>Desktop Update Fix:</strong> Desktop builds now check immutable published releases for updates, so future updates download from permanent versioned installers.
								</Text>
								<Text size="2">
									<strong>Spicy Lyrics Fix:</strong> The Spicy Lyrics preview now preserves TTML line order when line timestamps are out of sequence.
								</Text>
								<Text size="2">
									<strong>Spicy Lyrics Fix:</strong> Interlude dots now ignore background-vocal endings while waiting for all main vocals to finish.
								</Text>
							</Flex>
						</Box>
						<Box>
							<Heading size="4" mb="2" color="ruby">v0.7.2 Updates (Lyrics Segmentation)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Selectable Syllabification Engines:</strong> Auto Segment and Advanced Segmentation now offer dedicated English, Spanish, French, Russian, Japanese, and CJK engines alongside clearly labelled legacy fallbacks. The Auto Segment dialog suggests an engine from the lyric language.
								</Text>
								<Text size="2">
									<strong>Learned Word Splits:</strong> Manual split boundaries can now be remembered and automatically reused for future occurrences of the same word.
								</Text>
								<Text size="2">
									<strong>Persistent Split Dialog Options:</strong> The Split Word dialog now remembers its last-used options, reducing repeated setup when correcting multiple words.
								</Text>
								<Text size="2">
									<strong>Lyric Preparation Fix:</strong> CJK text now splits correctly around non-Latin commas even when there is no surrounding space.
								</Text>
							</Flex>
						</Box>
						<Box>
							<Heading size="4" mb="2" color="ruby">v0.7.1 Updates (Scoped Time Stretch)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Scoped Time Stretch:</strong> Time Stretch can now be applied to all lines, selected lines, selected lines and everything following them, or a custom line range.
								</Text>
								<Text size="2">
									<strong>Genius Section Workflow:</strong> Added normalized section categories, required import review, repeat detection, a collapsible section navigator, rich section metadata and actions, live validation, and lossless TTML section metadata.
								</Text>
							</Flex>
						</Box>
						<Box>
							<Heading size="4" mb="2" color="ruby">v0.7 Updates (Spicy Lyrics, Imports & Timing)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Spicy Lyrics Preview Mode:</strong> Added a high-fidelity Spicy Lyrics renderer with its dedicated SF Pro-derived font; animated, custom, and cover-art backgrounds; karaoke, Simple Lyrics, and line-synced rendering; interlude dots; RTL- and duet-aware layouts; CJK/romanized word wrapping; automatic scrolling; and an optional FPS counter.
								</Text>
								<Text size="2">
									<strong>Timing Stretch:</strong> Added a TTML timing-stretch tool that can import audio duration and scale lyric timing to match it.
								</Text>
								<Text size="2">
									<strong>Unified Lyrics Import:</strong> Consolidated text, LRCLIB, Lyrically, and Genius imports into one workflow with shared lyric preparation, replacement confirmation, and consistent punctuation, CJK/Latin boundary, word-separator, and background-vocal handling.
								</Text>
								<Text size="2">
									<strong>Genius Header Categorization &amp; Section Tools:</strong> Preserve bracketed Genius headers such as <code>[Chorus]</code> and <code>[Verse]</code> as section metadata instead of lyric lines. Sections are visually grouped and color-coded by type, with a customizable header-color override; unrecognized headers use the theme accent. Sync actions can snap an entire section to the playhead or copy timing from a previous matching section.
								</Text>
								<Text size="2">
									<strong>Backup System:</strong> Added a new backup system to help protect project data and simplify recovery.
								</Text>
								<Text size="2">
									<strong>Preview Layout Fixes:</strong> Fixed the Time-mode preview pane being pushed off-screen after its contents loaded, and hide the side preview pane when the full Preview screen is active.
								</Text>
								<Text size="2">
									<strong>Genius Import Fixes:</strong> Switched Genius fetching to its CORS-enabled embed endpoint and cleaned up parsed newlines and import-dialog crashes.
								</Text>
								<Text size="2">
									<strong>Tauri CI:</strong> Repaired the GitHub Actions build key configuration.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="violet">v0.6.7 Updates (Bouncy Word Indicator)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Bouncy Indicator:</strong> Words in the Sync view that qualify as long-duration syllables now display a small animated bouncing dot beneath them. A word qualifies when its letter count is 12 or fewer <em>and</em> its duration meets the threshold <code>1000 + (letterLength - 1) × 25</code> ms — helping you instantly spot held or sustained syllables that may need extra timing attention.
								</Text>
								<Text size="2">
									<strong>Zero Performance Cost:</strong> The indicator is driven purely by CSS keyframe animation with no runtime subscriptions or re-renders. It appears only in Sync mode and is invisible during playback active state, keeping the editing surface clean.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="ruby">v0.6.6 Updates (Preview Stability & Toxi Fixes)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Preview Panel Stability:</strong> Fixed a critical "white page" crash when toggling the Preview Panel in Sync mode by resolving a missing component import in the main application layout.
								</Text>
								<Text size="2">
									<strong>Toxi Animation Correction:</strong> Fixed a bug where the "jump-down" word animation was incorrectly disabled when "Instant Fade Out" was active. High-fidelity Toxi animations now work consistently with all highlight settings.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="teal">v0.6.5 Updates (Instant Transitions & UI Cleanup)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Instant Highlight Fade:</strong> Added a new toggle in both Preview and Sync modes to switch between smooth fading and instant transitions for word highlights. Perfect for high-precision timing review.
								</Text>
								<Text size="2">
									<strong>Scrapped Element Resizing:</strong> Officially scrapped the experimental "Element Resizing" mode and associated keybindings (Ctrl+Alt). This eliminates potential layout conflicts and simplifies the core interface.
								</Text>
								<Text size="2">
									<strong>Enhanced "What's New":</strong> Expanded the feature guide to include 12 core tool features with dedicated "Info" buttons for direct usage guidance and localized documentation.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="gold">v0.6.2 Updates (Sync Accuracy & Export Validation)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Millisecond Sync Precision:</strong> Implemented high-precision audio time interpolation and eliminated rounding jitter in the sync engine. Timing errors of 1-3ms are now fully resolved.
								</Text>
								<Text size="2">
									<strong>Export Validation:</strong> Added an automated sync health check when exporting. The tool now detects untimed lyrics and offers to jump directly to errors for correction.
								</Text>
								<Text size="2">
									<strong>Genius Tag Filtering:</strong> The "Process Lyrics" tool now automatically strips section headers (e.g., [Chorus]) and removes empty lines for a cleaner import.
								</Text>
								<Text size="2">
									<strong>Improved Dialogs:</strong> Enhanced the confirmation dialog system with support for custom action labels and better navigation between error states.
								</Text>
								<Text size="2">
									<strong>Standardized Defaults:</strong> Updated the default preview mode to "Standard" for better initial clarity on new projects.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="teal">v0.6.1 Updates (Visual Performance Audit)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>GPU Bottleneck Elimination:</strong> Removed expensive <code>backdrop-filter: blur</code> on the full-viewport overlay, resolving severe rendering lag and re-compositing overhead on integrated GPUs.
								</Text>
								<Text size="2">
									<strong>Optimized Mesh Gradients:</strong> Implemented 0.5x Smart Scaling for the mesh background. This reduces the background GPU workload by ~50% with no visible quality loss on blurred surfaces.
								</Text>
								<Text size="2">
									<strong>Smart Mesh Animation:</strong> Tied background animation state directly to audio playback. The mesh gradient now freezes when paused to eliminate idle power consumption and GPU usage.
								</Text>
								<Text size="2">
									<strong>High-Efficiency Bloom:</strong> Switched from <code>drop-shadow</code> filters to multi-layered <code>text-shadow</code> for active words in Standard mode, significantly improving frame pacing and stability.
								</Text>
								<Text size="2">
									<strong>GPU VRAM Management:</strong> Removed global <code>will-change</code> over-promotion from static words to prevent VRAM exhaustion and layout thrashing on large projects.
								</Text>
								<Text size="2">
									<strong>Scoped Layer Promotion:</strong> Optimized hardware layer promotion to trigger only on active words, ensuring maximum rendering throughput for the Toxi engine.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="ruby">v0.6.0 Updates (Repository Migration & Snap Sync)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Project Migration:</strong> The repository has officially moved to <code>NaeNaeTart/NaeNae-AMLL-TTML-TOOL</code>. All documentation, license headers, and internal links have been standardized to reflect this change.
								</Text>
								<Text size="2">
									<strong>Snap to Playhead:</strong> Added a high-precision synchronization tool in the Time Shift toolbar. Align your lyrics instantly by snapping line start times to your current audio playback position.
								</Text>
								<Text size="2">
									<strong>Circular Snap Button:</strong> Refined the Snap tool with a dedicated circular "Record" icon for a cleaner, more intuitive synchronization workflow.
								</Text>
								<Text size="2">
									<strong>Context Menu Enhancements:</strong> Added "Move line to playhead" to the lyric line right-click menu and optimized existing sync actions for better usability.
								</Text>
								<Text size="2">
									<strong>Repository Cleanup:</strong> Removed legacy lockfiles and workspace definitions to optimize the environment for modern package managers like pnpm.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="teal">v0.5.1 Updates (Spectrogram & UI)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Enhanced Duplicate-to-Selection:</strong> <code>CTRL + L</code> now intelligently uses the spectrogram selection range. Duplicated lines and their words are automatically distributed equally across the selected time range for instant, high-precision timing application.
								</Text>
								<Text size="2">
									<strong>Interactive UI Rain Effect:</strong> Clicking the mascot in the title bar triggers a high-performance "rain" animation. Built with optimized React memoization to ensure zero impact on the core editing performance.
								</Text>
								<Text size="2">
									<strong>Rendering Stack Optimization:</strong> Refactored global layout components to isolate dynamic visual effects, preventing unnecessary re-renders of the main application during animations.
								</Text>
								<Text size="2">
									<strong>Mascot Asset Restoration:</strong> Updated the title bar mascot with a working high-reliability remote GIF asset, resolving the broken image issue.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="gold">v0.5.0 Updates (Community Plugin Store)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Community Plugin Store:</strong> Introduced a new, cloud-synced plugin architecture. Browse and install community-made WASM plugins directly from the integrated store.
								</Text>
								<Text size="2">
									<strong>Security Verification Engine:</strong> Implemented SHA-256 integrity checks for all community plugins. The tool now automatically verifies every download to protect your environment from tampering.
								</Text>
								<Text size="2">
									<strong>Flexible Plugin Registry:</strong> Switched to a GitHub-backed remote registry system, allowing for instant, zero-cost updates and community contributions via Pull Requests.
								</Text>
								<Text size="2">
									<strong>Improved Hash Handling:</strong> Standardized plugin verification to be case-insensitive, ensuring reliable installation across different platforms and hash tools (like PowerShell vs Browser).
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="teal">v0.4.2 Updates (High Performance & Toxi Engine)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Toxi Lyrics Engine:</strong> Re-engineered the Toxi lyric style with high-fidelity "jump-down" animations, instant-hit blooming with smooth fade-out, and adjustable wipe softness.
								</Text>
								<Text size="2">
									<strong>144Hz+ Rendering Loop:</strong> Implemented a dedicated interpolation engine that bypasses React bottlenecks, enabling true high-refresh-rate rendering on ProMotion and gaming monitors.
								</Text>
								<Text size="2">
									<strong>V-Sync & FPS Counter:</strong> Introduced performance monitoring tools. Uncap your frame rate with the new V-Sync toggle and track real-time delivery with the FPS counter overlay.
								</Text>
								<Text size="2">
									<strong>Rendering Consistency:</strong> Unified the rendering path across all word states to eliminate font "thickening" artifacts and sub-pixel shifts, ensuring perfectly sharp lyrics from start to finish.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">v0.4.0 Updates (Appearance & Presets)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Advanced Appearance Editor:</strong> Introduced a high-fidelity visual editor with support for 40+ granular visual parameters. Customize everything from background gradients and glassmorphism levels to global border radii and drop shadows.
								</Text>
								<Text size="2">
									<strong>Visual Preset System:</strong> Added a robust preset management system. Save your favorite visual configurations, load them instantly, and share your unique themes with the community.
								</Text>
								<Text size="2">
									<strong>Audio Pitch Preservation:</strong> Added a new "Preserve Pitch" toggle in the audio settings. You can now choose whether the audio pitch should change when adjusting the playback speed — perfect for high-speed transcription.
								</Text>
								<Text size="2">
									<strong>Stability & Localization:</strong> Resolved multiple compilation conflicts and duplicate state declarations. Standardized English labels across new audio controls for better international consistency.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="ruby">v0.3.2 Hotfix (Layout)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Preferences Tab Overflow:</strong> Enabled horizontal scrolling and fixed-width triggers for the Preferences dialog tabs. This prevents labels from being cut off or compressed in languages with long strings like Russian.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="cyan">v0.3.1 Updates (Syllables & UI)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Urban Dictionary Syllable Concatenation:</strong> When fetching from Urban Dictionary, if multiple syllables or words are selected, they are now automatically combined into a single query term. This is especially useful for slang words that are split across multiple timing segments.
								</Text>
								<Text size="2">
									<strong>Header Glassmorphism Overhaul:</strong> Fixed inconsistent blur effects in the top bar area. The TitleBar and RibbonBar are now unified with a robust glassmorphism effect, featuring improved backdrop-filter settings (<code>blur(16px) saturate(160%)</code>) and matching semi-transparent backgrounds (<code>var(--gray-a5)</code>).
								</Text>
								<Text size="2">
									<strong>Integrated Header Layout:</strong> Removed margins from the RibbonBar card and unified its style with the TitleBar to create a single, cohesive blurred header area.
								</Text>
								<Text size="2">
									<strong>Improved Layout Stability:</strong> Fixed several invalid <code>0fr</code> CSS Grid column definitions in the preview and sync mode ribbon bars, ensuring more stable rendering across different window sizes.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="amber">v0.3.0 Updates (Performance & Preview)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>AMLL Preview Mode:</strong> Added a dedicated high-fidelity <strong>AMLL</strong> preview mode powered by the local Apple Music-like lyrics rendering engine, featuring a fluid Mesh Gradient background running at 60 FPS. The mode now correctly fills the entire preview window with the background properly rendered.
								</Text>
								<Text size="2">
									<strong>Background Vocal Grouping (Standard Mode):</strong> Main and background vocal lines are rendered as a single unified visual block. When a line becomes active, both the main vocal and its BG vocal(s) scale up together — matching official Apple Music behavior. BG vocals appear in italic beneath the main line with word-level highlighting.
								</Text>
								<Text size="2">
									<strong>Promotion-based Rendering Architecture:</strong> Inactive lyric lines are now rendered as static, near-zero-cost elements with no real-time subscriptions. Only the active line promotes to full dynamic rendering, reducing React reconciliation work by ~95% and eliminating word-transition lag.
								</Text>
								<Text size="2">
									<strong>GPU-First Acceleration:</strong> Applied <code>translate3d</code>, <code>backface-visibility: hidden</code>, <code>content-visibility: auto</code>, and <code>will-change</code> hints across all lyric lines to maximize GPU compositing, minimize CPU usage, and enable DOM culling for off-screen lines.
								</Text>
								<Text size="2">
									<strong>Removed "Rendered" Mode:</strong> Consolidated the legacy Rendered AMLL preview into the new AMLL mode. The preview selector now cleanly presents: <strong>Standard</strong>, <strong>AMLL</strong>, and <strong>Timing</strong>.
								</Text>
								<Text size="2">
									<strong>Bug Fixes:</strong> Fixed a Jotai "Atom is undefined" crash, fixed the AMLL background appearing solid black due to a z-index layering conflict, and fixed lyric auto-scroll snapping to the top on every line change.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="gold">v0.2.0 Updates (Major)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Community WASM Plugin System:</strong> A revolutionary extension framework allowing developers to write high-performance importers and exporters in C++ or Rust. Features persistent IndexedDB storage and a dedicated management console located in the brand new <strong>Dev</strong> preferences tab.
								</Text>
								<Text size="2">
									<strong>Advanced Romanization Engine:</strong> Completely rebuilt the phonetic system for professional-grade synchronization. Supports automated Romaji (JA), Pinyin (ZH), and Romaji (KO) generation with project-level language priority and <strong>capsule-aware distribution</strong> for perfect Japanese mora syncing.
								</Text>
								<Text size="2">
									<strong>Developer Preferences Tab:</strong> Introduced a dedicated "Dev" category in the Preferences dialog to house advanced technical features, plugin management, and system debug information. Access it to manage your community extensions or check build environments.
								</Text>
								<Text size="2">
									<strong>UI Performance & Stability:</strong> Resolved critical Ribbon Bar layout issues, implemented invisible scrollbar utilities for horizontal navigation, and fixed dynamic import failures to ensure a 100% stable and fluid editing experience.
								</Text>
								<Text size="2">
									<strong>Integrated MP3-to-FLAC Converter:</strong> Added a high-fidelity audio processing bridge powered by <strong>FFmpeg.wasm</strong>. The tool now automatically detects MP3 files and offers a streamlined conversion to FLAC format to ensure 100% timing accuracy and eliminate browser-level audio decoding drift during synchronization.
								</Text>
								<Text size="2">
									<strong>Type-Safe Plugin Architecture:</strong> Refactored the internal core to be fully type-safe, preventing runtime crashes and improving the developer experience for community contributors.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="teal">v0.1.8 Updates</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Automated Lyrics Prep Engine:</strong> Completely replaced the external <code>Lyrprep</code> dependency with a built-in, local processing engine. The new <strong>"Process Lyrics"</strong> button handles background vocal splitting, space escaping (<code>\ </code>), and hyphen splitting (<code>sh-\sh-</code>) on the spot without leaving the app.
								</Text>
								<Text size="2">
									<strong>Syllable-Level Alignment:</strong> Refined the processing logic to match professional synchronization standards. It automatically converts plain text into a syllable-sync-ready format with escaped spaces and hyphens, saving hours of manual formatting.
								</Text>
								<Text size="2">
									<strong>Feature Retirement:</strong> Removed the experimental AI Auto-Sync tool in favor of more predictable and stable local lyrics processing workflows.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="teal">v0.1.7 Updates</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Compact Sync Layout:</strong> Added a new "Compact Background Vocals" feature for the Time tab. This reduces vertical space for background vocals during synchronization, making it easier to manage dense projects. This behavior is toggleable in the Display settings.
								</Text>
								<Text size="2">
									<strong>Smart Space Handling:</strong> Refined synchronization logic to automatically skip over whitespace-only words. Navigation shortcuts like <strong>H</strong> (Set End Time) and <strong>D</strong> (Next Word) now always land on syllables with actual content.
								</Text>
								<Text size="2">
									<strong>Clean Imports:</strong> Standardized lyric cleaning during import to automatically strip backslashes (<code>\</code>) across all major sources (Genius, Lyrically, Text, LRC) for higher project stability and quality.
								</Text>
								<Text size="2">
									<strong>UI Refinements:</strong> Improved word separation in Plain Text imports to cleanly remove delimiters without polluting the project with empty words or markers.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="cyan">v0.1.6 Updates</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Custom Audio Equalizer:</strong> Introduced a professional 10-band equalizer with support for custom presets. Save, name, and manage your own audio profiles for a tailored listening experience.
								</Text>
								<Text size="2">
									<strong>Enhanced EQ Presets:</strong> Added a curated list of built-in presets including Bass Boost, Treble Boost, Vocal Boost, Rock, Jazz, Pop, and more.
								</Text>
								<Text size="2">
									<strong>Persistence:</strong> Equalizer settings and custom presets are now automatically saved and persisted across application sessions.
								</Text>
								<Text size="2">
									<strong>UI Stability Fixes:</strong> Resolved critical layout issues where "space-between" align properties were incorrectly applied, ensuring smoother rendering of settings panels.
								</Text>
								<Text size="2">
									<strong>Type Safety Improvements:</strong> Optimized component prop typing to prevent runtime UI errors and layout shifts.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="teal">v0.1.5 Updates</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Duplicate-to-Spot:</strong> Introduced a "Duplicate to..." workflow. Click indicators between any two lines to instantly place copies of your selection at that exact position.
								</Text>
								<Text size="2">
									<strong>Global Placement Mode:</strong> Activating "Duplicate to" reveals insertion spacers globally across the editor, providing a one-click visual map for project restructuring.
								</Text>
								<Text size="2">
									<strong>Smart Selection Persistence:</strong> Right-clicking no longer clears multi-word selections. This enables powerful bulk operations like "Combine Words" for complex phonetic merging.
								</Text>
								<Text size="2">
									<strong>Continuous Duplication (Shift):</strong> Holding <strong>Shift</strong> while clicking insertion points keeps the placement mode active, allowing for high-speed batch line replication.
								</Text>
								<Text size="2">
									<strong>Clean UI Logic:</strong> Rebuilt the insertion spacer rendering to resolve stacking bugs and collision issues, ensuring a clutter-free interface with perfectly centered placement points.
								</Text>
								<Text size="2">
									<strong>Redo Shortcut:</strong> Updated the Redo shortcut to <strong>Shift + Ctrl + Z</strong> across all platforms for a more intuitive editing workflow.
								</Text>
								<Text size="2">
									<strong>Refined Plain Text Import:</strong> Disabled automatic space padding by default to prevent unwanted spacing in imported projects.
								</Text>
								<Text size="2">
									<strong>Redo Memory:</strong> Optimized state management by limiting the Redo/Undo history to the 10 most recent actions for better performance.
								</Text>
								<Text size="2">
									<strong>Static Highlighting:</strong> Disabled word move animations and glow effects during playback for a more focused and distraction-free synchronization experience.
								</Text>
								<Text size="2">
									<strong>Assistant Tab:</strong> Introduced a dedicated "Assistant" tab in Settings to manage helper features like Quick Fixes and timing visualization in one place.
								</Text>
								<Text size="2">
									<strong>Flexible Syncing:</strong> Added a toggle to enable or disable manual timestamp typing in Sync mode, allowing you to lock timings to prevent accidental changes.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="cyan">v0.1.4 Updates</Heading>
							<Flex direction="column" gap="3">
								
								<Text size="2">
									<strong>Lyrically Engine Integration:</strong> Added a high-reliability alternative lyrics source via the <strong>Lyrically API</strong> (powered by lyrics.ovh). This fallback completely bypasses CORS restrictions and Genius anti-bot measures using server-side aggregation.
								</Text>
								<Text size="2">
									<strong>Bulletproof Scraper Engine:</strong> Rebuilt the Genius scraper with a <strong>Multi-Proxy Rotation</strong> system and deep <code>__PRELOADED_STATE__</code> JSON extraction, ensuring imports work even when the site's layout changes or blocks standard requests.
								</Text>
								<Text size="2">
									<strong>Native CDN Image Loading:</strong> Switched to direct <strong>Genius CDN</strong> and <strong>HTTPS forced</strong> image links for cover arts. This resolves persistent "403 Forbidden" blocks and "Mixed Content" security errors in browser environments.
								</Text>
								<Text size="2">
									<strong>Optimized Import Workflow:</strong> The import menu now features a dedicated <strong>English Translation</strong> layer with better fallbacks and a cleaner, more responsive preview panel for Lyrically-sourced lyrics.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="gold">v0.1.3 Updates</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Multi-Provider Scaling:</strong> Improved backend logic for handling concurrent requests across different lyric providers.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="ruby">v0.1.2 Updates</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Advanced Font Selection Menu:</strong> Replaced the basic font list with a high-performance Gallery interface. Features over 300+ of the most popular Google Fonts and system font stacks for total visual control.
								</Text>
								<Text size="2">
									<strong>Custom Typography Support:</strong> You can now import your own <code>.ttf</code>, <code>.otf</code>, and <code>.woff</code> font files directly. Your custom fonts are securely stored and persist across app sessions.
								</Text>
								<Text size="2">
									<strong>Global Font Variations:</strong> Integrated full support for <strong>Bold</strong> and <em>Italic</em> styles. The tool dynamically fetches the appropriate variants from Google for every library font.
								</Text>
								<Text size="2">
									<strong>Enhanced Font Library UI:</strong> A refined, searchable interface with live previews, categorized list stacks, and improved spacing to handle long font names without clipping.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="teal">v0.1.1 Updates</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Rich Preview Panel:</strong> A new visual preview system for Genius imports that allows you to review, edit, and verify perfectly formatted lyrics before they hit your project.
								</Text>
								<Text size="2">
									<strong>Genius Background Lyric Parser:</strong> Automatically recognizes parenthesized text as background vocals during import, stripping brackets and setting the appropriate background flag.
								</Text>
								<Text size="2">
									<strong>Ultra-Reliable Genius Cover Arts:</strong> Implemented a high-performance image proxy service to ensure Genius cover arts load reliably across all platforms, bypassing hotlink protection.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="blue">v0.1.0 Updates</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Line Sync Mode:</strong> Easily perform macro-level (line-by-line) syncing. Go to Time &gt; Sync Level and set it to Line instead of Word. Pressing "Start Next Word/Line" automatically fills empty beats with proportionately distributed offsets based on syllables.
								</Text>
								<Text size="2">
									<strong>Syllable Chunk Splitting:</strong> The Sub-word split menu gives you the option of "Syllable Split" utilizing native hyphenation processing to instantly distribute polysyllabic words properly.
								</Text>
								<Text size="2">
									<strong>Community Guide Repository:</strong> An interactive catalog is now available on the Import Page with embedded community guides/references for creating perfectly formatted AMLL lyrics.
								</Text>
								<Text size="2">
									<strong>Smart Double Click Editor:</strong> If Quick Fixes is disabled, double clicking skips context evaluation saving resources and opening the inline-editor quickly.
								</Text>
								<Text size="2">
									<strong>Full Genius Lyrics Import:</strong> Directly search and import song lyrics from Genius into the editor. Featuring a direct-from-source scraper with <strong>Auto-Slop Removal</strong> to automatically strip section markers ([Chorus], etc.) and metadata blocks.
								</Text>
							</Flex>
						</Box>
						
						<Box>
							<Heading size="4" mb="2" color="blue">Past Custom Fixes</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Live Spectrogram Alignment:</strong> Drag-and-drop waveform timing adjustments directly onto phonetic events within the Timeline panel. Visually tune your timings against the actual source audio.
								</Text>
								<Text size="2">
									<strong>Sync Keybinding Performance:</strong> Greatly reduced UI freezing issues related to the <code>undoableLyricLinesAtom</code> memory stack overcommits by isolating history snapshots from real-time events.
								</Text>
								<Text size="2">
									<strong>Genius Songwriter Fetcher:</strong> Integrated tool in the metadata editor to automatically fetch songwriting credits using the Genius API.
								</Text>
							</Flex>
						</Box>
					</Flex>
				</ScrollArea>
			</Dialog.Content>
		</Dialog.Root>
	);
}
