import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { useAtomValue, useStore } from "jotai";
import { useTranslation } from "react-i18next";
import {
	createLinkedProjectFromCurrent,
	createProjectFromCurrent,
	dismissCreateProjectPrompt,
} from "$/modules/project/folder-project/project-create";
import { createProjectPromptAtom } from "$/modules/project/folder-project/state";

export const CreateProjectPromptDialog = () => {
	const open = useAtomValue(createProjectPromptAtom);
	const store = useStore();
	const { t: rawT } = useTranslation();
	const t = rawT as (key: string, fallback?: string) => string;

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) dismissCreateProjectPrompt(store);
			}}
		>
			<Dialog.Content maxWidth="460px">
				<Dialog.Title>
					{t("dialog.createProjectPrompt.title", "Create a project?")}
				</Dialog.Title>
				<Text as="p" size="2" mb="3">
					{t(
						"dialog.createProjectPrompt.description",
						"Keep the audio and lyrics together in a project folder.",
					)}
				</Text>
				<Text as="p" size="2" color="gray" mb="3">
					{t(
						"dialog.createProjectPrompt.linkDescription",
						"Or keep the files where they are: the project only remembers their locations, and only an explicit save writes the TTML back to its original file.",
					)}
				</Text>
				<Flex gap="3" justify="end" wrap="wrap">
					<Button
						variant="soft"
						color="gray"
						onClick={() => dismissCreateProjectPrompt(store)}
					>
						{t("dialog.createProjectPrompt.ignore", "Ignore")}
					</Button>
					<Button
						variant="soft"
						onClick={() => void createLinkedProjectFromCurrent(store, t)}
					>
						{t("dialog.createProjectPrompt.link", "Keep files in place")}
					</Button>
					<Button onClick={() => void createProjectFromCurrent(store, t)}>
						{t("dialog.createProjectPrompt.create", "Create folder")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
