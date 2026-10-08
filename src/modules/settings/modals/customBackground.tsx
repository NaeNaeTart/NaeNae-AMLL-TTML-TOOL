import {
	ArrowHookUpLeft24Regular,
	Blur24Regular,
	Dismiss24Regular,
	Eye24Regular,
	Image24Regular,
	Layer24Regular,
	WeatherSunny24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Flex,
	Heading,
	IconButton,
	Slider,
	Text,
} from "@radix-ui/themes";
import { openDB } from "idb";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

const CUSTOM_BACKGROUND_DB = "amll-custom-background";
const CUSTOM_BACKGROUND_STORE = "background-image";
const CUSTOM_BACKGROUND_KEY = "main";

type CustomBackgroundRecord = {
	key: string;
	blob: Blob;
	updatedAt: number;
};

const customBackgroundDbPromise = openDB(CUSTOM_BACKGROUND_DB, 1, {
	upgrade(db) {
		if (!db.objectStoreNames.contains(CUSTOM_BACKGROUND_STORE)) {
			db.createObjectStore(CUSTOM_BACKGROUND_STORE, { keyPath: "key" });
		}
	},
});

const readLegacyCustomBackground = async () => {
	try {
		const raw = localStorage.getItem("customBackgroundImage");
		if (!raw) return null;
		const parsed = JSON.parse(raw) as string | null;
		if (!parsed || typeof parsed !== "string") {
			localStorage.removeItem("customBackgroundImage");
			return null;
		}
		if (!parsed.startsWith("data:")) {
			localStorage.removeItem("customBackgroundImage");
			return null;
		}
		const response = await fetch(parsed);
		const blob = await response.blob();
		localStorage.removeItem("customBackgroundImage");
		return blob;
	} catch {
		return null;
	}
};

export const customBackgroundImageKeyAtom = atomWithStorage<string | null>(
	"customBackgroundImageKey",
	"main",
	undefined,
	{ getOnInit: true },
);

const getStoredBackgroundKey = (): string | null => {
	try {
		const raw = localStorage.getItem("customBackgroundImageKey");
		if (raw === null) return CUSTOM_BACKGROUND_KEY;
		const value: unknown = JSON.parse(raw);
		return typeof value === "string" ? value : null;
	} catch {
		return CUSTOM_BACKGROUND_KEY;
	}
};

export const readCustomBackgroundBlob = async (
	key = getStoredBackgroundKey(),
) => {
	if (key === null) return null;
	try {
		const db = await customBackgroundDbPromise;
		const record = (await db.get(CUSTOM_BACKGROUND_STORE, key)) as
			| CustomBackgroundRecord
			| undefined;
		if (record?.blob) return record.blob;
	} catch {}
	if (key !== CUSTOM_BACKGROUND_KEY) return null;
	const legacy = await readLegacyCustomBackground();
	if (!legacy) return null;
	try {
		const db = await customBackgroundDbPromise;
		const record: CustomBackgroundRecord = {
			key: CUSTOM_BACKGROUND_KEY,
			blob: legacy,
			updatedAt: Date.now(),
		};
		await db.put(CUSTOM_BACKGROUND_STORE, record);
	} catch {}
	return legacy;
};

export const writeCustomBackgroundBlob = async (
	blob: Blob | null,
): Promise<string | null> => {
	let key: string | null = null;
	if (blob) {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			await blob.arrayBuffer(),
		);
		key = `image:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
		const db = await customBackgroundDbPromise;
		if (!(await db.get(CUSTOM_BACKGROUND_STORE, key))) {
			const record: CustomBackgroundRecord = {
				key,
				blob,
				updatedAt: Date.now(),
			};
			await db.put(CUSTOM_BACKGROUND_STORE, record);
		}
	}
	// Clearing the active image must not delete images still used by presets.
	localStorage.setItem("customBackgroundImageKey", JSON.stringify(key));
	return key;
};

const customBackgroundImageValueAtom = atom<string | null>(null);

export const customBackgroundImageAtom = atom(
	(get) => get(customBackgroundImageValueAtom),
	async (get, set, next: File | Blob | string | null) => {
		const key =
			typeof next === "string" ? next : await writeCustomBackgroundBlob(next);
		const blob =
			typeof next === "string" ? await readCustomBackgroundBlob(next) : next;
		// A preset imported on another machine may reference an image unavailable locally.
		// Preserve the current image in that case instead of silently clearing it.
		if (typeof next === "string" && !blob) return false;
		const previous = get(customBackgroundImageValueAtom);
		const url = blob ? URL.createObjectURL(blob) : null;
		set(customBackgroundImageKeyAtom, key);
		set(customBackgroundImageValueAtom, url);
		if (previous) URL.revokeObjectURL(previous);
		return true;
	},
);

export const customBackgroundImageInitAtom = atom(null, async (get, set) => {
	const previous = get(customBackgroundImageValueAtom);
	const key = get(customBackgroundImageKeyAtom);
	const blob = await readCustomBackgroundBlob(key);
	set(customBackgroundImageKeyAtom, blob ? key : null);
	set(customBackgroundImageValueAtom, blob ? URL.createObjectURL(blob) : null);
	if (previous) URL.revokeObjectURL(previous);
});

export const customBackgroundOpacityAtom = atomWithStorage(
	"customBackgroundOpacity",
	0.8,
);

export const customBackgroundMaskAtom = atomWithStorage(
	"customBackgroundMask",
	0.2,
);

export const customBackgroundBlurAtom = atomWithStorage(
	"customBackgroundBlur",
	0,
);

export const customBackgroundBrightnessAtom = atomWithStorage(
	"customBackgroundBrightness",
	1,
);

export const SettingsCustomBackgroundSettings = ({
	onClose,
}: {
	onClose: () => void;
}) => {
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const setCustomBackgroundImage = useSetAtom(customBackgroundImageAtom);
	const [customBackgroundOpacity, setCustomBackgroundOpacity] = useAtom(
		customBackgroundOpacityAtom,
	);
	const [customBackgroundMask, setCustomBackgroundMask] = useAtom(
		customBackgroundMaskAtom,
	);
	const [customBackgroundBlur, setCustomBackgroundBlur] = useAtom(
		customBackgroundBlurAtom,
	);
	const [customBackgroundBrightness, setCustomBackgroundBrightness] = useAtom(
		customBackgroundBrightnessAtom,
	);
	const { t } = useTranslation();
	const backgroundFileInputRef = useRef<HTMLInputElement>(null);

	const onSelectBackgroundFile = useCallback(
		(file: File) => {
			setCustomBackgroundImage(file);
		},
		[setCustomBackgroundImage],
	);

	return (
		<Flex direction="column" gap="4">
			<Flex align="center" justify="between">
				<Heading size="4">
					{t("settings.common.customBackground", "Custom Background")}
				</Heading>
				<IconButton variant="ghost" onClick={onClose}>
					<Dismiss24Regular />
				</IconButton>
			</Flex>

			<Card>
				<Flex direction="column" gap="3">
					<Text size="1" color="gray">
						{t(
							"settings.common.customBackgroundDesc",
							"Select an image to use as background.",
						)}
					</Text>
					<input
						ref={backgroundFileInputRef}
						type="file"
						accept="image/*"
						style={{ display: "none" }}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (!file) return;
							onSelectBackgroundFile(file);
							event.target.value = "";
						}}
					/>
					<Flex gap="2" align="center">
						<Button
							variant="soft"
							onClick={() => backgroundFileInputRef.current?.click()}
						>
							{t("settings.common.customBackgroundPick", "Select Image")}
						</Button>
						<Button
							variant="ghost"
							disabled={!customBackgroundImage}
							onClick={() => setCustomBackgroundImage(null)}
						>
							{t("settings.common.customBackgroundClear", "Clear")}
						</Button>
					</Flex>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Flex align="center" gap="2">
							<Box
								style={{
									color: "var(--accent-9)",
									display: "flex",
									alignItems: "center",
								}}
							>
								<Eye24Regular />
							</Box>
							<Text>
								{t("settings.common.customBackgroundOpacity", "Opacity")}
							</Text>
						</Flex>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{Math.round(customBackgroundOpacity * 100)}%
							</Text>
							{customBackgroundOpacity !== 0.8 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundOpacity(0.8)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0}
						max={1}
						step={0.01}
						value={[customBackgroundOpacity]}
						onValueChange={(v) => setCustomBackgroundOpacity(v[0])}
					/>
					{customBackgroundOpacity >= 0.9 && (
						<Text size="1" color="orange">
							{t(
								"settings.common.customBackgroundOpacityWarning",
								"If this value is too high, it might obscure page content.",
							)}
						</Text>
					)}
				</Flex>
			</Card>

			<Card style={{ marginBottom: "var(--space-1)" }}>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Flex align="center" gap="2">
							<Box
								style={{
									color: "var(--accent-9)",
									display: "flex",
									alignItems: "center",
								}}
							>
								<Layer24Regular />
							</Box>
							<Text>{t("settings.common.customBackgroundMask", "Mask")}</Text>
						</Flex>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{Math.round(customBackgroundMask * 100)}%
							</Text>
							{customBackgroundMask !== 0.2 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundMask(0.2)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0}
						max={1}
						step={0.01}
						value={[customBackgroundMask]}
						onValueChange={(v) => setCustomBackgroundMask(v[0])}
					/>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Flex align="center" gap="2">
							<Box
								style={{
									color: "var(--accent-9)",
									display: "flex",
									alignItems: "center",
								}}
							>
								<Blur24Regular />
							</Box>
							<Text>
								{t("settings.common.customBackgroundBlur", "Blur Radius")}
							</Text>
						</Flex>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{customBackgroundBlur.toFixed(0)}px
							</Text>
							{customBackgroundBlur !== 0 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundBlur(0)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0}
						max={30}
						step={1}
						value={[customBackgroundBlur]}
						onValueChange={(v) => setCustomBackgroundBlur(v[0])}
					/>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Flex align="center" gap="2">
							<Box
								style={{
									color: "var(--accent-9)",
									display: "flex",
									alignItems: "center",
								}}
							>
								<WeatherSunny24Regular />
							</Box>
							<Text>
								{t("settings.common.customBackgroundBrightness", "Brightness")}
							</Text>
						</Flex>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{Math.round(customBackgroundBrightness * 100)}%
							</Text>
							{customBackgroundBrightness !== 1 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundBrightness(1)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0.5}
						max={1.5}
						step={0.01}
						value={[customBackgroundBrightness]}
						onValueChange={(v) => setCustomBackgroundBrightness(v[0])}
					/>
				</Flex>
			</Card>
		</Flex>
	);
};

export const SettingsCustomBackgroundCard = ({
	onOpen,
}: {
	onOpen: () => void;
}) => {
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const { t } = useTranslation();

	return (
		<Card style={{ width: "100%", marginBottom: "var(--space-1)" }}>
			<Flex gap="3" align="center">
				<Image24Regular />
				<Box flexGrow="1">
					<Flex align="center" justify="between" gap="4">
						<Flex direction="column" gap="1">
							<Text>
								{t("settings.common.customBackground", "Custom Background")}
							</Text>
							<Text size="1" color="gray">
								{customBackgroundImage
									? t(
											"settings.common.customBackgroundEnabled",
											"Background applied",
										)
									: t(
											"settings.common.customBackgroundDesc",
											"Select an image to use as background.",
										)}
							</Text>
						</Flex>
						<Button variant="soft" onClick={onOpen}>
							{t("settings.common.customBackgroundManage", "Manage")}
						</Button>
					</Flex>
				</Box>
			</Flex>
		</Card>
	);
};
