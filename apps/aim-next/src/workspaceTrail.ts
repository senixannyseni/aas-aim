import { SCREEN_BY_ID } from "./screenRegistry";

/** Short-lived, scope-local navigation metadata: canonical screen IDs only. */
export const MAX_RECENT_WORKSPACES = 6;

/** Reject malformed/retired IDs and deduplicate repeat visits without persisting context. */
export function recordWorkspaceVisit(previous: readonly string[], screenId: unknown): readonly string[] {
  if (typeof screenId !== "string" || !SCREEN_BY_ID.has(screenId)) return previous;
  return [screenId, ...previous.filter(id => id !== screenId && SCREEN_BY_ID.has(id))]
    .slice(0, MAX_RECENT_WORKSPACES);
}

/** Only the previous five canonical screens are navigable; the active surface is excluded. */
export function recentWorkspaceTargets(previous: readonly string[], activeId: string | null): readonly string[] {
  return previous.filter(id => id !== activeId && SCREEN_BY_ID.has(id)).slice(0, MAX_RECENT_WORKSPACES - 1);
}
