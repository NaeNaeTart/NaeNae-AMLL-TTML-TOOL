import { getAllPlugins } from "./plugin-store";
import type { WASMPlugin, IntegratedPlugin, PluginMetadata } from "./types";

export interface IPluginInstance {
	metadata: PluginMetadata;
	runImporter: (input: string) => Promise<string>;
	runExporter: (data: string) => Promise<string>;
	runTool?: (lines: any[]) => Promise<any[]>;
}

class WASMPluginInstance implements IPluginInstance {
	constructor(
		public metadata: WASMPlugin,
		private instance: WebAssembly.Instance
	) {}

	private get exports() {
		return this.instance.exports as {
			allocate: (size: number) => number;
			deallocate?: (ptr: number, size: number) => void;
			run_importer: (ptr: number, len: number) => number;
			run_exporter: (ptr: number, len: number) => number;
			run_tool?: (ptr: number, len: number) => number;
			memory: WebAssembly.Memory;
		};
	}

	private copyStringToWasm(str: string): { ptr: number; len: number } {
		const encoder = new TextEncoder();
		const bytes = encoder.encode(str);
		const len = bytes.length;
		const ptr = this.exports.allocate(len);
		const memory = new Uint8Array(this.exports.memory.buffer);
		memory.set(bytes, ptr);
		return { ptr, len };
	}

	private readStringFromWasm(ptr: number): string {
		const memory = new Uint8Array(this.exports.memory.buffer);
		let end = ptr;
		while (memory[end] !== 0) end++;
		const decoder = new TextDecoder();
		return decoder.decode(memory.slice(ptr, end));
	}

	async runImporter(input: string): Promise<string> {
		if (this.metadata.type === "exporter") throw new Error("Plugin is not an importer");
		const { ptr, len } = this.copyStringToWasm(input);
		const resPtr = this.exports.run_importer(ptr, len);
		const result = this.readStringFromWasm(resPtr);
		if (this.exports.deallocate) this.exports.deallocate(ptr, len);
		return result;
	}

	async runExporter(data: string): Promise<string> {
		if (this.metadata.type === "importer") throw new Error("Plugin is not an exporter");
		const { ptr, len } = this.copyStringToWasm(data);
		const resPtr = this.exports.run_exporter(ptr, len);
		const result = this.readStringFromWasm(resPtr);
		if (this.exports.deallocate) this.exports.deallocate(ptr, len);
		return result;
	}

	async runTool(lines: any[]): Promise<any[]> {
		if (this.metadata.type === "importer" || this.metadata.type === "exporter") {
			throw new Error("Plugin does not support tool operations");
		}
		if (!this.exports.run_tool) throw new Error("WASM plugin does not export run_tool");

		const { ptr, len } = this.copyStringToWasm(JSON.stringify(lines));
		const resPtr = this.exports.run_tool(ptr, len);
		const result = this.readStringFromWasm(resPtr);
		if (this.exports.deallocate) this.exports.deallocate(ptr, len);
		return JSON.parse(result);
	}
}

class IntegratedPluginInstance implements IPluginInstance {
	constructor(public metadata: IntegratedPlugin) {}

	async runImporter(input: string): Promise<string> {
		if (!this.metadata.runImporter) throw new Error("Plugin does not support import");
		return this.metadata.runImporter(input);
	}

	async runExporter(data: string): Promise<string> {
		if (!this.metadata.runExporter) throw new Error("Plugin does not support export");
		return this.metadata.runExporter(data);
	}

	async runTool(lines: any[]): Promise<any[]> {
		if (!this.metadata.runTool) throw new Error("Plugin does not support tool");
		return this.metadata.runTool(lines);
	}
}

class PluginManager {
	private instances: Map<string, IPluginInstance> = new Map();

	async loadEnabledPlugins() {
		const plugins = await getAllPlugins();
		for (const plugin of plugins) {
			if (plugin.isEnabled && !plugin.isIntegrated) {
				await this.initializeWasmPlugin(plugin);
			}
		}
	}

	registerIntegratedPlugin(plugin: IntegratedPlugin) {
		if (plugin.isEnabled) {
			this.instances.set(plugin.id, new IntegratedPluginInstance(plugin));
		}
	}

	private async initializeWasmPlugin(plugin: WASMPlugin) {
		try {
			const arrayBuffer = await plugin.blob.arrayBuffer();
			const { instance } = await WebAssembly.instantiate(arrayBuffer, {
				env: {
					log: (ptr: number) => {
						const memory = new Uint8Array((instance.exports.memory as WebAssembly.Memory).buffer);
						let end = ptr;
						while (memory[end] !== 0) end++;
						console.log(`[Plugin: ${plugin.name}]`, new TextDecoder().decode(memory.slice(ptr, end)));
					}
				}
			});

			this.instances.set(plugin.id, new WASMPluginInstance(plugin, instance));
		} catch (error) {
			console.error(`Failed to initialize WASM plugin ${plugin.name}:`, error);
		}
	}

	getImporters() {
		return Array.from(this.instances.values()).filter(i => i.metadata.type !== "exporter");
	}

	getExporters() {
		return Array.from(this.instances.values()).filter(i => i.metadata.type !== "importer");
	}

	async runImporter(pluginId: string, input: string) {
		const instance = this.instances.get(pluginId);
		if (!instance) throw new Error("Plugin not found or not initialized");
		return instance.runImporter(input);
	}

	async runExporter(pluginId: string, data: string) {
		const instance = this.instances.get(pluginId);
		if (!instance) throw new Error("Plugin not found or not initialized");
		return instance.runExporter(data);
	}

	getTools() {
		return Array.from(this.instances.values()).filter(i => (i.metadata.type === "tool" || i.metadata.type === "both") && i.runTool);
	}

	async runTool(pluginId: string, lines: any[]) {
		const instance = this.instances.get(pluginId);
		if (!instance || !instance.runTool) throw new Error("Plugin not found or does not support tools");
		return instance.runTool(lines);
	}
}

export const pluginManager = new PluginManager();
