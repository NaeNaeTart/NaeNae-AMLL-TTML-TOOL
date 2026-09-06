import { ArrowReset24Regular, Search24Regular } from "@fluentui/react-icons";
import {
	Box,
	Flex,
	Grid,
	Heading,
	IconButton,
	Switch,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
	formatKeyBindings,
	recordShortcut,
	RESET_KEYBINDING,
} from "$/utils/keybindings";
import { autoSegmentDoublePressAtom } from "../states";
import { getAllCommands } from "../registry";
import type { KeyBindingCommand } from "../types";

const KeyBindingsEdit = ({ command }: { command: KeyBindingCommand }) => {
	const { t } = useTranslation();
	const [keys, setKeys] = useAtom(command.atom);
	const [listening, setListening] = useState(false);

	return (
		<>
			<Box style={{ display: "flex", alignItems: "center" }}>
				{t(command.description)}
			</Box>

			<Flex gap="2" align="center">
				<TextField.Root
					onClick={async () => {
						try {
							setListening(true);
							const newKeys = await recordShortcut();
							setKeys(newKeys);
						} catch {
							// 用户取消
						} finally {
							setListening(false);
						}
					}}
					size="2"
					value={
						listening
							? t(
									"settingsDialog.keybindings.pressShortcut",
									"Press a shortcut…",
								)
							: formatKeyBindings(keys)
					}
					readOnly
					aria-label={t(command.description)}
					variant="soft"
					style={{
						cursor: "pointer",
						textAlign: "left",
						backgroundColor: listening ? "var(--gray-3)" : "var(--gray-1)",
						color: listening ? "var(--accent-11)" : "var(--gray-12)",
					}}
				/>
				<Tooltip
					content={t("settingsDialog.keybindings.reset", "Reset shortcut")}
				>
					<IconButton
						variant="ghost"
						color="gray"
						onClick={() => setKeys(RESET_KEYBINDING)}
						aria-label={t("settingsDialog.keybindings.reset", "Reset shortcut")}
					>
						<ArrowReset24Regular />
					</IconButton>
				</Tooltip>
			</Flex>
		</>
	);
};

export const AutoKeyBindingSettingsPanel = () => {
	const { t } = useTranslation();
	const [autoSegmentDoublePress, setAutoSegmentDoublePress] = useAtom(
		autoSegmentDoublePressAtom,
	);
	const [searchQuery, setSearchQuery] = useState("");
	const commands = getAllCommands();
	const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
	const visibleCommands = normalizedQuery
		? commands.filter((command) =>
				`${t(command.description)} ${command.category}`
					.toLocaleLowerCase()
					.includes(normalizedQuery),
			)
		: commands;

	const groupedCommands = visibleCommands.reduce(
		(acc, cmd) => {
			if (!acc[cmd.category]) {
				acc[cmd.category] = [];
			}
			acc[cmd.category].push(cmd);
			return acc;
		},
		{} as Record<string, KeyBindingCommand[]>,
	);

	return (
		<Box>
			<TextField.Root
				value={searchQuery}
				onChange={(event) => setSearchQuery(event.target.value)}
				placeholder={t("settingsDialog.keybindings.search", "Search shortcuts")}
				aria-label={t("settingsDialog.keybindings.search", "Search shortcuts")}
				mb="4"
			>
				<TextField.Slot>
					<Search24Regular />
				</TextField.Slot>
			</TextField.Root>
			{visibleCommands.length === 0 && (
				<Text color="gray">
					{t("settingsDialog.keybindings.noResults", "No matching shortcuts")}
				</Text>
			)}
			{Object.entries(groupedCommands).map(([category, cmds]) => (
				<Box key={category} mb="5">
					<Heading size="3" mb="3" color="gray">
						{t(`settingsDialog.keybindings.category.${category}`, category)}
					</Heading>

					<Grid columns="2" gapX="4" gapY="3" align="center">
						{cmds.map((cmd) => (
							<KeyBindingsEdit key={cmd.id} command={cmd} />
						))}
					</Grid>
				</Box>
			))}
			<Box mb="5">
				<Heading size="3" mb="3" color="gray">
					{t("settingsDialog.keybindings.autoSegmentOptions", "Auto Segment")}
				</Heading>
				<Flex align="center" justify="between" gap="4">
					<Box>
						<Text>
							{t(
								"settingsDialog.keybindings.autoSegmentDoublePress",
								"Require double press",
							)}
						</Text>
						<Text as="div" size="1" color="gray">
							{t(
								"settingsDialog.keybindings.autoSegmentDoublePressDesc",
								"Run Auto Segment only after pressing its shortcut twice quickly.",
							)}
						</Text>
					</Box>
					<Switch
						checked={autoSegmentDoublePress}
						onCheckedChange={setAutoSegmentDoublePress}
					/>
				</Flex>
			</Box>
		</Box>
	);
};
