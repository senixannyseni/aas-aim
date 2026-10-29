import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiClient } from "@bandha/aim-platform/api/apiClient";
import type { AuthSessionBoundary, AuthSessionPhase } from "@bandha/aim-platform/auth/authSession";
import { useAuthSession } from "@bandha/aim-platform/auth/useAuthSession";
import { classifyAssetEvidenceFailure, requestAssetEvidencePage,
  type AuthorizedEvidencePage, type EvidenceGroup } from "./assetEvidenceReadModel";
import type { ReadFailure } from "./authorizedReadState";
import { advanceEvidenceCursor, previousEvidenceCursor, restartEvidenceCursor,
  FIRST_EVIDENCE_PAGE, type EvidenceCursorStep } from "./evidenceCursorTrail";

export type AssetEvidenceState =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; page: AuthorizedEvidencePage; pageNumber: number }>
  | Readonly<{ kind: "error"; failure: ReadFailure }>;

type Context = Readonly<{ client: ApiClient; sessionRevision: number; assetId: string;
  revisionId: string; group: EvidenceGroup }>;
type Navigation = Context & Readonly<{ steps: readonly EvidenceCursorStep[]; index: number; attempt: number }>;
type Owned = Context & Readonly<{ cursor: string | null; snapshotKey: string | null;
  attempt: number; state: AssetEvidenceState }>;

const IDLE: AssetEvidenceState = Object.freeze({ kind: "idle" });

export type AuthorizedAssetEvidenceController = Readonly<{
  phase: AuthSessionPhase;
  state: AssetEvidenceState;
  nextPage: () => void;
  previousPage: () => void;
  retry: () => void;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}>;

/**
 * A deliberately bounded, one-page-at-a-time read controller. All requests
 * use the trusted authenticated client, and previous revisions/sessions never
 * flash while effects process a transition. Evidence-list access never permits
 * independent access to a document or measurement body.
 */
export function useAuthorizedAssetEvidence(
  boundary: AuthSessionBoundary | null,
  requested: Readonly<{ assetId: string; revisionId: string; group: EvidenceGroup;
    sessionRevision: number }> | null,
): AuthorizedAssetEvidenceController {
  const session = useAuthSession(boundary);
  const client = session.phase === "authenticated" ? session.client : null;
  const valid = client !== null && requested !== null && requested.sessionRevision === session.revision;
  const assetId = valid ? requested!.assetId : null;
  const revisionId = valid ? requested!.revisionId : null;
  const group = valid ? requested!.group : null;
  const [navigation, setNavigation] = useState<Navigation | null>(null);
  const [owned, setOwned] = useState<Owned | null>(null);
  const epoch = useRef(0);

  const matching = client !== null && assetId !== null && revisionId !== null && group !== null &&
    navigation?.client === client && navigation.sessionRevision === session.revision &&
    navigation.assetId === assetId && navigation.revisionId === revisionId && navigation.group === group;
  const steps: readonly EvidenceCursorStep[] = matching ? navigation!.steps : [FIRST_EVIDENCE_PAGE];
  const index = matching ? navigation!.index : 0;
  const attempt = matching ? navigation!.attempt : 0;
  const step = steps[index] ?? FIRST_EVIDENCE_PAGE;

  useEffect(() => {
    const thisEpoch = ++epoch.current;
    if (client === null || assetId === null || revisionId === null || group === null) return;
    const abort = new AbortController();
    let live = true;
    const context: Context = { client, sessionRevision: session.revision, assetId, revisionId, group };
    const owner: Owned = { ...context, cursor: step.cursor, snapshotKey: step.snapshotKey,
      attempt, state: { kind: "loading" } };
    setOwned(owner);
    // Request validation can throw before a Promise is returned. Convert that
    // failure into a rejected request so React's effect never throws uncaught
    // when a caller provides a malformed revision or asset identity.
    let request: Promise<AuthorizedEvidencePage>;
    try {
      request = requestAssetEvidencePage(client, {
        assetId, viewRevisionId: revisionId, group, cursor: step.cursor,
        snapshotKey: step.snapshotKey,
      }, abort.signal);
    } catch (failure: unknown) {
      request = Promise.reject(failure);
    }
    void request.then(page => {
      if (!live || abort.signal.aborted || thisEpoch !== epoch.current) return;
      setOwned({ ...owner, state: { kind: "ready", page, pageNumber: index + 1 } });
    }).catch((failure: unknown) => {
      if (!live || abort.signal.aborted || thisEpoch !== epoch.current) return;
      setOwned({ ...owner, state: { kind: "error", failure: classifyAssetEvidenceFailure(failure) } });
    });
    return () => { live = false; ++epoch.current; abort.abort(); };
  }, [client, assetId, revisionId, group, session.revision, step.cursor,
    step.snapshotKey, attempt, index]);

  const state: AssetEvidenceState = !valid || client === null || assetId === null ||
    revisionId === null || group === null ? IDLE :
    owned?.client !== client || owned.sessionRevision !== session.revision ||
    owned.assetId !== assetId || owned.revisionId !== revisionId || owned.group !== group ||
    owned.cursor !== step.cursor || owned.snapshotKey !== step.snapshotKey ||
    owned.attempt !== attempt ? { kind: "loading" } : owned.state;

  const advanced = state.kind === "ready"
    ? advanceEvidenceCursor({ steps, index }, state.page) : null;

  const nextPage = useCallback(() => {
    if (advanced === null || client === null || assetId === null ||
        revisionId === null || group === null) return;
    const current: Context = { client, sessionRevision: session.revision, assetId, revisionId, group };
    setNavigation({ ...current, ...advanced, attempt: 0 });
  }, [advanced, client, assetId, revisionId, group, session.revision]);

  const previousPage = useCallback(() => {
    if (!valid || client === null || assetId === null || revisionId === null || group === null) return;
    const previous = previousEvidenceCursor({ steps, index });
    if (previous === null) return;
    setNavigation({ client, sessionRevision: session.revision, assetId, revisionId,
      group, ...previous, attempt: 0 });
  }, [valid, client, assetId, revisionId, group, session.revision, steps, index]);

  const retry = useCallback(() => {
    if (!valid || client === null || assetId === null || revisionId === null || group === null) return;
    setOwned(null);
    // Cursor failures (including a changed authorized source generation) must
    // be recoverable by restarting at the first page, not retrying a stale token.
    setNavigation({ client, sessionRevision: session.revision, assetId, revisionId,
      group, ...(index > 0 ? restartEvidenceCursor() : { steps, index }),
      attempt: attempt + 1 });
  }, [valid, client, assetId, revisionId, group, session.revision, steps, index, attempt]);

  return { phase: session.phase, state, nextPage, previousPage,
    retry, hasPreviousPage: valid && index > 0,
    hasNextPage: advanced !== null };
}
