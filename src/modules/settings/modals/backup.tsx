import {
	ArrowDownload24Regular,
	ArrowUpload24Regular,
	ChevronDownRegular,
	Folder20Regular,
	Key20Regular,
	Keyboard20Regular,
	PaintBrush20Regular,
	Settings20Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Checkbox,
	Flex,
	Heading,
	Text,
} from "@radix-ui/themes";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	type BackupAssetsCounts,
	countsFromParts,
	exportBackup,
} from "$/modules/settings/backup/export";
import {
	applyBackup,
	describeBackup,
	getPresentCategories,
	parseBackupFile,
} from "$/modules/settings/backup/import";
import {
	EXPORT_PREVIEW_ITEM_LIMIT,
	type ExportPreviewLabels,
	type ExportPreviewParts,
	formatPreviewBytes,
	loadExportParts,
	summarizeExportParts,
} from "$/modules/settings/backup/preview";
import {
	BACKUP_CATEGORY_IDS,
	type BackupCategoryId,
	type BackupFile,
	BackupValidationError,
} from "$/modules/settings/backup/types";

const CATEGORY_ICONS: Record<BackupCategoryId, React.ReactNode> = {
	settings: <Settings20Regular />,
	keybindings: <Keyboard20Regular />,
	assets: <PaintBrush20Regular />,
	projects: <Folder20Regular />,
	apiKeys: <Key20Regular />,
};

const ALL_CATEGORIES = new Set<BackupCategoryId>(BACKUP_CATEGORY_IDS);

function useCategoryLabels() {
	const { t } = useTranslation();
	return {
		settings: t("settings.backup.category.settings", "Settings"),
		keybindings: t("settings.backup.category.keybindings", "Keybindings"),
		assets: t("settings.backup.category.assets", "Appearance assets"),
		projects: t("settings.backup.category.projects", "Projects & history"),
		apiKeys: t("settings.backup.category.apiKeys", "API keys"),
	} satisfies Record<BackupCategoryId, string>;
}

export const SettingsBackupTab = memo(() => {
	const { t } = useTranslation();
	const labels = useCategoryLabels();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [exportParts, setExportParts] = useState<ExportPreviewParts | null>(
		null,
	);
	const [exportSelected, setExportSelected] = useState<Set<BackupCategoryId>>(
		() => new Set(BACKUP_CATEGORY_IDS.filter((id) => id !== "apiKeys")),
	);
	const [exporting, setExporting] = useState(false);
	const [expanded, setExpanded] = useState<Set<BackupCategoryId>>(
		() => new Set(),
	);
	const [previewLoading, setPreviewLoading] = useState(true);

	const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);
	const [importSelected, setImportSelected] = useState<Set<BackupCategoryId>>(
		() => new Set(),
	);
	const [importing, setImporting] = useState(false);

	useEffect(() => {
		let cancelled = false;
		loadExportParts(ALL_CATEGORIES)
			.then((next) => {
				if (!cancelled) setExportParts(next);
			})
			.catch(() => {
				if (!cancelled) setExportParts(null);
			})
			.finally(() => {
				if (!cancelled) setPreviewLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const counts = useMemo(
		() => (exportParts ? countsFromParts(exportParts) : null),
		[exportParts],
	);

	const previewLabels = useMemo<ExportPreviewLabels>(
		() => ({
			preset: t("settings.backup.previewPresetPrefix", "Preset"),
			customFont: t("settings.backup.previewFontPrefix", "Custom Font"),
			versions: (count) =>
				t("settings.backup.previewVersions", "{count} versions", { count }),
		}),
		[t],
	);

	const preview = useMemo(
		() =>
			exportParts
				? summarizeExportParts(exportParts, ALL_CATEGORIES, previewLabels)
				: null,
		[exportParts, previewLabels],
	);

	const toggle = useCallback(
		(
			setter: React.Dispatch<React.SetStateAction<Set<BackupCategoryId>>>,
			id: BackupCategoryId,
			checked: boolean,
		) => {
			setter((prev) => {
				const next = new Set(prev);
				if (checked) next.add(id);
				else next.delete(id);
				return next;
			});
		},
		[],
	);

	const formatAssetsHint = useCallback(
		(assets: BackupAssetsCounts): string => {
			const parts: string[] = [];
			if (assets.presets > 0) {
				parts.push(
					t("settings.backup.hint.presetsCount", "{count} presets", {
						count: assets.presets,
					}),
				);
			}
			if (assets.background) {
				parts.push(
					t("settings.backup.hint.backgroundSet", "Custom background"),
				);
			}
			if (assets.font) {
				parts.push(t("settings.backup.hint.fontSet", "Custom font"));
			}
			if (parts.length > 0) {
				return parts.join(" • ");
			}
			return t("settings.backup.hint.assetsNone", "No custom assets");
		},
		[t],
	);

	const exportHint = useCallback(
		(id: BackupCategoryId): string => {
			if (!counts) return "";
			switch (id) {
				case "settings":
					return t("settings.backup.hint.settings", "{count} stored values", {
						count: counts.settings,
					});
				case "keybindings":
					return t("settings.backup.hint.keybindings", "{count} keybindings", {
						count: counts.keybindings,
					});
				case "assets":
					return formatAssetsHint(counts.assets);
				case "projects":
					return t("settings.backup.hint.projects", "{count} projects", {
						count: counts.projects,
					});
				case "apiKeys":
					return t("settings.backup.hint.apiKeys", "{count} keys", {
						count: counts.apiKeys,
					});
			}
		},
		[counts, formatAssetsHint, t],
	);

	const handleExport = useCallback(async () => {
		if (exportSelected.size === 0) return;
		setExporting(true);
		try {
			const name = await exportBackup(exportSelected);
			if (name !== null) {
				toast.success(t("settings.backup.exportSuccess", "Backup exported"));
			}
		} catch {
			toast.error(t("settings.backup.exportFailed", "Failed to export backup"));
		} finally {
			setExporting(false);
		}
	}, [exportSelected, t]);

	const handleFilePicked = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			e.target.value = "";
			if (!file) return;
			try {
				const parsed = parseBackupFile(await file.text());
				const present = getPresentCategories(parsed);
				setPendingImport(parsed);
				setImportSelected(new Set(present.filter((id) => id !== "apiKeys")));
			} catch (err) {
				if (
					err instanceof BackupValidationError &&
					err.reason === "newerVersion"
				) {
					toast.error(
						t(
							"settings.backup.newerVersion",
							"This backup was created by a newer version of the app",
						),
					);
				} else {
					toast.error(
						t(
							"settings.backup.invalidFile",
							"Invalid or corrupted backup file",
						),
					);
				}
			}
		},
		[t],
	);

	const handleApplyImport = useCallback(async () => {
		if (!pendingImport || importSelected.size === 0) return;
		setImporting(true);
		try {
			await applyBackup(pendingImport, importSelected);
			toast.success(
				t("settings.backup.importSuccess", "Backup imported, reloading…"),
			);
			window.location.reload();
		} catch {
			setImporting(false);
			toast.error(
				t(
					"settings.backup.importFailed",
					"Failed to import backup. Some data may have been partially applied.",
				),
			);
		}
	}, [pendingImport, importSelected, t]);

	const importDescription = pendingImport ? describeBackup(pendingImport) : {};
	const importHint = (id: BackupCategoryId): string => {
		const value = importDescription[id];
		if (value === undefined) return "";
		if (id === "assets") {
			if (typeof value === "object" && value !== null) {
				return formatAssetsHint(value as BackupAssetsCounts);
			}
			return value
				? t("settings.backup.hint.backgroundSet", "Custom background")
				: t("settings.backup.hint.assetsNone", "No custom assets");
		}
		return String(value);
	};

	return (
		<Flex direction="column" gap="4">
			<Box>
				<Heading size="3" mb="1">
					{t("settings.backup.exportTitle", "Export")}
				</Heading>
				<Text size="2" color="gray" mb="2" as="div">
					{t(
						"settings.backup.exportDesc",
						"Save your settings and data to a file you can restore later or move to another device.",
					)}
				</Text>
				<Card variant="surface">
					<Flex direction="column" gap="3">
						{BACKUP_CATEGORY_IDS.map((id) => {
							const category = preview?.categories.find((c) => c.id === id);
							const open = expanded.has(id);
							return (
								<Box key={id}>
									<Flex align="center" gap="3">
										<Checkbox
											checked={exportSelected.has(id)}
											onCheckedChange={(v) =>
												toggle(setExportSelected, id, v === true)
											}
										/>
										<Box
											style={{
												color: "var(--accent-9)",
												display: "flex",
												alignItems: "center",
											}}
										>
											{CATEGORY_ICONS[id]}
										</Box>
										<Flex direction="column" flexGrow="1">
											<Text size="2">{labels[id]}</Text>
											<Text size="1" color="gray">
												{exportHint(id)}
											</Text>
										</Flex>
										<Button
											variant="ghost"
											color="gray"
											size="1"
											onClick={() => toggle(setExpanded, id, !open)}
											aria-expanded={open}
										>
											<ChevronDownRegular
												style={{
													transform: open ? "rotate(180deg)" : undefined,
													transition: "transform 0.15s ease",
												}}
											/>
											{category ? formatPreviewBytes(category.bytes) : null}
										</Button>
									</Flex>
									{open && (
										<Box
											ml="6"
											mt="1"
											style={{ maxHeight: 160, overflowY: "auto" }}
										>
											{previewLoading ? (
												<Text size="1" color="gray">
													{t(
														"settings.backup.previewLoading",
														"Loading preview…",
													)}
												</Text>
											) : !category || category.items.length === 0 ? (
												<Text size="1" color="gray">
													{t(
														"settings.backup.previewCategoryEmpty",
														"Nothing to export in this category",
													)}
												</Text>
											) : (
												<Flex direction="column" gap="1">
													{category.items
														.slice(0, EXPORT_PREVIEW_ITEM_LIMIT)
														.map((item) => (
															<Flex
																key={item.key}
																align="center"
																justify="between"
																gap="2"
															>
																<Text size="1" truncate>
																	{item.label}
																</Text>
																<Text size="1" color="gray" wrap="nowrap">
																	{item.detail}
																</Text>
															</Flex>
														))}
													{category.items.length >
														EXPORT_PREVIEW_ITEM_LIMIT && (
														<Text size="1" color="gray">
															{t(
																"settings.backup.previewMore",
																"+{count} more",
																{
																	count:
																		category.items.length -
																		EXPORT_PREVIEW_ITEM_LIMIT,
																},
															)}
														</Text>
													)}
												</Flex>
											)}
										</Box>
									)}
								</Box>
							);
						})}
						{exportSelected.has("apiKeys") && (
							<Text size="1" color="orange">
								{t(
									"settings.backup.apiKeysWarning",
									"API keys are saved as plain text in the backup file. Keep it private.",
								)}
							</Text>
						)}
						<Flex justify="between" align="center">
							<Text size="2" weight="bold">
								{t("settings.backup.previewTotal", "Estimated total size")}:{" "}
								{formatPreviewBytes(
									(preview?.categories ?? [])
										.filter((c) => exportSelected.has(c.id))
										.reduce((sum, c) => sum + c.bytes, 0),
								)}
							</Text>
							<Button
								onClick={handleExport}
								disabled={exportSelected.size === 0}
								loading={exporting}
							>
								<ArrowDownload24Regular />
								{t("settings.backup.exportButton", "Export backup")}
							</Button>
						</Flex>
					</Flex>
				</Card>
			</Box>

			<Box>
				<Heading size="3" mb="1">
					{t("settings.backup.importTitle", "Import")}
				</Heading>
				<Text size="2" color="gray" mb="2" as="div">
					{t(
						"settings.backup.importDesc",
						"Restore settings and data from a backup file. Existing values will be replaced.",
					)}
				</Text>
				<Card variant="surface">
					<input
						ref={fileInputRef}
						type="file"
						accept=".json,application/json"
						style={{ display: "none" }}
						onChange={handleFilePicked}
					/>
					{!pendingImport ? (
						<Flex justify="start">
							<Button
								variant="soft"
								onClick={() => fileInputRef.current?.click()}
							>
								<ArrowUpload24Regular />
								{t("settings.backup.importButton", "Choose backup file…")}
							</Button>
						</Flex>
					) : (
						<Flex direction="column" gap="3">
							<Text size="2" weight="bold">
								{t("settings.backup.confirmTitle", "Confirm import")}
							</Text>
							<Text size="1" color="gray">
								{t("settings.backup.exportedAt", "Exported")}:{" "}
								{new Date(pendingImport.exportedAt).toLocaleString()}
							</Text>
							{getPresentCategories(pendingImport).map((id) => (
								<Flex key={id} align="center" gap="3">
									<Checkbox
										checked={importSelected.has(id)}
										onCheckedChange={(v) =>
											toggle(setImportSelected, id, v === true)
										}
									/>
									<Box
										style={{
											color: "var(--accent-9)",
											display: "flex",
											alignItems: "center",
										}}
									>
										{CATEGORY_ICONS[id]}
									</Box>
									<Flex direction="column">
										<Text size="2">{labels[id]}</Text>
										<Text size="1" color="gray">
											{importHint(id)}
										</Text>
									</Flex>
								</Flex>
							))}
							<Text size="1" color="orange">
								{t(
									"settings.backup.confirmReplaceWarning",
									"Imported values will replace your current ones. The app will reload after importing.",
								)}
							</Text>
							<Flex justify="end" gap="2">
								<Button
									variant="soft"
									color="gray"
									onClick={() => setPendingImport(null)}
									disabled={importing}
								>
									{t("settings.backup.cancelButton", "Cancel")}
								</Button>
								<Button
									onClick={handleApplyImport}
									disabled={importSelected.size === 0}
									loading={importing}
								>
									{t("settings.backup.applyButton", "Import & reload")}
								</Button>
							</Flex>
						</Flex>
					)}
				</Card>
			</Box>
		</Flex>
	);
});
