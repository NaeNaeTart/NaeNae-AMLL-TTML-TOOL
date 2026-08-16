import type { BackupFile } from "$/modules/settings/backup/types";

export type MigrationConflictSummary = {
	settings: string[];
	keybindings: string[];
	projects: string[];
	plugins: string[];
	background: boolean;
};

export type MigrationMergeChoices = {
	replaceSettings: boolean;
	replaceKeybindings: boolean;
	replacePlugins: boolean;
	replaceBackground: boolean;
};

const differentEntries = (
	source: Record<string, string> = {},
	destination: Record<string, string> = {},
) =>
	Object.keys(source).filter(
		(key) => key in destination && source[key] !== destination[key],
	);

export function getMigrationConflicts(
	source: BackupFile,
	destination: BackupFile,
): MigrationConflictSummary {
	const sourceProjects = source.categories.projects?.projects ?? [];
	const destinationProjects = new Set(
		(destination.categories.projects?.projects ?? []).map(
			(project) => project.id,
		),
	);
	const sourcePlugins = source.categories.plugins?.plugins ?? [];
	const destinationPlugins = new Set(
		(destination.categories.plugins?.plugins ?? []).map((plugin) => plugin.id),
	);

	return {
		settings: differentEntries(
			source.categories.settings?.localStorage,
			destination.categories.settings?.localStorage,
		),
		keybindings: differentEntries(
			source.categories.keybindings?.localStorage,
			destination.categories.keybindings?.localStorage,
		),
		projects: sourceProjects
			.filter((project) => destinationProjects.has(project.id))
			.map((project) => project.id),
		plugins: sourcePlugins
			.filter((plugin) => destinationPlugins.has(plugin.id))
			.map((plugin) => plugin.id),
		background: Boolean(
			source.categories.assets?.backgroundImage &&
				destination.categories.assets?.backgroundImage,
		),
	};
}

export function hasMigrationConflicts(conflicts: MigrationConflictSummary) {
	return (
		conflicts.settings.length > 0 ||
		conflicts.keybindings.length > 0 ||
		conflicts.projects.length > 0 ||
		conflicts.plugins.length > 0 ||
		conflicts.background
	);
}

export function mergeMigrationBackup(
	source: BackupFile,
	destination: BackupFile,
	choices: MigrationMergeChoices,
): BackupFile {
	const destinationProjects = destination.categories.projects?.projects ?? [];
	const sourceProjects = source.categories.projects?.projects ?? [];
	const projectMap = new Map(
		destinationProjects.map((project) => [project.id, project]),
	);
	for (const sourceProject of sourceProjects) {
		const current = projectMap.get(sourceProject.id);
		if (!current || sourceProject.lastModified >= current.lastModified)
			projectMap.set(sourceProject.id, sourceProject);
	}
	const sourceChosenProjectIds = new Set(
		sourceProjects
			.filter((project) => projectMap.get(project.id) === project)
			.map((project) => project.id),
	);
	const destinationVersions = destination.categories.projects?.versions ?? [];
	const sourceVersions = source.categories.projects?.versions ?? [];
	const mergedVersions = [
		...destinationVersions.filter(
			(version) => !sourceChosenProjectIds.has(version.projectId),
		),
		...sourceVersions.filter((version) =>
			sourceChosenProjectIds.has(version.projectId),
		),
	];

	const destinationPlugins = destination.categories.plugins?.plugins ?? [];
	const sourcePlugins = source.categories.plugins?.plugins ?? [];
	const pluginMap = new Map(
		destinationPlugins.map((plugin) => [plugin.id, plugin]),
	);
	for (const plugin of sourcePlugins) {
		if (!pluginMap.has(plugin.id) || choices.replacePlugins)
			pluginMap.set(plugin.id, plugin);
	}

	const mergeEntries = (
		destinationEntries: Record<string, string> = {},
		sourceEntries: Record<string, string> = {},
		replace: boolean,
	) =>
		replace
			? { ...destinationEntries, ...sourceEntries }
			: { ...sourceEntries, ...destinationEntries };

	return {
		...source,
		categories: {
			settings: {
				localStorage: mergeEntries(
					destination.categories.settings?.localStorage,
					source.categories.settings?.localStorage,
					choices.replaceSettings,
				),
			},
			keybindings: {
				localStorage: mergeEntries(
					destination.categories.keybindings?.localStorage,
					source.categories.keybindings?.localStorage,
					choices.replaceKeybindings,
				),
			},
			assets: choices.replaceBackground
				? (source.categories.assets ?? destination.categories.assets)
				: (destination.categories.assets ?? source.categories.assets),
			projects: {
				projects: [...projectMap.values()],
				versions: mergedVersions,
			},
			plugins: { plugins: [...pluginMap.values()] },
		},
	};
}
