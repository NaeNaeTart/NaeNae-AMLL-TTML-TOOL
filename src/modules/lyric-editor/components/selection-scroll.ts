import { ToolMode } from "$/states/main.ts";

export const shouldAutoCenterSelection = (toolMode: ToolMode) =>
	toolMode === ToolMode.Sync;
