/**
 * Canonical screen -> rendering owner. Deliberately separate from domain-function
 * ownership: HOME dashboards belong to ANA, HOME search belongs to DISCOVERY,
 * and the global shell has no authoritative engineering data workspace.
 *
 * Resolving an unknown/retired screen MUST fail closed rather than choosing a
 * default domain renderer or an apparently valid engineering workspace.
 */
import { SCREEN_BY_ID } from "./screenRegistry";
import type { DomainCode } from "./capabilityRegistry";

export type WorkspaceKind = DomainCode | "DISCOVERY" | "SHELL";
export function workspaceForScreen(screenId:string):WorkspaceKind|null {
  const screen = SCREEN_BY_ID.get(screenId);
  if (!screen) return null;
  if (screen.domain === "HOM") return screen.id === "SCR-HOM-003" ? "DISCOVERY" : "ANA";
  if (screen.domain === "GLB") return "SHELL";
  return screen.domain;
}
