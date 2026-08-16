import { ArrowDownload24Regular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Checkbox,
	Flex,
	Heading,
	Progress,
	Text,
	Theme,
} from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToastContainer } from "react-toastify";
import {
	type BackupCounts,
	buildBackup,
	exportBackup,
	getBackupCounts,
	saveBackupFile,
} from "$/modules/settings/backup/export";
import { applyBackup } from "$/modules/settings/backup/import";
import {
	BACKUP_CATEGORY_IDS,
	type BackupFile,
	validateBackupFile,
} from "$/modules/settings/backup/types";
import {
	classifyMigrationOrigin,
	createMigrationNonce,
	LEGACY_TOOL_ORIGINS,
	MIGRATION_COMPLETED_KEY,
	MIGRATION_PROTOCOL_VERSION,
	OFFICIAL_TOOL_ORIGIN,
} from "./config";
import {
	getMigrationConflicts,
	hasMigrationConflicts,
	type MigrationConflictSummary,
	type MigrationMergeChoices,
	mergeMigrationBackup,
} from "./merge";
import {
	decodeMigrationPayload,
	encodeMigrationPayload,
	isMigrationMessage,
	type MigrationCounts,
	type MigrationMessage,
} from "./protocol";

const allCategories = new Set(BACKUP_CATEGORY_IDS);
const messageTimeout = 30_000;

function countsText(counts: BackupCounts | MigrationCounts | null) {
	if (!counts) return "Checking local data…";
	return `${counts.settings} settings · ${counts.keybindings} shortcuts · ${counts.projects} projects · ${counts.plugins} plugins${counts.assets ? " · background image" : ""}`;
}

function waitForMigrationMessage(
	accept: (event: MessageEvent, message: MigrationMessage) => boolean,
	peer?: Window,
) {
	return new Promise<MigrationMessage>((resolve, reject) => {
		const cleanup = () => {
			window.clearTimeout(timeout);
			window.clearInterval(closedPoll);
			window.removeEventListener("message", listener);
		};
		const timeout = window.setTimeout(() => {
			cleanup();
			reject(new Error("The migration connection timed out."));
		}, messageTimeout);
		const closedPoll = window.setInterval(() => {
			if (!peer?.closed) return;
			cleanup();
			reject(new Error("The official-tool window was closed."));
		}, 500);
		const listener = (event: MessageEvent) => {
			if (!isMigrationMessage(event.data) || !accept(event, event.data)) return;
			cleanup();
			resolve(event.data);
		};
		window.addEventListener("message", listener);
	});
}

type MigrationReply =
	| { type: "chunk-ack"; index: number }
	| { type: "migration-complete"; counts: MigrationCounts }
	| { type: "migration-error"; reason: string }
	| { type: "migration-cancelled" };

function MigrationShell({ children }: { children: React.ReactNode }) {
	return (
		<Theme appearance="dark" accentColor="red">
			<Flex align="center" justify="center" minHeight="100vh" p="4">
				<Card style={{ width: "min(680px, 100%)" }}>{children}</Card>
			</Flex>
			<ToastContainer theme="dark" />
		</Theme>
	);
}

function SenderPage() {
	const [counts, setCounts] = useState<BackupCounts | null>(null);
	const [status, setStatus] = useState("Ready to move your local data.");
	const [progress, setProgress] = useState(0);
	const [working, setWorking] = useState(false);

	useEffect(() => {
		void getBackupCounts()
			.then(setCounts)
			.catch(() => setStatus("Could not inspect local data."));
	}, []);

	const migrate = useCallback(async () => {
		const nonce = createMigrationNonce();
		const receiver = window.open(
			`${OFFICIAL_TOOL_ORIGIN}/migration/receive#${nonce}`,
			"amll-domain-migration",
		);
		if (!receiver) {
			setStatus(
				"Your browser blocked the migration window. Allow popups and try again, or download a backup.",
			);
			return;
		}
		setWorking(true);
		try {
			setStatus("Waiting for the official tool…");
			const ready = waitForMigrationMessage(
				(event, message) =>
					event.origin === OFFICIAL_TOOL_ORIGIN &&
					event.source === receiver &&
					message.nonce === nonce &&
					message.type === "receiver-ready",
				receiver,
			);
			await ready;
			setStatus("Preparing your backup…");
			const backup = await buildBackup(allCategories);
			const chunks = encodeMigrationPayload(backup);
			receiver.postMessage(
				{
					type: "metadata",
					protocol: MIGRATION_PROTOCOL_VERSION,
					nonce,
					counts: counts ?? (await getBackupCounts()),
					totalChunks: chunks.length,
				} satisfies MigrationMessage,
				OFFICIAL_TOOL_ORIGIN,
			);

			for (let index = 0; index < chunks.length; index++) {
				const data = chunks[index];
				const acknowledgement = waitForMigrationMessage(
					(event, message) =>
						event.origin === OFFICIAL_TOOL_ORIGIN &&
						event.source === receiver &&
						message.nonce === nonce &&
						message.type === "chunk-ack" &&
						message.index === index,
					receiver,
				);
				receiver.postMessage(
					{
						type: "chunk",
						protocol: MIGRATION_PROTOCOL_VERSION,
						nonce,
						index,
						data,
					} satisfies MigrationMessage,
					OFFICIAL_TOOL_ORIGIN,
					[data],
				);
				await acknowledgement;
				setProgress(((index + 1) / chunks.length) * 100);
			}
			const resultPromise = waitForMigrationMessage(
				(event, message) =>
					event.origin === OFFICIAL_TOOL_ORIGIN &&
					event.source === receiver &&
					message.nonce === nonce &&
					(message.type === "migration-complete" ||
						message.type === "migration-error" ||
						message.type === "migration-cancelled"),
				receiver,
			);
			receiver.postMessage(
				{
					type: "transfer-complete",
					protocol: MIGRATION_PROTOCOL_VERSION,
					nonce,
				},
				OFFICIAL_TOOL_ORIGIN,
			);
			setStatus("Review and finish the migration in the official-tool window.");
			const result = await resultPromise;
			if (result.type === "migration-error") throw new Error(result.reason);
			if (result.type === "migration-cancelled")
				throw new Error("Migration was cancelled on the official domain.");
			localStorage.setItem(MIGRATION_COMPLETED_KEY, new Date().toISOString());
			setProgress(100);
			setStatus(
				"Migration complete. This copy remains available until you close it.",
			);
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: "Migration failed. Your source data was not changed.",
			);
		} finally {
			setWorking(false);
		}
	}, [counts]);

	return (
		<MigrationShell>
			<Flex direction="column" gap="4">
				<Box>
					<Heading>Move to the official AMLL TTML Tool</Heading>
					<Text color="gray">{OFFICIAL_TOOL_ORIGIN}</Text>
				</Box>
				<Text>{countsText(counts)}</Text>
				<Text size="2" color="gray">
					Your data is transferred directly between browser windows and is never
					uploaded.
				</Text>
				{progress > 0 && <Progress value={progress} />}
				<Text size="2">{status}</Text>
				<Flex gap="2" justify="end" wrap="wrap">
					<Button
						variant="soft"
						color="gray"
						onClick={() => void exportBackup(allCategories)}
					>
						<ArrowDownload24Regular /> Download backup
					</Button>
					<Button disabled={!counts || working} onClick={() => void migrate()}>
						Move my data
					</Button>
				</Flex>
			</Flex>
		</MigrationShell>
	);
}

function conflictCount(conflicts: MigrationConflictSummary) {
	return (
		conflicts.settings.length +
		conflicts.keybindings.length +
		conflicts.projects.length +
		conflicts.plugins.length +
		Number(conflicts.background)
	);
}

function ReceiverPage() {
	const nonce = useMemo(() => window.location.hash.slice(1), []);
	const opener = useRef(window.opener);
	const chunks = useRef<ArrayBuffer[]>([]);
	const expectedChunks = useRef(0);
	const receivedChunks = useRef(new Set<number>());
	const sourceOrigin = useRef<string | null>(null);
	const accepted = useRef(false);
	const completed = useRef(false);
	const [source, setSource] = useState<BackupFile | null>(null);
	const [destination, setDestination] = useState<BackupFile | null>(null);
	const [conflicts, setConflicts] = useState<MigrationConflictSummary | null>(
		null,
	);
	const [status, setStatus] = useState("Connecting to the old domain…");
	const [working, setWorking] = useState(false);
	const [choices, setChoices] = useState<MigrationMergeChoices>({
		replaceSettings: false,
		replaceKeybindings: false,
		replacePlugins: false,
		replaceBackground: false,
	});

	const reply = useCallback(
		(message: MigrationReply) => {
			if (!opener.current || !sourceOrigin.current) return;
			opener.current.postMessage(
				{ ...message, protocol: MIGRATION_PROTOCOL_VERSION, nonce },
				sourceOrigin.current,
			);
		},
		[nonce],
	);

	const finish = useCallback(
		async (
			sourceBackup: BackupFile,
			destinationBackup: BackupFile,
			mergeChoices: MigrationMergeChoices,
		) => {
			setWorking(true);
			try {
				const merged = mergeMigrationBackup(
					sourceBackup,
					destinationBackup,
					mergeChoices,
				);
				await applyBackup(merged, allCategories);
				const verifiedCounts = await getBackupCounts();
				const expected = {
					settings: Object.keys(merged.categories.settings?.localStorage ?? {})
						.length,
					keybindings: Object.keys(
						merged.categories.keybindings?.localStorage ?? {},
					).length,
					assets: Boolean(merged.categories.assets?.backgroundImage),
					projects: merged.categories.projects?.projects.length ?? 0,
					plugins: merged.categories.plugins?.plugins.length ?? 0,
				};
				if (
					verifiedCounts.settings < expected.settings ||
					verifiedCounts.keybindings < expected.keybindings ||
					verifiedCounts.projects < expected.projects ||
					verifiedCounts.plugins < expected.plugins ||
					(expected.assets && !verifiedCounts.assets)
				)
					throw new Error("The migrated data could not be verified.");
				localStorage.setItem(MIGRATION_COMPLETED_KEY, new Date().toISOString());
				completed.current = true;
				reply({ type: "migration-complete", counts: verifiedCounts });
				setStatus("Migration complete. Opening the official tool…");
				window.setTimeout(() => window.location.replace("/"), 1200);
			} catch (error) {
				const reason =
					error instanceof Error
						? error.message
						: "Could not apply the migrated data.";
				reply({ type: "migration-error", reason });
				setStatus(`${reason} No source data was removed.`);
				setWorking(false);
			}
		},
		[reply],
	);

	useEffect(() => {
		window.history.replaceState(null, "", window.location.pathname);
		if (!/^[a-f0-9]{32}$/.test(nonce) || !opener.current) {
			setStatus(
				"This migration link is invalid or was opened without the old tool.",
			);
			return;
		}

		const listener = (event: MessageEvent) => {
			if (
				!(LEGACY_TOOL_ORIGINS as readonly string[]).includes(event.origin) ||
				event.source !== opener.current ||
				!isMigrationMessage(event.data) ||
				event.data.nonce !== nonce
			)
				return;
			const message = event.data;
			sourceOrigin.current = event.origin;
			if (message.type === "metadata" && !accepted.current) {
				accepted.current = true;
				expectedChunks.current = message.totalChunks;
				chunks.current = new Array(message.totalChunks);
				receivedChunks.current.clear();
				setStatus(`Receiving ${countsText(message.counts)}…`);
				return;
			}
			if (message.type === "chunk" && accepted.current) {
				if (message.index < 0 || message.index >= expectedChunks.current)
					return;
				if (receivedChunks.current.has(message.index)) {
					reply({
						type: "migration-error",
						reason: "A duplicate migration chunk was rejected.",
					});
					return;
				}
				chunks.current[message.index] = message.data;
				receivedChunks.current.add(message.index);
				reply({ type: "chunk-ack", index: message.index });
				return;
			}
			if (message.type === "transfer-complete" && accepted.current) {
				if (chunks.current.some((chunk) => !(chunk instanceof ArrayBuffer))) {
					reply({
						type: "migration-error",
						reason: "The transfer was incomplete.",
					});
					setStatus(
						"The transfer was incomplete. Try again from the old domain.",
					);
					return;
				}
				void (async () => {
					try {
						const decoded = decodeMigrationPayload(chunks.current);
						validateBackupFile(decoded);
						const current = await buildBackup(allCategories);
						const nextConflicts = getMigrationConflicts(decoded, current);
						setSource(decoded);
						setDestination(current);
						setConflicts(nextConflicts);
						if (!hasMigrationConflicts(nextConflicts)) {
							setStatus("Applying migrated data…");
							await finish(decoded, current, {
								replaceSettings: false,
								replaceKeybindings: false,
								replacePlugins: false,
								replaceBackground: false,
							});
						} else {
							setStatus("Review the matching data before finishing.");
						}
					} catch (error) {
						const reason =
							error instanceof Error
								? error.message
								: "The migration backup is invalid.";
						reply({ type: "migration-error", reason });
						setStatus(reason);
					}
				})();
			}
		};
		const cancelOnClose = () => {
			if (!completed.current) reply({ type: "migration-cancelled" });
		};
		window.addEventListener("message", listener);
		window.addEventListener("beforeunload", cancelOnClose);
		for (const origin of LEGACY_TOOL_ORIGINS) {
			opener.current.postMessage(
				{ type: "receiver-ready", protocol: MIGRATION_PROTOCOL_VERSION, nonce },
				origin,
			);
		}
		return () => {
			window.removeEventListener("message", listener);
			window.removeEventListener("beforeunload", cancelOnClose);
		};
	}, [finish, nonce, reply]);

	return (
		<MigrationShell>
			<Flex direction="column" gap="4">
				<Heading>Receive data on the official domain</Heading>
				<Text size="2">{status}</Text>
				{conflicts && hasMigrationConflicts(conflicts) && (
					<Flex direction="column" gap="3">
						<Text color="orange">
							{conflictCount(conflicts)} matching items need a merge decision.
							Matching projects automatically keep the newer copy.
						</Text>
						{(
							[
								[
									"replaceSettings",
									conflicts.settings.length,
									"Use old-domain values for matching settings",
								],
								[
									"replaceKeybindings",
									conflicts.keybindings.length,
									"Use old-domain values for matching shortcuts",
								],
								[
									"replacePlugins",
									conflicts.plugins.length,
									"Use old-domain versions of matching plugins",
								],
								[
									"replaceBackground",
									Number(conflicts.background),
									"Use the old-domain background image",
								],
							] as const
						)
							.filter(([, count]) => count > 0)
							.map(([key, , label]) => (
								<Text as="label" key={key}>
									<Flex gap="2" align="center">
										<Checkbox
											checked={choices[key]}
											onCheckedChange={(value) =>
												setChoices((current) => ({
													...current,
													[key]: value === true,
												}))
											}
										/>
										{label}
									</Flex>
								</Text>
							))}
						<Button
							disabled={!source || !destination || working}
							onClick={() =>
								source &&
								destination &&
								void finish(source, destination, choices)
							}
						>
							Merge and finish
						</Button>
					</Flex>
				)}
				{source && (
					<Button
						variant="soft"
						color="gray"
						onClick={() => void saveBackupFile(source)}
					>
						<ArrowDownload24Regular /> Download received backup
					</Button>
				)}
			</Flex>
		</MigrationShell>
	);
}

export function MigrationRouteApp() {
	const kind = classifyMigrationOrigin(
		window.location.origin,
		Boolean(import.meta.env.TAURI_ENV_PLATFORM),
	);
	if (window.location.pathname === "/migration/send" && kind === "legacy")
		return <SenderPage />;
	if (window.location.pathname === "/migration/receive" && kind === "official")
		return <ReceiverPage />;
	return (
		<MigrationShell>
			<Heading>Invalid migration route</Heading>
			<Text>
				This page is only available on the controlled old and official domains.
			</Text>
		</MigrationShell>
	);
}
