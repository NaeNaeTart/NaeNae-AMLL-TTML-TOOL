import {
	ArrowSwapRegular,
	ArrowSync16Regular,
	Copy16Regular,
	DocumentArrowUp16Regular,
	Open16Regular,
	Save16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Button,
	Callout,
	Dialog,
	Flex,
	RadioGroup,
	Text,
	TextArea,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { parseLyric as parseTTML } from "$/modules/project/logic/ttml-parser";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import { allowConsecutiveBackgroundLinesAtom } from "$/modules/settings/states";
import { lyricsfileConverterDialogAtom } from "$/states/dialogs.ts";
import {
	ActiveFileKind,
	activeFileKindAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	saveFileNameAtom,
	stripKnownFileExtension,
} from "$/states/main.ts";
import { openFileWithDialog } from "$/utils/fileDialog.ts";
import { saveFile } from "$/utils/fileSystem.ts";
import { error as logError } from "$/utils/logging.ts";
import { exportLyricsfileText, parseLyricsfile } from "./index.ts";

type Direction = "ttml-to-lyricsfile" | "lyricsfile-to-ttml";

const OUTPUT_EXTENSION: Record<Direction, string> = {
	"ttml-to-lyricsfile": "lyricsfile.yaml",
	"lyricsfile-to-ttml": "ttml",
};

function detectDirection(fileName: string): Direction | null {
	const lower = fileName.toLowerCase();
	if (lower.endsWith(".lyricsfile.yaml") || lower.endsWith(".yaml")) {
		return "lyricsfile-to-ttml";
	}
	if (lower.endsWith(".ttml")) {
		return "ttml-to-lyricsfile";
	}
	return null;
}

export const LyricsfileConverterDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(lyricsfileConverterDialogAtom);
	const [direction, setDirection] = useState<Direction>("ttml-to-lyricsfile");
	const [inputText, setInputText] = useState("");
	const [outputText, setOutputText] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [sourceFileName, setSourceFileName] = useState("");
	const [isDragging, setIsDragging] = useState(false);
	const setNewLyricLines = useSetAtom(newLyricLinesAtom);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const setActiveFileKind = useSetAtom(activeFileKindAtom);
	const currentLyricLines = useAtomValue(lyricLinesAtom);
	const currentFileKind = useAtomValue(activeFileKindAtom);
	const currentSaveFileName = useAtomValue(saveFileNameAtom);
	const allowConsecutiveBackgroundLines = useAtomValue(
		allowConsecutiveBackgroundLinesAtom,
	);

	const convert = useCallback(
		(text: string, dir: Direction) => {
			setErrorMessage("");
			try {
				if (dir === "ttml-to-lyricsfile") {
					const parsed = parseTTML(text);
					setOutputText(exportLyricsfileText(parsed));
				} else {
					const parsed = parseLyricsfile(text);
					setOutputText(
						exportTTMLText(parsed, undefined, {
							allowConsecutiveBackgroundLines,
						}),
					);
				}
			} catch (e) {
				logError("Lyricsfile conversion failed", e);
				setOutputText("");
				setErrorMessage(e instanceof Error ? e.message : String(e));
			}
		},
		[allowConsecutiveBackgroundLines],
	);

	const handleTextChange = useCallback(
		(value: string) => {
			setInputText(value);
			if (value.trim().length > 0) {
				convert(value, direction);
			} else {
				setOutputText("");
				setErrorMessage("");
			}
		},
		[convert, direction],
	);

	const handleFile = useCallback(
		async (file: File) => {
			const detected = detectDirection(file.name);
			const dir = detected ?? direction;
			if (detected && detected !== direction) {
				setDirection(detected);
			}
			setSourceFileName(file.name);
			try {
				const text = await file.text();
				setInputText(text);
				convert(text, dir);
			} catch (e) {
				logError("Failed to read file", e);
				setErrorMessage(e instanceof Error ? e.message : String(e));
			}
		},
		[convert, direction],
	);

	const onSelectFile = useCallback(async () => {
		const file = await openFileWithDialog({
			multiple: false,
			filters: [
				{
					name: "Lyrics files",
					extensions: ["ttml", "yaml", "lyricsfile.yaml"],
				},
			],
		});
		if (!file || Array.isArray(file)) return;
		await handleFile(file);
	}, [handleFile]);

	const onUseLoadedFile = useCallback(() => {
		const dir: Direction =
			currentFileKind === ActiveFileKind.Lyricsfile
				? "lyricsfile-to-ttml"
				: "ttml-to-lyricsfile";
		const text =
			currentFileKind === ActiveFileKind.Lyricsfile
				? exportLyricsfileText(currentLyricLines)
				: exportTTMLText(currentLyricLines);
		setDirection(dir);
		setSourceFileName(currentSaveFileName);
		setInputText(text);
		convert(text, dir);
	}, [convert, currentFileKind, currentLyricLines, currentSaveFileName]);

	const onSaveOutput = useCallback(async () => {
		if (!outputText) return;
		const baseName = stripKnownFileExtension(sourceFileName || "lyric");
		const extension = OUTPUT_EXTENSION[direction];
		try {
			const saved = await saveFile(outputText, {
				suggestedName: `${baseName}.${extension}`,
				types: [
					{
						description: `${direction === "ttml-to-lyricsfile" ? "Lyricsfile YAML" : "TTML"} Files`,
						accept: {
							"text/plain": [`.${extension}`],
						},
					},
				],
			});
			if (saved) {
				toast.success(
					t("lyricsfileConverter.saved", "Converted file saved as {name}", {
						name: saved,
					}),
				);
			}
		} catch (e) {
			logError("Failed to save converted file", e);
			toast.error(
				t("lyricsfileConverter.saveFailed", "Failed to save converted file"),
			);
		}
	}, [direction, outputText, sourceFileName, t]);

	const onCopyOutput = useCallback(async () => {
		if (!outputText) return;
		await navigator.clipboard.writeText(outputText);
		toast.success(t("lyricsfileConverter.copied", "Copied to clipboard"));
	}, [outputText, t]);

	const onLoadIntoEditor = useCallback(() => {
		if (!outputText) return;
		try {
			const parsed =
				direction === "lyricsfile-to-ttml"
					? parseTTML(outputText)
					: parseLyricsfile(outputText);
			setNewLyricLines(parsed);
			const extension = OUTPUT_EXTENSION[direction];
			setSaveFileName(
				`${stripKnownFileExtension(sourceFileName || "lyric")}.${extension}`,
			);
			setActiveFileKind(
				direction === "ttml-to-lyricsfile"
					? ActiveFileKind.Lyricsfile
					: ActiveFileKind.TTML,
			);
			setOpen(false);
			toast.success(
				t(
					"lyricsfileConverter.loadedIntoEditor",
					"Converted lyrics loaded into the editor",
				),
			);
		} catch (e) {
			logError("Failed to load converted lyrics into editor", e);
			setErrorMessage(e instanceof Error ? e.message : String(e));
		}
	}, [
		direction,
		outputText,
		setNewLyricLines,
		setOpen,
		setSaveFileName,
		setActiveFileKind,
		sourceFileName,
		t,
	]);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="760px">
				<Dialog.Title>
					<Flex align="center" gap="2">
						<ArrowSwapRegular />
						{t("lyricsfileConverter.title", "Lyricsfile Converter")}
						<Badge color="amber" variant="soft">
							BETA
						</Badge>
					</Flex>
				</Dialog.Title>
				<Dialog.Description size="2" mb="3" color="gray">
					{t(
						"lyricsfileConverter.description",
						"Bidirectional converter between TTML and Lyricsfile (.lyricsfile.yaml). Drop a file, pick one, or paste the content below.",
					)}
				</Dialog.Description>

				<Flex direction="column" gap="4">
					<RadioGroup.Root
						value={direction}
						onValueChange={(v) => {
							const next = v as Direction;
							setDirection(next);
							if (inputText.trim().length > 0) {
								convert(inputText, next);
							}
						}}
					>
						<Flex direction="column" gap="2">
							<RadioGroup.Item value="ttml-to-lyricsfile">
								{t(
									"lyricsfileConverter.directionTtmlToYaml",
									"TTML → Lyricsfile (YAML)",
								)}
							</RadioGroup.Item>
							<RadioGroup.Item value="lyricsfile-to-ttml">
								{t(
									"lyricsfileConverter.directionYamlToTtml",
									"Lyricsfile (YAML) → TTML",
								)}
							</RadioGroup.Item>
						</Flex>
					</RadioGroup.Root>

					<Flex
						direction="column"
						gap="2"
						style={{
							border: "1px dashed var(--gray-7)",
							borderRadius: "8px",
							padding: "16px",
							backgroundColor: isDragging ? "var(--accent-a3)" : "transparent",
							transition: "background-color 0.15s",
						}}
						onDragOver={(e) => {
							e.preventDefault();
							setIsDragging(true);
						}}
						onDragLeave={(e) => {
							if (!e.currentTarget.contains(e.relatedTarget as Node)) {
								setIsDragging(false);
							}
						}}
						onDrop={(e) => {
							e.preventDefault();
							setIsDragging(false);
							const file = e.dataTransfer.files?.[0];
							if (file) {
								void handleFile(file);
							}
						}}
					>
						<Text size="2" align="center" color="gray">
							{t(
								"lyricsfileConverter.dropHint",
								"Drag & drop a .ttml or .lyricsfile.yaml file here",
							)}
						</Text>
						<Flex justify="center" gap="2" wrap="wrap">
							<Button variant="soft" onClick={onSelectFile}>
								<Open16Regular />
								{t("lyricsfileConverter.selectFile", "Select file...")}
							</Button>
							<Button
								variant="soft"
								onClick={onUseLoadedFile}
								disabled={currentLyricLines.lyricLines.length === 0}
							>
								<DocumentArrowUp16Regular />
								{t(
									"lyricsfileConverter.useLoadedFile",
									"Use file loaded in editor",
								)}
							</Button>
						</Flex>
					</Flex>

					<Flex direction="column" gap="2">
						<Text size="2" weight="bold">
							{t(
								"lyricsfileConverter.inputLabel",
								"Input (auto-converts while typing)",
							)}
						</Text>
						<TextArea
							value={inputText}
							onChange={(e) => handleTextChange(e.target.value)}
							placeholder={t(
								"lyricsfileConverter.inputPlaceholder",
								"Paste TTML or Lyricsfile content here...",
							)}
							style={{ minHeight: "160px", fontFamily: "monospace" }}
							spellCheck={false}
						/>
					</Flex>

					{errorMessage && (
						<Callout.Root color="red" size="1">
							<Callout.Text style={{ wordBreak: "break-word" }}>
								{t(
									"lyricsfileConverter.conversionFailed",
									"Conversion failed: {error}",
									{ error: errorMessage },
								)}
							</Callout.Text>
						</Callout.Root>
					)}

					<Flex direction="column" gap="2">
						<Text size="2" weight="bold">
							{t("lyricsfileConverter.outputLabel", "Output preview")}
						</Text>
						<TextArea
							value={outputText}
							readOnly
							placeholder={t(
								"lyricsfileConverter.outputPlaceholder",
								"Converted content will appear here...",
							)}
							style={{ minHeight: "160px", fontFamily: "monospace" }}
							spellCheck={false}
						/>
					</Flex>
				</Flex>

				<Flex gap="3" mt="5" justify="end" wrap="wrap">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.close", "Close")}
						</Button>
					</Dialog.Close>
					<Button
						variant="soft"
						disabled={!outputText}
						onClick={onLoadIntoEditor}
					>
						<ArrowSync16Regular />
						{t("lyricsfileConverter.loadIntoEditor", "Load into editor")}
					</Button>
					<Button variant="soft" disabled={!outputText} onClick={onCopyOutput}>
						<Copy16Regular />
						{t("lyricsfileConverter.copy", "Copy")}
					</Button>
					<Button disabled={!outputText} onClick={onSaveOutput}>
						<Save16Regular />
						{t("lyricsfileConverter.save", "Save as...")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
