import { 
	DismissRegular, 
	StarRegular, 
	FlashRegular, 
	Sparkle24Regular, 
	MusicNote1Regular, 
	SettingsRegular, 
	BoxRegular,
	TranslateRegular,
	RecordRegular,
	InfoRegular,
	TimerRegular,
	CheckmarkCircleRegular,
	ShieldCheckmarkRegular,
	LocalLanguageRegular,
	TaskListLtrRegular
} from "@fluentui/react-icons";
import { Box, Button, Dialog, Flex, Heading, ScrollArea, Text, Card, Grid, Popover, IconButton } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { whatsNewDialogAtom } from "$/states/dialogs.ts";

export function WhatsNewDialog() {
	const [isOpen, setIsOpen] = useAtom(whatsNewDialogAtom);

	const features = [
		{
			title: "Discord Rich Presence",
			description: "Optionally share the current file or track, editor mode, line progress, playback status, and live timeline from the desktop app. Website presence now uses a reliable PreMiD bridge.",
			icon: <MusicNote1Regular />,
			color: "indigo",
			info: "Enable Discord Rich Presence under Settings > General > Privacy in the Tauri desktop app. It stays disabled by default and requires the Discord desktop client."
		},
		{
			title: "Inline Time-Tab Editing",
			description: "Double-click a synced word to edit it directly in Time mode, or edit its per-word romanization when displayed.",
			icon: <FlashRegular />,
			color: "indigo",
			info: "In Time mode, double-clicking a word opens an inline text box to make immediate corrections without switching tabs."
		},
		{
			title: "TTML Checklist",
			description: "Keep a persistent local queue of songs to sync, complete with notes, status tracking, and history.",
			icon: <TaskListLtrRegular />,
			color: "blue",
			info: "Access TTML Checklist from the tools menu to organize your pending lyrics sync tasks and keep notes."
		},
		{
			title: "Smarter Lyrics Splitting",
			description: "Choose dedicated syllabification engines for English, Spanish, French, Russian, Japanese, and CJK lyrics, with legacy fallbacks still available.",
			icon: <MusicNote1Regular />,
			color: "cyan",
			info: "Open Auto Segment to get a language-based engine suggestion before applying it to all lyric lines. Advanced Segmentation exposes the same alphabetized engine list."
		},
		{
			title: "Learned Word Splits",
			description: "Remember manual split boundaries and automatically reuse them whenever the same word appears again.",
			icon: <CheckmarkCircleRegular />,
			color: "grass",
			info: "In the Split Word dialog, enable remembering to save the boundaries you chose. Matching words use that split during future automatic segmentation."
		},
		{
			title: "Persistent Split Options",
			description: "The Split Word dialog remembers the last options you used, so repeated corrections take fewer clicks.",
			icon: <SettingsRegular />,
			color: "violet",
			info: "Your Apply to all, case-sensitivity, and remember-split preferences persist between Split Word sessions."
		},
		{
			title: "Spicy Lyrics Preview",
			description: "A high-fidelity Spicy Lyrics renderer with animated, custom, and cover-art backgrounds; karaoke, Simple Lyrics, and line-synced layouts; automatic scrolling; and an optional FPS counter.",
			icon: <StarRegular />,
			color: "ruby",
			info: "Choose Spicy from the Preview mode selector. It includes interlude dots, RTL- and duet-aware layouts, plus CJK and romanized word wrapping."
		},
		{
			title: "Time Stretch",
			description: "Scale every TTML timestamp to fit a new song duration, with support for reading durations from audio files.",
			icon: <TimerRegular />,
			color: "violet",
			info: "Open Edit > Time Stretch. Set or import the old and new audio durations, then apply the calculated scale factor to the project."
		},
		{
			title: "Unified Lyrics Import",
			description: "Text, LRCLIB, Lyrically, and Genius imports now share one consistent preparation, replacement-confirmation, and formatting workflow.",
			icon: <CheckmarkCircleRegular />,
			color: "grass",
			info: "Use the import screen as usual. Punctuation, CJK/Latin boundaries, word separators, and background vocals are handled consistently across supported sources."
		},
		{
			title: "Genius Header Categorization & Section Tools",
			description: "Preserve headers such as [Chorus] and [Verse] as color-coded section metadata, with whole-section timing controls.",
			icon: <TaskListLtrRegular />,
			color: "pink",
			info: "Enable categorization during a Genius import or when prompted after a text import. In Sync mode, section headers can snap the section to the playhead or copy timing from an earlier matching section."
		},
		{
			title: "Backup & Restore",
			description: "Export and restore selected settings, keybindings, appearance assets, projects and history, and plugins in a portable backup file.",
			icon: <ShieldCheckmarkRegular />,
			color: "teal",
			info: "Open Settings > Backup to select the data to export or restore. Importing replaces the selected existing data and reloads the app."
		},
		{
			title: "Bouncy Word Indicator",
			description: "Long-duration syllables in Sync mode get a subtle bouncing dot, making held words easier to spot while timing.",
			icon: <MusicNote1Regular />,
			color: "orange",
			info: "The CSS-only indicator appears automatically for qualifying words in Sync mode and hides while playback is active."
		},
		{
			title: "Toxi Lyrics Engine",
			description: "High-fidelity jump-down animations, instant-on bloom with smooth fade-out, and adjustable wipe softness.",
			icon: <StarRegular />,
			color: "pink",
			info: "Located in the Preview tab. Controls under Appearance > Preview allow adjusting wipe softness and bloom."
		},
		{
			title: "144Hz+ Rendering",
			description: "Dedicated interpolation engine for ultra-high refresh rates, bypassing React bottlenecks.",
			icon: <FlashRegular />,
			color: "orange",
			info: "Automatically active. Ensures lyrics move smoothly regardless of your monitor's refresh rate."
		},
		{
			title: "Millisecond Precision Sync",
			description: "Interpolated high-resolution performance markers for frame-accurate timing.",
			icon: <TimerRegular />,
			color: "violet",
			info: "Interpolates audio position between browser updates to achieve 1ms precision. Found in Sync mode."
		},
		{
			title: "Cinematic Backgrounds",
			description: "Hardware-accelerated Mesh Gradient backgrounds running at 60 FPS for a premium, alive-feeling UI.",
			icon: <Sparkle24Regular />,
			color: "indigo",
			info: "Change in Appearance > Background. Supports both static images and dynamic gradients."
		},
		{
			title: "Snap to Playhead",
			description: "One-click synchronization that snaps lyric start times directly to the audio playhead position.",
			icon: <RecordRegular />,
			color: "teal",
			info: "In Sync mode, press 'Enter' or the 'Record' button to snap the current line to the music's current time."
		},
		{
			title: "Auto-Lyric Sanitizer",
			description: "Automatically strips Genius tags and cleans empty lines on import.",
			icon: <CheckmarkCircleRegular />,
			color: "grass",
			info: "Filters out strings like [Chorus] or [Verse] and removes whitespace automatically when importing lyrics."
		},
		{
			title: "Advanced Phonetics",
			description: "Professional Mora-aware Japanese Romanization and capsule distribution system.",
			icon: <TranslateRegular />,
			color: "cyan",
			info: "Select Japanese lyrics and use the 'Phonetics' tool in the Ribbon Bar to generate Furigana or Romaji."
		},
		{
			title: "Pre-Export Validator",
			description: "Real-time scan for untimed or overlapping lyrics before saving.",
			icon: <ShieldCheckmarkRegular />,
			color: "red",
			info: "Runs a diagnostic check when you click Export, highlighting lines that are missing timestamps or have timing conflicts."
		},
		{
			title: "Integrated Audio Bridge",
			description: "Built-in FFmpeg.wasm for high-fidelity MP3 to FLAC conversion to eliminate decoding drift.",
			icon: <MusicNote1Regular />,
			color: "blue",
			info: "Triggered when importing non-standard audio formats. Converts them to high-quality FLAC/MP3 for better compatibility."
		},
		{
			title: "Appearance Editor",
			description: "Over 40 granular visual parameters and theme presets to fully customize your editor's look.",
			icon: <SettingsRegular />,
			color: "ruby",
			info: "Access via the Settings icon > Appearance. Customize everything from colors to border radius."
		},
		{
			title: "Global Localization",
			description: "Full i18n support with community-driven translations.",
			icon: <LocalLanguageRegular />,
			color: "blue",
			info: "Switch languages in Settings > General. Currently supporting English, Chinese, and more via Crowdin."
		},
		{
			title: "Community Plugin Store",
			description: "Integrated store to browse and install community-made WASM importers and exporters.",
			icon: <BoxRegular />,
			color: "gold",
			info: "Open via the 'Plugins' tab in the Ribbon Bar to expand the tool's import/export capabilities."
		}
	] as const;

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 850, height: "85vh", maxHeight: 800 }}>
				<Flex justify="between" align="center" mb="4">
					<Flex direction="column">
						<Dialog.Title mb="1">
							What's New in NaeNae's Fork
						</Dialog.Title>
						<Text size="2" color="gray">
							Key improvements over the base AMLL TTML TOOL by stevexmh
						</Text>
					</Flex>
					<Dialog.Close>
						<Button variant="ghost" color="gray">
							<DismissRegular />
						</Button>
					</Dialog.Close>
				</Flex>

				<ScrollArea type="always" scrollbars="vertical" style={{ height: "calc(100% - 80px)" }}>
					<Flex direction="column" gap="4" pr="4">
						<Card variant="surface" style={{ backgroundColor: "var(--accent-2)" }}>
							<Text size="2" style={{ fontStyle: "italic" }}>
								"This fork focuses on professional-grade performance, cinematic visual fidelity, and streamlined synchronization workflows that go beyond the original tool's scope."
							</Text>
						</Card>

						<Grid columns="2" gap="3">
							{features.map((f) => (
								<Card key={f.title} variant="classic" style={{ padding: "var(--space-3)" }}>
									<Flex direction="column" gap="2">
										<Flex align="center" justify="between">
											<Flex align="center" gap="2">
												<Box style={{ color: `var(--${f.color}-11)` }}>
													{f.icon}
												</Box>
												<Heading size="3">{f.title}</Heading>
											</Flex>
											<Popover.Root>
												<Popover.Trigger>
													<IconButton size="1" variant="ghost" color="gray" style={{ cursor: "pointer" }}>
														<InfoRegular />
													</IconButton>
												</Popover.Trigger>
												<Popover.Content style={{ width: 300 }} size="2">
													<Flex direction="column" gap="2">
														<Text size="2" weight="bold" color={f.color}>{f.title}</Text>
														<Text size="2" color="gray">
															{f.info}
														</Text>
													</Flex>
												</Popover.Content>
											</Popover.Root>
										</Flex>
										<Text size="2" color="gray">
											{f.description}
										</Text>
									</Flex>
								</Card>
							))}
						</Grid>

						<Box mt="2" mb="4">
							<Heading size="3" mb="2">Other Enhancements</Heading>
							<Flex direction="column" gap="2">
								<Text size="2">• <strong>V-Sync & FPS Tools</strong>: Real-time performance monitoring.</Text>
								<Text size="2">• <strong>Smart BG Vocal Grouping</strong>: Unified scaling for main and background lines.</Text>
								<Text size="2">• <strong>Refined .ttml Writer</strong>: Optimized metadata handling and cleaner XML output.</Text>
								<Text size="2">• <strong>Modernized UI</strong>: Unified glassmorphism and improved layout stability.</Text>
								<Text size="2">• <strong>Millisecond Timestamps</strong>: Support for high-precision 3-digit millisecond output.</Text>
							</Flex>
						</Box>
					</Flex>
				</ScrollArea>
			</Dialog.Content>
		</Dialog.Root>
	);
}
