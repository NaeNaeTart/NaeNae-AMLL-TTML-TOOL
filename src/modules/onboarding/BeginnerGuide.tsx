import { BookOpen24Regular, DismissRegular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	Heading,
	Progress,
	Text,
} from "@radix-ui/themes";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useFileOpener } from "$/hooks/useFileOpener";
import { audioEngine } from "$/modules/audio/audio-engine";
import { currentDurationAtom } from "$/modules/audio/states";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import {
	geniusApiKeyAtom,
	lyricTextNormalizationOptionsAtom,
} from "$/modules/settings/states";
import {
	geniusImportLyricsDialogAtom,
	importFromLRCLIBDialogAtom,
	importFromTextDialogAtom,
	lyricallyImportLyricsDialogAtom,
	metadataEditorDialogAtom,
	settingsDialogAtom,
	settingsTabAtom,
	ttmlChecklistDialogAtom,
} from "$/states/dialogs";
import {
	lyricLinesAtom,
	saveFileNameAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import { saveFile } from "$/utils/fileSystem";
import {
	GUIDE_STEP_IDS,
	hasCompleteTiming,
	hasImportedLyrics,
	hasNoEmptyLyricLines,
	hasSongwriters,
} from "./logic";
import {
	guideCompletionAtom,
	guideExportedAtom,
	guidePanelOpenAtom,
	guideStepAtom,
	guideWelcomeOpenAtom,
} from "./states";

const DOCS_BASE = "https://docs.tx24.dev/guides/ttml.html";

const GUIDE_COPY = {
	audio: {
		title: "Import the song",
		text: "Choose the exact recording you are making lyrics for. The guide will continue once the audio finishes loading.",
		anchor: "#1-import-the-song",
	},
	lyrics: {
		title: "Import the lyrics",
		text: "Choose a lyrics source below. Review the result in its import window and confirm the import.",
		anchor: "#2-import-the-lyrics",
	},
	review: {
		title: "Check lyrics and line types",
		text: "Read every line against the recording. Double-click words to fix them; select lines to mark background or duet vocals. Remove empty lines, then confirm below.",
		anchor: "#3-check-the-lyrics",
	},
	sync: {
		title: "Sync every word",
		text: "Enter Time mode, select the first word, press Space, then use F to start, G between words, and H at pauses or line endings. Every word must receive a valid time.",
		anchor: "#4-sync-the-lyrics",
	},
	songwriters: {
		title: "Add songwriters",
		text: "Open metadata and use Fetch Songwriters from Genius, or add one Songwriter value per real name. The guide detects when at least one is saved.",
		anchor: "#5-add-songwriters",
	},
	export: {
		title: "Export the TTML",
		text: "Open the checklist and resolve anything relevant. Then save the TTML; this step completes only after a file is actually written.",
		anchor: "#6-export-and-test-the-ttml",
	},
	test: {
		title: "Test locally",
		text: "Upload the saved file in Spicy Lyrics and check parsing, formatting, and timing.",
		anchor: "#test-locally",
	},
} as const;

export const startBeginnerGuide = (
	setWelcome: (open: boolean) => void,
	setPanel: (open: boolean) => void,
	setStep: (step: number) => void,
) => {
	setWelcome(false);
	setStep(0);
	setPanel(true);
};

export const BeginnerGuide = () => {
	const { t } = useTranslation();
	const store = useStore();
	const lyrics = useAtomValue(lyricLinesAtom);
	const duration = useAtomValue(currentDurationAtom);
	const geniusApiKey = useAtomValue(geniusApiKeyAtom);
	const [showGeniusSetup, setShowGeniusSetup] = useState(false);
	const [welcomeOpen, setWelcomeOpen] = useAtom(guideWelcomeOpenAtom);
	const [panelOpen, setPanelOpen] = useAtom(guidePanelOpenAtom);
	const [step, setStep] = useAtom(guideStepAtom);
	const [exported, setExported] = useAtom(guideExportedAtom);
	const [completion, setCompletion] = useAtom(guideCompletionAtom);
	const [tucked, setTucked] = useState(false);
	const [position, setPosition] = useState({ x: 16, y: 88 });
	const dragOffset = useRef({ x: 0, y: 0 });
	const setImportText = useSetAtom(importFromTextDialogAtom);
	const setImportGenius = useSetAtom(geniusImportLyricsDialogAtom);
	const setImportLrclib = useSetAtom(importFromLRCLIBDialogAtom);
	const setImportLyrically = useSetAtom(lyricallyImportLyricsDialogAtom);
	const setMetadata = useSetAtom(metadataEditorDialogAtom);
	const setChecklist = useSetAtom(ttmlChecklistDialogAtom);
	const setToolMode = useSetAtom(toolModeAtom);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const { openFile } = useFileOpener();

	useEffect(() => {
		setPosition((current) => ({
			x: current.x === 16 ? Math.max(8, window.innerWidth - 336) : current.x,
			y: current.y,
		}));
	}, []);

	useEffect(() => {
		const keepOnScreen = () =>
			setPosition((current) => ({
				x: Math.min(
					Math.max(8, current.x),
					Math.max(8, window.innerWidth - 328),
				),
				y: Math.min(
					Math.max(8, current.y),
					Math.max(8, window.innerHeight - 80),
				),
			}));
		window.addEventListener("resize", keepOnScreen);
		return () => window.removeEventListener("resize", keepOnScreen);
	}, []);

	const startDragging = useCallback(
		(event: ReactPointerEvent<HTMLElement>) => {
			if ((event.target as HTMLElement).closest("button, a")) return;
			event.preventDefault();
			dragOffset.current = {
				x: event.clientX - position.x,
				y: event.clientY - position.y,
			};
			const move = (moveEvent: PointerEvent) => {
				setPosition({
					x: Math.min(
						Math.max(8, moveEvent.clientX - dragOffset.current.x),
						Math.max(8, window.innerWidth - 328),
					),
					y: Math.min(
						Math.max(8, moveEvent.clientY - dragOffset.current.y),
						Math.max(8, window.innerHeight - 80),
					),
				});
			};
			const stop = () => {
				window.removeEventListener("pointermove", move);
				window.removeEventListener("pointerup", stop);
			};
			window.addEventListener("pointermove", move);
			window.addEventListener("pointerup", stop, { once: true });
		},
		[position.x, position.y],
	);

	useEffect(() => {
		if (completion !== "new") return;
		setCompletion("dismissed");
		setWelcomeOpen(true);
	}, [completion, setCompletion, setWelcomeOpen]);

	const start = useCallback(() => {
		setExported(false);
		startBeginnerGuide(setWelcomeOpen, setPanelOpen, setStep);
	}, [setExported, setPanelOpen, setStep, setWelcomeOpen]);

	const openExisting = useCallback(() => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".ttml,*/*";
		input.addEventListener(
			"change",
			() => {
				const file = input.files?.[0];
				if (file) openFile(file);
			},
			{ once: true },
		);
		input.click();
		setCompletion("dismissed");
		setWelcomeOpen(false);
	}, [openFile, setCompletion, setWelcomeOpen]);

	const stepComplete = useMemo(() => {
		const id = GUIDE_STEP_IDS[step];
		if (id === "audio") return duration > 0 || audioEngine.musicLoaded;
		if (id === "lyrics") return hasImportedLyrics(lyrics);
		if (id === "review") return false;
		if (id === "sync") return hasCompleteTiming(lyrics);
		if (id === "songwriters") return hasSongwriters(lyrics);
		if (id === "export") return exported;
		return false;
	}, [duration, exported, lyrics, step]);

	const pickAudio = useCallback(() => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "audio/*,*/*";
		input.addEventListener(
			"change",
			() => {
				const file = input.files?.[0];
				if (file) openFile(file);
			},
			{ once: true },
		);
		input.click();
	}, [openFile]);

	const doAction = useCallback(async () => {
		const id = GUIDE_STEP_IDS[step];
		if (id === "audio") pickAudio();
		if (id === "lyrics") setImportText(true);
		if (id === "review") {
			setToolMode(ToolMode.Edit);
			if (hasNoEmptyLyricLines(lyrics)) setStep(step + 1);
		}
		if (id === "sync") setToolMode(ToolMode.Sync);
		if (id === "songwriters") setMetadata(true);
		if (id === "export") {
			const text = exportTTMLText(
				lyrics,
				store.get(lyricTextNormalizationOptionsAtom),
			);
			const saved = await saveFile(text, {
				suggestedName: store.get(saveFileNameAtom),
				types: [
					{
						description: "TTML Files",
						accept: { "application/ttml+xml": [".ttml"] },
					},
				],
			});
			if (saved) setExported(true);
		}
		if (id === "test")
			window.open(`${DOCS_BASE}#test-locally`, "_blank", "noopener,noreferrer");
	}, [
		lyrics,
		pickAudio,
		setExported,
		setImportText,
		setMetadata,
		setStep,
		setToolMode,
		step,
		store,
	]);

	const finish = () => {
		setCompletion("completed");
		setPanelOpen(false);
	};
	const continueGuide = () => {
		if (step < GUIDE_STEP_IDS.length - 1) setStep(step + 1);
	};

	const currentId = GUIDE_STEP_IDS[Math.min(step, GUIDE_STEP_IDS.length - 1)];
	const copy = GUIDE_COPY[currentId];
	const waitingText =
		currentId === "audio"
			? "Use “Choose audio” below, then wait for loading to finish."
			: currentId === "lyrics"
				? "Choose one source below and finish its import window."
				: currentId === "review"
					? hasNoEmptyLyricLines(lyrics)
						? "The structure is valid. Finish reading the lyrics, then confirm your review."
						: "At least one empty lyric line remains. Delete or fill it before confirming."
					: currentId === "sync"
						? "Open Time mode and keep timing; this completes when every applicable word has a valid start and end."
						: currentId === "songwriters"
							? "Open metadata and add at least one non-empty Songwriter value."
							: currentId === "export"
								? "Review the checklist, then choose Save TTML and complete the file picker."
								: "Open the local testing instructions, verify the file in Spicy Lyrics, then finish the guide.";

	useEffect(() => {
		if (!panelOpen) return;
		const selector =
			currentId === "audio"
				? '[data-guide-target="audio"]'
				: currentId === "review"
					? '[data-guide-target="editor"]'
					: currentId === "sync"
						? '[data-guide-target="ribbon"]'
						: undefined;
		if (!selector) return;
		const target = document.querySelector<HTMLElement>(selector);
		if (!target) return;
		const previousOutline = target.style.outline;
		const previousOffset = target.style.outlineOffset;
		target.style.outline = "3px solid var(--accent-9)";
		target.style.outlineOffset = "-3px";
		target.scrollIntoView({ behavior: "smooth", block: "nearest" });
		return () => {
			target.style.outline = previousOutline;
			target.style.outlineOffset = previousOffset;
		};
	}, [currentId, panelOpen]);

	return (
		<>
			<Dialog.Root open={welcomeOpen} onOpenChange={setWelcomeOpen}>
				<Dialog.Content maxWidth="560px">
					<Dialog.Title>
						{t("beginnerGuide.welcome.title", "Make your first synced TTML")}
					</Dialog.Title>
					<Dialog.Description>
						{t(
							"beginnerGuide.welcome.description",
							"The guide stays with you, opens the right tools, and waits until each required task is actually complete.",
						)}
					</Dialog.Description>
					<Flex direction="column" gap="2" mt="4">
						<Button size="3" onClick={start}>
							{t("beginnerGuide.welcome.own", "Guide me through my first TTML")}
						</Button>
						<Button variant="outline" onClick={openExisting}>
							{t("beginnerGuide.welcome.open", "Open an existing TTML")}
						</Button>
						<Button
							variant="ghost"
							color="gray"
							onClick={() => {
								setCompletion("dismissed");
								setWelcomeOpen(false);
							}}
						>
							{t("beginnerGuide.welcome.skip", "Skip for now")}
						</Button>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>
			<AnimatePresence>
				{panelOpen && tucked && (
					<motion.div
						key="tucked-button"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						style={{
							position: "fixed",
							right: 0,
							top: "45%",
							zIndex: 10000,
							paddingLeft: "40px",
							paddingTop: "10px",
							paddingBottom: "10px",
							transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s",
							transform: "translateX(60%)",
							opacity: 0.7,
							cursor: "pointer",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.transform = "translateX(0)";
							e.currentTarget.style.opacity = "1";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = "translateX(60%)";
							e.currentTarget.style.opacity = "0.7";
						}}
					>
						<Button
							style={{
								borderRadius: "var(--radius-3) 0 0 var(--radius-3)",
								boxShadow: "var(--shadow-4)",
								cursor: "pointer",
							}}
							onClick={() => setTucked(false)}
						>
							<BookOpen24Regular style={{ marginRight: "4px" }} />
							{t("beginnerGuide.restore", "Show guide")}
						</Button>
					</motion.div>
				)}
				{panelOpen && !tucked && (
					<motion.div
						key="guide-card"
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.95 }}
						transition={{ duration: 0.2 }}
						style={{
							position: "fixed",
							left: position.x,
							top: position.y,
							width: 320,
							zIndex: 10000,
						}}
					>
						<Card
							data-beginner-guide
							style={{
								width: "100%",
								boxShadow: "var(--shadow-5)",
								backgroundColor: "var(--color-panel-solid)",
								backdropFilter: "none",
							}}
						>
					<Flex direction="column" gap="3">
						<Flex
							justify="between"
							align="center"
							onPointerDown={startDragging}
							style={{
								cursor: "grab",
								userSelect: "none",
								touchAction: "none",
							}}
						>
							<Text size="1" color="gray">
								{t("beginnerGuide.progress", "Step {current} of {total}", {
									current: step + 1,
									total: GUIDE_STEP_IDS.length,
								})}
							</Text>
							<Flex gap="1">
								<Button
									size="1"
									variant="ghost"
									color="gray"
									onClick={() => setTucked(true)}
								>
									{t("beginnerGuide.tuck", "Tuck")}
								</Button>
								<Button
									size="1"
									variant="ghost"
									color="gray"
									onClick={() => {
										setCompletion("dismissed");
										setPanelOpen(false);
									}}
								>
									<DismissRegular /> {t("beginnerGuide.exit", "Exit guide")}
								</Button>
							</Flex>
						</Flex>
						<Progress value={((step + 1) / GUIDE_STEP_IDS.length) * 100} />
						<Box>
							<Heading size="4">
								{t(`beginnerGuide.steps.${currentId}.title`, copy.title)}
							</Heading>
							<Text size="2" color="gray">
								{t(`beginnerGuide.steps.${currentId}.description`, copy.text)}
							</Text>
							{currentId === "audio" && (
								<Box
									mt="2"
									p="2"
									style={{
										borderLeft: "2px solid var(--accent-8)",
										background: "var(--gray-a3)",
										borderRadius: "var(--radius-1)",
									}}
								>
									<Text size="1" weight="bold" style={{ display: "block", marginBottom: "2px", color: "var(--accent-11)" }}>
										{t("beginnerGuide.beforeStart.title", "Before you start:")}
									</Text>
									<Text size="1" color="gray">
										{t(
											"beginnerGuide.beforeStart.text",
											"You can change the appearance of the editor to suit your preference. Click below to open settings. Feel free to try the Basic Editor, or check out the Advanced Editor for complete detail control.",
										)}{" "}
										<a
											href="#"
											onClick={(e) => {
												e.preventDefault();
												setSettingsTab("appearance");
												setSettingsOpen(true);
											}}
											style={{
												color: "var(--accent-11)",
												textDecoration: "underline",
												fontWeight: "bold",
											}}
										>
											{t("beginnerGuide.beforeStart.link", "Customize Editor Appearance")}
										</a>
									</Text>
								</Box>
							)}
						</Box>
						<Card
							variant="surface"
							style={{
								background: stepComplete ? "var(--green-3)" : "var(--accent-3)",
							}}
						>
							<Text size="2" weight="medium">
								{stepComplete
									? t(
											"beginnerGuide.status.complete",
											"Done — the tool detected this step is complete.",
										)
									: t(`beginnerGuide.steps.${currentId}.waiting`, waitingText)}
							</Text>
						</Card>
						<Flex gap="2" wrap="wrap">
							{stepComplete ? (
								<Button color="green" onClick={continueGuide}>
									{t("beginnerGuide.continue", "Continue")}
								</Button>
							) : currentId === "lyrics" ? (
								<>
									<Button
										onClick={() =>
											geniusApiKey
												? setImportGenius(true)
												: setShowGeniusSetup(true)
										}
									>
										{geniusApiKey
											? "Genius"
											: t("beginnerGuide.genius.setup", "Set up Genius")}
									</Button>
									<Button variant="soft" onClick={() => setImportLrclib(true)}>
										LRCLIB
									</Button>
									<Button variant="soft" onClick={() => setImportText(true)}>
										{t("beginnerGuide.import.plain", "Plain text")}
									</Button>
									<Button
										variant="soft"
										onClick={() => setImportLyrically(true)}
									>
										Lyrically
									</Button>
								</>
							) : (
								<>
									{currentId === "export" && (
										<Button variant="soft" onClick={() => setChecklist(true)}>
											{t("beginnerGuide.checklist", "Open checklist")}
										</Button>
									)}
									<Button onClick={() => void doAction()}>
										{currentId === "review"
											? t(
													"beginnerGuide.review.confirm",
													"I checked the lyrics",
												)
											: currentId === "test"
												? t("beginnerGuide.test.open", "Open testing steps")
												: currentId === "audio"
													? t("beginnerGuide.audio.choose", "Choose audio")
													: currentId === "sync"
														? t("beginnerGuide.sync.open", "Open Time mode")
														: currentId === "songwriters"
															? t(
																	"beginnerGuide.songwriters.open",
																	"Open metadata",
																)
															: t("beginnerGuide.export.save", "Save TTML")}
									</Button>
								</>
							)}
							<Button
								variant="soft"
								disabled={step === 0}
								onClick={() => setStep(Math.max(0, step - 1))}
							>
								{t("common.back", "Back")}
							</Button>
							<Button
								variant="ghost"
								onClick={() =>
									window.open(
										`${DOCS_BASE}${copy.anchor}`,
										"_blank",
										"noopener,noreferrer",
									)
								}
							>
								<BookOpen24Regular />{" "}
								{t("beginnerGuide.readMore", "Full guide")}
							</Button>
						</Flex>
						{currentId === "lyrics" && showGeniusSetup && !geniusApiKey && (
							<Card variant="surface">
								<Flex direction="column" gap="2">
									<Flex justify="between" align="center">
										<Text weight="bold">
											{t(
												"beginnerGuide.genius.title",
												"Create a Genius Client Access Token",
											)}
										</Text>
										<Button
											size="1"
											variant="ghost"
											color="gray"
											onClick={() => setShowGeniusSetup(false)}
										>
											{t("common.close", "Close")}
										</Button>
									</Flex>
									<Text size="2">
										{t(
											"beginnerGuide.genius.step1",
											"1. Open Genius API Clients and sign in.",
										)}
									</Text>
									<Text size="2">
										{t(
											"beginnerGuide.genius.step2",
											"2. Select New API Client, give it any recognizable app name, and fill the required app website field.",
										)}
									</Text>
									<Text size="2">
										{t(
											"beginnerGuide.genius.step3",
											"3. Save the client, then select Generate Access Token.",
										)}
									</Text>
									<Text size="2">
										{t(
											"beginnerGuide.genius.step4",
											"4. Copy the Client Access Token—not the Client ID or Client Secret.",
										)}
									</Text>
									<Text size="1" color="gray">
										{t(
											"beginnerGuide.genius.reuse",
											"The tool stores this token locally and reuses it for lyric imports and songwriter lookup.",
										)}
									</Text>
									<Flex gap="2" wrap="wrap">
										<Button
											variant="soft"
											onClick={() =>
												window.open(
													"https://genius.com/api-clients",
													"_blank",
													"noopener,noreferrer",
												)
											}
										>
											{t(
												"beginnerGuide.genius.openPortal",
												"Open Genius API Clients",
											)}
										</Button>
										<Button onClick={() => setImportGenius(true)}>
											{t(
												"beginnerGuide.genius.paste",
												"Paste token in Genius import",
											)}
										</Button>
									</Flex>
								</Flex>
							</Card>
						)}
						{currentId === "test" && (
							<Button color="green" onClick={finish}>
								{t("beginnerGuide.finish", "Finish guide")}
							</Button>
						)}
					</Flex>
				</Card>
					</motion.div>
			)}
			</AnimatePresence>
		</>
	);
};
