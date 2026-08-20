export interface Model {
  id: string;
  name: string;
  version: string;
  predict(input: unknown): Promise<unknown>;
}

export type ModelFactory = () => Model;

type RegistryMap = Map<string, Model>;
export const modelsRegistry: RegistryMap = new Map();

export function registerModel(model: Model): void {
  modelsRegistry.set(model.id, model);
}

export function getModel(id: string): Model | undefined {
  return modelsRegistry.get(id);
}

export function listModels(): Model[] {
  return Array.from(modelsRegistry.values());
}
