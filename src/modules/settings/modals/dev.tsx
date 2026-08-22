import { Box, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { PluginManagerDialog } from "$/modules/plugins/components/PluginManagerDialog";
import { showFpsCounterAtom } from "$/modules/settings/states/preview";

export const SettingsDevTab = memo(() => {
	const { t } = useTranslation();
	const [showFps, setShowFps] = useAtom(showFpsCounterAtom);

	return (
		<Flex direction="column" gap="4">
			<Box>
				<Text size="3" weight="bold" mb="2" as="div">
					{t("settings.dev.previewPerformance", "Preview Performance")}
				</Text>
				<Card variant="surface">
					<Flex direction="column" gap="3">
						<Flex align="center" gap="3">
							<Switch
								checked={showFps}
								onCheckedChange={(v) => setShowFps(!!v)}
							/>
							<Text size="2">
								{t("settings.dev.showFps", "Show FPS Counter in Preview")}
							</Text>
						</Flex>
					</Flex>
				</Card>
			</Box>

			<Box>
				<Text size="3" weight="bold" mb="2" as="div">
					{t(
						"settings.dev.wasmPlugins.title",
						"Community Plugin System (WASM)",
					)}
				</Text>
				<Card variant="surface">
					<Flex direction="column" gap="3">
						<Text size="2" color="gray">
							{t(
								"settings.dev.wasmPlugins.description",
								"Manage and upload custom WebAssembly plugins to extend the tool's importing and exporting capabilities.",
							)}
						</Text>
						<Flex justify="start">
							<PluginManagerDialog />
						</Flex>
					</Flex>
				</Card>
			</Box>

			<Box>
				<Text size="3" weight="bold" mb="2" as="div">
					{t("settings.dev.debugInfo.title", "Debug Information")}
				</Text>
				<Card variant="surface">
					<Flex direction="column" gap="1">
						<Text size="1" color="gray">
							Environment: {import.meta.env.MODE}
						</Text>
						<Text size="1" color="gray">
							Platform: {window.navigator.platform}
						</Text>
					</Flex>
				</Card>
			</Box>
		</Flex>
	);
});
