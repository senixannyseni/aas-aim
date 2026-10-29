import type { JSX } from "react";
import type { ScreenDefinition } from "./screenRegistry";
import { screenWorkflowGuidance } from "./workflowGuidance";

/** A non-authoritative orientation panel: no record access or navigation outside frozen screens. */
export function ScreenWorkflowGuide({screen,onNavigate}: {
  screen: ScreenDefinition;
  onNavigate: (screen: ScreenDefinition) => void;
}): JSX.Element {
  const guide = screenWorkflowGuidance(screen);
  return <details className="next-object-details next-workflow-guide" key={screen.id}>
    <summary>Workflow guidance · {screen.id} <span>Architecture only</span></summary>
    <div className="next-workflow-guide-body">
      <p className="next-workflow-caution">Use this as a navigation and evidence checklist, not an instruction to approve work. No records, permissions or engineering completeness are verified here.</p>
      <div className="next-workflow-grid">
        <section aria-label="Object families to check">
          <h3>Record families to check</h3>
          <p>Declared in the canonical screen mapping; check availability, provenance and scope in the owning workspace.</p>
          {guide.objectFamilies.length ? <ul>{guide.objectFamilies.map(name=><li key={name}>{name}</li>)}</ul> : <p>None declared in the screen mapping.</p>}
          {guide.objectTotal > guide.objectFamilies.length && <p>Showing {guide.objectFamilies.length} of {guide.objectTotal} mapped families. See the complete canonical object list below.</p>}
        </section>
        <section aria-label="Engineering review boundary">
          <h3>Review and authority</h3>
          <p>{guide.reviewBoundary}</p>
          {guide.protectedFunctionIds.length > 0 && <p>Mapped protected functions: <span className="next-workflow-ids">{guide.protectedFunctionIds.map(id=><code key={id}>{id}</code>)}</span></p>}
          {guide.note && <p className="next-workflow-source-note"><strong>Canonical screen note:</strong> {guide.note}</p>}
        </section>
        <section aria-label="Related canonical workspaces">
          <h3>Mapped next screens</h3>
          <p>Same-domain screens sharing a canonical function. These are navigation suggestions, not a prescribed sequence.</p>
          {guide.relatedScreens.length ? <ul className="next-workflow-links">{guide.relatedScreens.map(target=><li key={target.id}><button type="button" onClick={()=>onNavigate(target)}><code>{target.id}</code><span>{target.title}</span></button></li>)}</ul> : <p>No same-domain screen shares a mapped function.</p>}
        </section>
      </div>
      <details className="next-workflow-all-objects"><summary>All canonical object families ({screen.objects.length})</summary>
        <ul>{screen.objects.map(name=><li key={name}>{name}</li>)}</ul>
      </details>
    </div>
  </details>;
}
