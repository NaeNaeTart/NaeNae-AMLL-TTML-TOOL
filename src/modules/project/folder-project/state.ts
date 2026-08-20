import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { ProjectManifest } from "./types";
import type { ScannedProject } from "./workspace-scan";

export const activeProjectDirAtom = atom<string | null>(null);

export const activeProjectManifestAtom = atom<ProjectManifest | null>(null);

export const workspaceProjectsAtom = atom<ScannedProject[]>([]);

export const workspaceDirAtom = atomWithStorage<string | null>("lastWorkspaceDir", null);

export const workspaceScanningAtom = atom(false);
