import { CAPABILITY_BY_ID, DOMAINS } from "./capabilityRegistry";
import { SCREENS, type ScreenDefinition } from "./screenRegistry";

/** UI-only route discovery. This catalogue contains no tenant, identity, record, or permission data. */
export const WORKSPACE_RESULT_LIMIT = 8;
export const WORKSPACE_QUERY_LIMIT = 120;

export type WorkspaceSearchResult = Readonly<{
  matches: readonly ScreenDefinition[];
  total: number;
  truncated: boolean;
}>;

const domainNames = new Map<string, string>(DOMAINS.map(domain => [domain.code, domain.name]));
const searchIndex = SCREENS.map(screen => {
  const publicWords = [
    screen.id, screen.title, screen.domain, domainNames.get(screen.domain) ?? "",
    screen.surface, ...screen.functionIds, ...screen.objects,
    ...screen.functionIds.map(id => CAPABILITY_BY_ID.get(id)?.title ?? ""),
  ].join(" ").toLocaleLowerCase();
  return { screen, publicWords };
});

/** All tokens must match public architecture metadata; no runtime record search is performed. */
export function searchWorkspaceRoutes(input: unknown, requestedLimit = WORKSPACE_RESULT_LIMIT): WorkspaceSearchResult {
  if (typeof input !== "string") return { matches: [], total: 0, truncated: false };
  const query = input.trim().slice(0, WORKSPACE_QUERY_LIMIT).toLocaleLowerCase();
  if (!query) return { matches: [], total: 0, truncated: false };
  const tokens = query.split(/\s+/).filter(Boolean);
  const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, WORKSPACE_RESULT_LIMIT)) : WORKSPACE_RESULT_LIMIT;
  const matches = searchIndex
    .filter(({publicWords}) => tokens.every(token => publicWords.includes(token)))
    .sort((a, b) => {
      const rank = (item: typeof a): number => {
        const id = item.screen.id.toLocaleLowerCase();
        const title = item.screen.title.toLocaleLowerCase();
        if (id === query || title === query) return 0;
        if (id.startsWith(query) || title.startsWith(query)) return 1;
        if (id.includes(query) || title.includes(query)) return 2;
        return 3;
      };
      return rank(a) - rank(b) || a.screen.id.localeCompare(b.screen.id);
    });
  return { matches: matches.slice(0,limit).map(({screen})=>screen), total: matches.length, truncated: matches.length > limit };
}
