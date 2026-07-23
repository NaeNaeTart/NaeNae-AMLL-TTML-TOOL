import {
	ArrowDownload24Regular,
	ArrowUpload24Regular,
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
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	type BackupCounts,
	exportBackup,
	getBackupCounts,
} from "$/modules/settings/backup/export";
import {
	applyBackup,
	describeBackup,
	getPresentCategories,
	parseBackupFile,
} from "$/modules/settings/backup/import";
import {
	BACKUP_CATEGORY_IDS,
	type BackupCategoryId,
	type BackupFile,
	BackupValidationError,
} from "$/modules/settings/backup/types";

function useCategoryLabels() {
	const { t } = useTranslation();
	return {
		settings: t("settings.backup.category.settings", "Settings"),
		keybindings: t("settings.backup.category.keybindings", "Keybindings"),
		assets: t("settings.backup.category.assets", "Appearance assets"),
		projects: t("settings.backup.category.projects", "Projects & history"),
		plugins: t("settings.backup.category.plugins", "Plugins"),
	} satisfies Record<BackupCategoryId, string>;
}

export const SettingsBackupTab = memo(() => {
	const { t } = useTranslation();
	const labels = useCategoryLabels();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [counts, setCounts] = useState<BackupCounts | null>(null);
	const [exportSelected, setExportSelected] = useState<Set<BackupCategoryId>>(
		() => new Set(BACKUP_CATEGORY_IDS),
	);
	const [exporting, setExporting] = useState(false);

	const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);
	const [importSelected, setImportSelected] = useState<Set<BackupCategoryId>>(
		() => new Set(),
	);
	const [importing, setImporting] = useState(false);

	useEffect(() => {
		getBackupCounts()
			.then(setCounts)
			.catch(() => setCounts(null));
	}, []);

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
					return counts.assets
						? t("settings.backup.hint.assetsSet", "Custom background image set")
						: t("settings.backup.hint.assetsNone", "No custom background image");
				case "projects":
					return t("settings.backup.hint.projects", "{count} projects", {
						count: counts.projects,
					});
				case "plugins":
					return t("settings.backup.hint.plugins", "{count} plugins", {
						count: counts.plugins,
					});
			}
		},
		[counts, t],
	);

	const handleExport = useCallback(async () => {
		if (exportSelected.size === 0) return;
		setExporting(true);
		try {
			const name = await exportBackup(exportSelected);
			if (name !== null) {
				toast.success(t("settings.backup.exportSuccess", "Backup exported"));
			}
		} catch (e) {
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
				setImportSelected(new Set(present));
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
						t("settings.backup.invalidFile", "Invalid or corrupted backup file"),
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
		} catch (e) {
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
			return value
				? t("settings.backup.hint.assetsSet", "Custom background image set")
				: t("settings.backup.hint.assetsNone", "No custom background image");
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
						{BACKUP_CATEGORY_IDS.map((id) => (
							<Flex key={id} align="center" gap="3">
								<Checkbox
									checked={exportSelected.has(id)}
									onCheckedChange={(v) =>
										toggle(setExportSelected, id, v === true)
									}
								/>
								<Flex direction="column">
									<Text size="2">{labels[id]}</Text>
									<Text size="1" color="gray">
										{exportHint(id)}
									</Text>
								</Flex>
							</Flex>
						))}
						<Flex justify="end">
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
