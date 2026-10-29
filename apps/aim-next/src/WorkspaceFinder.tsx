import { useMemo, useRef, useState, type JSX } from "react";
import type { ScreenDefinition } from "./screenRegistry";
import { searchWorkspaceRoutes, WORKSPACE_QUERY_LIMIT } from "./workspaceDiscovery";

/** Architecture-only discovery: never requests protected data or interprets a route as permission. */
export function WorkspaceFinder({currentScreenId,onNavigate}:{currentScreenId?:string|undefined;onNavigate:(screen:ScreenDefinition)=>void}):JSX.Element {
  const [query,setQuery] = useState("");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const results = useMemo(()=>searchWorkspaceRoutes(query),[query]);
  function navigate(target:ScreenDefinition):void {
    setQuery("");
    if(detailsRef.current)detailsRef.current.open=false;
    onNavigate(target);
  }
  return <div className="next-workspace-finder-shell">
    <details className="next-workspace-finder" ref={detailsRef}>
      <summary>Find a workspace <span aria-hidden="true">⌕</span></summary>
      <div className="next-workspace-finder-panel">
        <label htmlFor="aim-workspace-query">Search canonical screens</label>
        <input id="aim-workspace-query" type="search" value={query} maxLength={WORKSPACE_QUERY_LIMIT}
          onChange={event=>setQuery(event.target.value)} placeholder="Screen ID, title, function or object…" autoComplete="off"/>
        <p className="next-workspace-finder-hint">Screen catalogue only. Finding a route does not fetch records or grant domain access.</p>
        {query.trim() ? <>
          <p className="next-workspace-finder-count" role="status">{results.total} matching canonical {results.total===1?"screen":"screens"}{results.truncated ? ` · first ${results.matches.length} shown; refine your search` : ""}</p>
          <div className="next-workspace-finder-results" role="group" aria-label="Matching canonical screens">
            {results.matches.map(target=><button key={target.id} type="button" onClick={()=>navigate(target)}
              aria-current={target.id===currentScreenId?"page":undefined}>
              <span><strong>{target.title}</strong><small>{target.id} · {target.surface} · {target.functionIds.length} mapped functions</small></span>
              <span className="next-workspace-finder-route">{target.domain} <span aria-hidden="true">↗</span></span>
            </button>)}
          </div>
        </> : <p className="next-workspace-finder-hint">Enter a name or canonical ID to find a screen.</p>}
      </div>
    </details>
  </div>;
}
