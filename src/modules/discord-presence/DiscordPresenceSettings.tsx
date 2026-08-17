import {
	Button,
	Card,
	Flex,
	Slider,
	Switch,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	audioPlayingAtom,
	currentDurationAtom,
	currentTimeAtom,
	playbackRateAtom,
} from "$/modules/audio/states";
import {
	discordDetailsTemplateAtom,
	discordIdleTimeoutMinutesAtom,
	discordPlaybackTimelineAtom,
	discordProjectElapsedAtom,
	discordRepositoryButtonAtom,
	discordRichPresenceEnabledAtom,
	discordStateTemplateAtom,
	discordStatusBadgeAtom,
} from "$/modules/settings/states";
import {
	lyricLinesAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	toolModeAtom,
} from "$/states/main";
import {
	createDiscordTemplateContext,
	createPresenceSnapshot,
	DEFAULT_DISCORD_DETAILS_TEMPLATE,
	DEFAULT_DISCORD_STATE_TEMPLATE,
	DISCORD_TEMPLATE_VARIABLES,
	renderDiscordTemplate,
	validateDiscordTemplate,
} from "./presence";

type TemplateTarget = "details" | "state";

const SettingToggle = ({
	label,
	checked,
	onCheckedChange,
}: {
	label: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) => (
	<Flex align="center" justify="between" gap="3">
		<Text size="2">{label}</Text>
		<Switch checked={checked} onCheckedChange={onCheckedChange} />
	</Flex>
);

export function DiscordPresenceSettings() {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(discordRichPresenceEnabledAtom);
	const [detailsTemplate, setDetailsTemplate] = useAtom(
		discordDetailsTemplateAtom,
	);
	const [stateTemplate, setStateTemplate] = useAtom(discordStateTemplateAtom);
	const [showPlaybackTimeline, setShowPlaybackTimeline] = useAtom(
		discordPlaybackTimelineAtom,
	);
	const [showProjectElapsed, setShowProjectElapsed] = useAtom(
		discordProjectElapsedAtom,
	);
	const [showRepositoryButton, setShowRepositoryButton] = useAtom(
		discordRepositoryButtonAtom,
	);
	const [showStatusBadge, setShowStatusBadge] = useAtom(discordStatusBadgeAtom);
	const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useAtom(
		discordIdleTimeoutMinutesAtom,
	);
	const [detailsDraft, setDetailsDraft] = useState(detailsTemplate);
	const [stateDraft, setStateDraft] = useState(stateTemplate);
	const [variableSearch, setVariableSearch] = useState("");
	const [templateTarget, setTemplateTarget] =
		useState<TemplateTarget>("details");
	const detailsRef = useRef<HTMLTextAreaElement>(null);
	const stateRef = useRef<HTMLTextAreaElement>(null);

	const lyrics = useAtomValue(lyricLinesAtom);
	const fileName = useAtomValue(saveFileNameAtom);
	const mode = useAtomValue(toolModeAtom);
	const selectedLineIds = useAtomValue(selectedLinesAtom);
	const selectedWordIds = useAtomValue(selectedWordsAtom);
	const playing = useAtomValue(audioPlayingAtom);
	const positionSeconds = useAtomValue(currentTimeAtom) / 1000;
	const durationSeconds = useAtomValue(currentDurationAtom) / 1000;
	const playbackRate = useAtomValue(playbackRateAtom);

	const detailsError = validateDiscordTemplate(detailsDraft);
	const stateError = validateDiscordTemplate(stateDraft);
	const context = useMemo(() => {
		const snapshot = createPresenceSnapshot({
			lyrics,
			fileName,
			mode,
			selectedLineIds,
			playing,
			positionSeconds,
			durationSeconds,
			playbackRate,
			projectElapsedSeconds: 0,
		});
		return createDiscordTemplateContext({
			snapshot,
			lyrics,
			fileName,
			selectedLineIds,
			selectedWordIds,
		});
	}, [
		durationSeconds,
		fileName,
		lyrics,
		mode,
		playbackRate,
		playing,
		positionSeconds,
		selectedLineIds,
		selectedWordIds,
	]);
	const detailsPreview = detailsError
		? ""
		: renderDiscordTemplate(detailsDraft, context);
	const statePreview = stateError
		? ""
		: renderDiscordTemplate(stateDraft, context);
	const filteredVariables = DISCORD_TEMPLATE_VARIABLES.filter((variable) =>
		variable.toLowerCase().includes(variableSearch.trim().toLowerCase()),
	);

	const updateTemplate = (target: TemplateTarget, value: string) => {
		if (target === "details") {
			setDetailsDraft(value);
			if (!validateDiscordTemplate(value)) setDetailsTemplate(value);
		} else {
			setStateDraft(value);
			if (!validateDiscordTemplate(value)) setStateTemplate(value);
		}
	};

	const insertVariable = (variable: string) => {
		const ref = templateTarget === "details" ? detailsRef : stateRef;
		const value = templateTarget === "details" ? detailsDraft : stateDraft;
		const start = ref.current?.selectionStart ?? value.length;
		const end = ref.current?.selectionEnd ?? start;
		const insertion = `{{${variable}}}`;
		updateTemplate(
			templateTarget,
			`${value.slice(0, start)}${insertion}${value.slice(end)}`,
		);
		requestAnimationFrame(() => {
			ref.current?.focus();
			ref.current?.setSelectionRange(
				start + insertion.length,
				start + insertion.length,
			);
		});
	};

	const resetTemplates = () => {
		setDetailsDraft(DEFAULT_DISCORD_DETAILS_TEMPLATE);
		setStateDraft(DEFAULT_DISCORD_STATE_TEMPLATE);
		setDetailsTemplate(DEFAULT_DISCORD_DETAILS_TEMPLATE);
		setStateTemplate(DEFAULT_DISCORD_STATE_TEMPLATE);
	};

	return (
		<Card>
			<Flex direction="column" gap="4">
				<SettingToggle
					label={t(
						"settings.common.discordRichPresence",
						"Discord Rich Presence",
					)}
					checked={enabled}
					onCheckedChange={setEnabled}
				/>
				<Text size="1" color="gray">
					{t(
						"settings.common.discordRichPresenceDesc",
						"Share customizable project and playback details with the Discord desktop app.",
					)}
				</Text>

				<Flex
					direction="column"
					gap="2"
					style={{ opacity: enabled ? 1 : 0.55 }}
				>
					<Flex align="center" justify="between">
						<Text weight="medium" size="2">
							{t("settings.common.discordTemplates", "Presence templates")}
						</Text>
						<Button
							size="1"
							variant="soft"
							onClick={resetTemplates}
							disabled={!enabled}
						>
							{t("common.reset", "Reset")}
						</Button>
					</Flex>
					<Text size="1" color="gray">
						{t(
							"settings.common.discordTemplateHelp",
							"Use {{variables}} and wrap optional text in [[double brackets]].",
						)}
					</Text>
					<Text size="2">{t("settings.common.discordDetails", "Details")}</Text>
					<TextArea
						ref={detailsRef}
						disabled={!enabled}
						value={detailsDraft}
						onFocus={() => setTemplateTarget("details")}
						onChange={(event) => updateTemplate("details", event.target.value)}
					/>
					{detailsError && (
						<Text size="1" color="red">
							{detailsError}
						</Text>
					)}
					<Text size="2">{t("settings.common.discordState", "State")}</Text>
					<TextArea
						ref={stateRef}
						disabled={!enabled}
						value={stateDraft}
						onFocus={() => setTemplateTarget("state")}
						onChange={(event) => updateTemplate("state", event.target.value)}
					/>
					{stateError && (
						<Text size="1" color="red">
							{stateError}
						</Text>
					)}

					<TextField.Root
						disabled={!enabled}
						placeholder={t(
							"settings.common.discordSearchVariables",
							"Search variables…",
						)}
						value={variableSearch}
						onChange={(event) => setVariableSearch(event.target.value)}
					/>
					<Flex gap="1" wrap="wrap">
						{filteredVariables.map((variable) => (
							<Button
								key={variable}
								size="1"
								variant="soft"
								disabled={!enabled}
								onClick={() => insertVariable(variable)}
							>
								{`{{${variable}}}`}
							</Button>
						))}
					</Flex>

					<Flex
						direction="column"
						gap="1"
						p="3"
						style={{
							background: "var(--gray-a3)",
							borderRadius: "var(--radius-3)",
						}}
					>
						<Text size="1" color="gray">
							{t("common.preview", "Preview")}
						</Text>
						<Text size="2" weight="medium">
							{detailsPreview || "—"}
						</Text>
						<Text size="2" color="gray">
							{statePreview || "—"}
						</Text>
					</Flex>

					<SettingToggle
						label={t(
							"settings.common.discordPlaybackTimeline",
							"Playback timeline",
						)}
						checked={showPlaybackTimeline}
						onCheckedChange={setShowPlaybackTimeline}
					/>
					<SettingToggle
						label={t(
							"settings.common.discordProjectElapsed",
							"Project elapsed timer",
						)}
						checked={showProjectElapsed}
						onCheckedChange={setShowProjectElapsed}
					/>
					<SettingToggle
						label={t(
							"settings.common.discordRepositoryButton",
							"Repository button",
						)}
						checked={showRepositoryButton}
						onCheckedChange={setShowRepositoryButton}
					/>
					<SettingToggle
						label={t(
							"settings.common.discordStatusBadge",
							"Play/pause status badge",
						)}
						checked={showStatusBadge}
						onCheckedChange={setShowStatusBadge}
					/>

					<Flex align="center" justify="between">
						<Text size="2">
							{t("settings.common.discordIdleTimeout", "Inactive after")}
						</Text>
						<Text size="2" color="gray">
							{idleTimeoutMinutes} min
						</Text>
					</Flex>
					<Slider
						disabled={!enabled}
						min={1}
						max={60}
						value={[Math.min(60, Math.max(1, idleTimeoutMinutes))]}
						onValueChange={([value]) => setIdleTimeoutMinutes(value)}
					/>
					<Text size="1" color="gray">
						{t(
							"settings.common.discordIdlePrivacy",
							"Inactive presence hides project details, buttons, badges, and timers.",
						)}
					</Text>
				</Flex>
			</Flex>
		</Card>
	);
}
