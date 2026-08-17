import {
	Bot24Regular,
	Key24Regular,
	Server24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Card,
	Flex,
	Heading,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
	aiSidebarApiKeyAtom,
	clearStoredAiApiKeyAtom,
} from "$/modules/ai-sidebar/states";
import {
	aiSidebarBaseUrlAtom,
	aiSidebarEnabledAtom,
	aiSidebarModelAtom,
	aiSidebarPersistKeyAtom,
} from "$/modules/settings/states";

export function SettingsAiTab() {
	const [enabled, setEnabled] = useAtom(aiSidebarEnabledAtom);
	const [baseUrl, setBaseUrl] = useAtom(aiSidebarBaseUrlAtom);
	const [model, setModel] = useAtom(aiSidebarModelAtom);
	const [apiKey, setApiKey] = useAtom(aiSidebarApiKeyAtom);
	const [persistKey, setPersistKey] = useAtom(aiSidebarPersistKeyAtom);
	const [, clearStoredKey] = useAtom(clearStoredAiApiKeyAtom);
	const { t } = useTranslation();

	const setPersistence = (enabled: boolean) => {
		setPersistKey(enabled);
		if (enabled) {
			setApiKey(apiKey);
		} else {
			clearStoredKey();
		}
	};

	return (
		<Flex direction="column" gap="4">
			<Heading size="4">{t("settings.ai.title", "AI Sidebar")}</Heading>
			<Text size="2" color="gray">
				{t(
					"settings.ai.description",
					"Bring your own OpenAI-compatible provider. Reviews only happen when you press the button in the sidebar.",
				)}
			</Text>
			<Card>
				<Text as="label">
					<Flex gap="3" align="center">
						<Bot24Regular />
						<Flex direction="column" gap="1" flexGrow="1">
							<Text>{t("settings.assistant.aiSidebar", "AI Fun Sidebar")}</Text>
							<Text size="1" color="gray">
								{t(
									"settings.assistant.aiSidebarDesc",
									"Enable the optional manual AI review sidebar.",
								)}
							</Text>
						</Flex>
						<Switch checked={enabled} onCheckedChange={setEnabled} />
					</Flex>
				</Text>
			</Card>
			<Card>
				<Flex direction="column" gap="3">
					<Flex gap="3" align="center">
						<Server24Regular />
						<Flex direction="column" gap="1" flexGrow="1">
							<Text>{t("settings.ai.endpoint", "Endpoint")}</Text>
							<Text size="1" color="gray">
								{t(
									"settings.ai.endpointDesc",
									"The OpenAI-compatible API base URL.",
								)}
							</Text>
						</Flex>
					</Flex>
					<TextField.Root
						value={baseUrl}
						onChange={(event) => setBaseUrl(event.target.value)}
						placeholder="https://api.openai.com/v1"
					/>
					<TextField.Root
						value={model}
						onChange={(event) => setModel(event.target.value)}
						placeholder="gpt-4o-mini"
					/>
				</Flex>
			</Card>
			<Card>
				<Flex direction="column" gap="3">
					<Flex gap="3" align="center">
						<Key24Regular />
						<Flex direction="column" gap="1" flexGrow="1">
							<Text>{t("settings.ai.apiKey", "API key")}</Text>
							<Text size="1" color="gray">
								{t(
									"settings.ai.apiKeyDesc",
									"Required only when you manually request a review.",
								)}
							</Text>
						</Flex>
					</Flex>
					<TextField.Root
						type="password"
						value={apiKey}
						onChange={(event) => setApiKey(event.target.value)}
						placeholder="sk-..."
					/>
					<Flex justify="between" align="center" gap="3">
						<Box>
							<Text>
								{t("settings.ai.storeKey", "Store key on this device")}
							</Text>
							<Text size="1" color="red" as="div">
								{t(
									"settings.ai.storeKeyWarning",
									"This stores the key in plain browser local storage. It is excluded from backups, but not encrypted.",
								)}
							</Text>
						</Box>
						<Switch checked={persistKey} onCheckedChange={setPersistence} />
					</Flex>
				</Flex>
			</Card>
		</Flex>
	);
}
