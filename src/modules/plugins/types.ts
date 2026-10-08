export type PluginType = "importer" | "exporter" | "tool" | "both";

export interface PluginMetadata {
	id: string;
	name: string;
	description: string;
	author: string;
	version: string;
	type: PluginType;
	isEnabled: boolean;
	createdAt: number;
	isIntegrated?: boolean;
	techniques?: string[];
	usage?: string;
}

export interface WASMPlugin extends PluginMetadata {
	blob: Blob; // The actual .wasm file
	sha256?: string; // Optional hash for integrity verification
}

export interface PluginRegistryEntry
	extends Omit<PluginMetadata, "isEnabled" | "createdAt" | "blob"> {
	downloadUrl: string;
	sha256: string;
}

export interface IntegratedPlugin extends PluginMetadata {
	isIntegrated: true;
	runImporter?: (input: string) => Promise<string>;
	runExporter?: (data: string) => Promise<string>;
	runTool?: (lines: any[]) => Promise<any[]>;
}
