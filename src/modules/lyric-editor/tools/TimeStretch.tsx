import { ArrowRightRegular } from "@fluentui/react-icons";
import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useAtom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { currentDurationAtom } from "$/modules/audio/states";
import { timeStretchDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import {
	formatDurationInput,
	parseDurationInput,
	readAudioDurationMs,
	scaleTTMLTimings,
} from "./time-stretch";

type DurationFieldProps = {
	label: string;
	value: string;
	onChange: (value: string) => void;
	onUseCurrent: () => void;
	currentSongAvailable: boolean;
	error?: string;
	secondaryAction?: ReactNode;
	footer?: ReactNode;
};

const DurationField = ({
	label,
	value,
	onChange,
	onUseCurrent,
	currentSongAvailable,
	error,
	secondaryAction,
	footer,
}: DurationFieldProps) => {
	const { t } = useTranslation();
	const parsedDuration = parseDurationInput(value);
	return (
		<Flex direction="column" gap="3" style={{ minWidth: 0 }}>
			<Text size="3" weight="bold" align="center">
				{label}
			</Text>
			<TextField.Root
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onBlur={() =>
					parsedDuration !== null &&
					onChange(formatDurationInput(parsedDuration))
				}
				placeholder={t(
					"timeStretchDialog.durationPlaceholder",
					"MM:SS.mmm or seconds",
				)}
				style={{ width: "100%" }}
			/>
			{secondaryAction ? (
				<Flex gap="2" style={{ width: "100%" }}>
					<Button
						variant="soft"
						disabled={!currentSongAvailable}
						onClick={onUseCurrent}
						style={{ flex: 1 }}
					>
						{t("timeStretchDialog.useCurrentSong", "Use current song")}
					</Button>
					{secondaryAction}
				</Flex>
			) : (
				<Button
					variant="soft"
					disabled={!currentSongAvailable}
					onClick={onUseCurrent}
					style={{ width: "100%" }}
				>
					{t("timeStretchDialog.useCurrentSong", "Use current song")}
				</Button>
			)}
			{error && (
				<Text size="1" color="red">
					{error}
				</Text>
			)}
			{footer}
		</Flex>
	);
};

export const TimeStretchDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(timeStretchDialogAtom);
	const store = useStore();
	const setLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [oldDurationInput, setOldDurationInput] = useState("");
	const [newDurationInput, setNewDurationInput] = useState("");
	const [oldTemporaryFileName, setOldTemporaryFileName] = useState("");
	const [newTemporaryFileName, setNewTemporaryFileName] = useState("");
	const [oldTemporaryAudioError, setOldTemporaryAudioError] = useState("");
	const [newTemporaryAudioError, setNewTemporaryAudioError] = useState("");
	const [readingTemporaryAudio, setReadingTemporaryAudio] = useState(false);
	const durationReadId = useRef(0);

	const currentSongDuration = useAtomValue(currentDurationAtom);
	const currentSongAvailable = currentSongDuration > 0;
	const oldDuration = useMemo(
		() => parseDurationInput(oldDurationInput),
		[oldDurationInput],
	);
	const newDuration = useMemo(
		() => parseDurationInput(newDurationInput),
		[newDurationInput],
	);
	const durationsValid =
		oldDuration !== null &&
		oldDuration > 0 &&
		newDuration !== null &&
		newDuration > 0;
	const scaleFactor = durationsValid ? newDuration / oldDuration : null;
	const durationsMatch = scaleFactor === 1;

	useEffect(() => {
		if (open) {
			const duration = store.get(currentDurationAtom);
			setOldDurationInput(duration > 0 ? formatDurationInput(duration) : "");
			setNewDurationInput("");
			setOldTemporaryFileName("");
			setNewTemporaryFileName("");
			setOldTemporaryAudioError("");
			setNewTemporaryAudioError("");
			setReadingTemporaryAudio(false);
		} else {
			durationReadId.current += 1;
		}
	}, [open, store]);

	const fillFromCurrentSong = (setValue: (value: string) => void) => {
		const duration = store.get(currentDurationAtom);
		if (duration > 0) setValue(formatDurationInput(duration));
	};

	const chooseTemporaryAudio = (side: "old" | "new") => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "audio/*,*/*";
		input.addEventListener(
			"change",
			async () => {
				const file = input.files?.[0];
				if (!file) return;
				const readId = ++durationReadId.current;
				setReadingTemporaryAudio(true);
				if (side === "old") setOldTemporaryAudioError("");
				else setNewTemporaryAudioError("");
				try {
					const duration = await readAudioDurationMs(file);
					if (readId !== durationReadId.current) return;
					if (side === "old") {
						setOldDurationInput(formatDurationInput(duration));
						setOldTemporaryFileName(file.name);
					} else {
						setNewDurationInput(formatDurationInput(duration));
						setNewTemporaryFileName(file.name);
					}
				} catch {
					if (readId !== durationReadId.current) return;
					const error = t(
						"timeStretchDialog.audioReadError",
						"Could not read the selected audio file's duration.",
					);
					if (side === "old") setOldTemporaryAudioError(error);
					else setNewTemporaryAudioError(error);
				} finally {
					if (readId === durationReadId.current) {
						setReadingTemporaryAudio(false);
					}
				}
			},
			{ once: true },
		);
		input.click();
	};

	const durationError = (value: string, duration: number | null) => {
		if (!value) return undefined;
		if (duration === null)
			return t("timeStretchDialog.invalidDuration", "Enter a valid duration.");
		if (duration <= 0)
			return t(
				"timeStretchDialog.positiveDuration",
				"Duration must be greater than zero.",
			);
		return undefined;
	};

	const handleApply = () => {
		if (!durationsValid || scaleFactor === null || durationsMatch) return;
		setLyricLines((draft) => scaleTTMLTimings(draft, scaleFactor));
		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content
				maxWidth="740px"
				style={{ minHeight: "320px", display: "flex", flexDirection: "column" }}
			>
				<Dialog.Title>
					{t("timeStretchDialog.title", "Time Stretch")}
				</Dialog.Title>
				<Dialog.Description size="3" mb="7">
					{t(
						"timeStretchDialog.description",
						"Stretch or squeeze every TTML timestamp to fit a new song duration.",
					)}
				</Dialog.Description>
				<Flex direction="column" gap="5">
					<Flex gap="5" align="start">
						<Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
							<DurationField
								label={t("timeStretchDialog.oldDuration", "Old song duration")}
								value={oldDurationInput}
								onChange={setOldDurationInput}
								onUseCurrent={() => fillFromCurrentSong(setOldDurationInput)}
								currentSongAvailable={currentSongAvailable}
								error={durationError(oldDurationInput, oldDuration)}
								secondaryAction={
									<Button
										variant="soft"
										onClick={() => chooseTemporaryAudio("old")}
										disabled={readingTemporaryAudio}
										style={{ flex: 1 }}
									>
										{readingTemporaryAudio
											? t("timeStretchDialog.readingAudio", "Reading audio...")
											: t("timeStretchDialog.chooseAudio", "Upload audio...")}
									</Button>
								}
								footer={
									(oldTemporaryFileName || oldTemporaryAudioError) && (
										<Flex direction="column" gap="1">
											{oldTemporaryFileName && (
												<Text size="1" color="gray">
													{oldTemporaryFileName}
												</Text>
											)}
											{oldTemporaryAudioError && (
												<Text size="1" color="red">
													{oldTemporaryAudioError}
												</Text>
											)}
										</Flex>
									)
								}
							/>
						</Flex>
						<Flex
							align="center"
							justify="center"
							style={{ flexShrink: 0, paddingTop: "2rem" }}
						>
							<ArrowRightRegular style={{ width: 54, height: 54 }} />
						</Flex>
						<Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
							<DurationField
								label={t("timeStretchDialog.newDuration", "New song duration")}
								value={newDurationInput}
								onChange={(value) => {
									setNewDurationInput(value);
									setNewTemporaryFileName("");
								}}
								onUseCurrent={() => {
									fillFromCurrentSong(setNewDurationInput);
									setNewTemporaryFileName("");
								}}
								currentSongAvailable={currentSongAvailable}
								error={durationError(newDurationInput, newDuration)}
								secondaryAction={
									<Button
										variant="soft"
										onClick={() => chooseTemporaryAudio("new")}
										disabled={readingTemporaryAudio}
										style={{ flex: 1 }}
									>
										{readingTemporaryAudio
											? t("timeStretchDialog.readingAudio", "Reading audio...")
											: t("timeStretchDialog.chooseAudio", "Upload audio...")}
									</Button>
								}
								footer={
									<Flex direction="column" gap="1">
										{newTemporaryFileName && (
											<Text size="1" color="gray">
												{newTemporaryFileName}
											</Text>
										)}
										{newTemporaryAudioError && (
											<Text size="1" color="red">
												{newTemporaryAudioError}
											</Text>
										)}
									</Flex>
								}
							/>
						</Flex>
					</Flex>
					{scaleFactor !== null && (
						<Text size="2" color={durationsMatch ? "gray" : undefined}>
							{durationsMatch
								? t(
										"timeStretchDialog.noChange",
										"The durations match; no timing change is needed.",
									)
								: t(
										"timeStretchDialog.scaleFactor",
										"Scale factor: {factor}×",
										{ factor: scaleFactor.toFixed(6) },
									)}
						</Text>
					)}
				</Flex>
				<Flex gap="3" mt="5" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
					<Button
						onClick={handleApply}
						disabled={!durationsValid || durationsMatch}
					>
						{t("common.apply", "Apply")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
