import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiClient } from "@bandha/aim-platform/api/apiClient";
import type { AuthSessionBoundary, AuthSessionPhase } from
  "@bandha/aim-platform/auth/authSession";
import { useAuthSession } from "@bandha/aim-platform/auth/useAuthSession";
import type { ReadFailure } from "./authorizedReadState";
import type { AssetPageSelection } from "./assetRegisterReadModel";
import { classifyAssetDetailFailure, requestAssetDetail, validateAssetDetailId,
  type AssetDetailReadModel } from "./assetDetailReadModel";

export type AssetDetailState =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "loading"; assetId: string }>
  | Readonly<{ kind: "ready"; assetId: string; detail: AssetDetailReadModel }>
  | Readonly<{ kind: "error"; assetId: string; failure: ReadFailure }>;

type OwnedDetail = Readonly<{
  client: ApiClient;
  sessionRevision: number;
  assetId: string;
  state: AssetDetailState;
}>;

export type AuthorizedAssetDetailController = Readonly<{
  phase: AuthSessionPhase;
  state: AssetDetailState;
  retry: () => void;
}>;

const IDLE: AssetDetailState = Object.freeze({ kind: "idle" });

/**
 * Stage 45.4 — ONLY performs an independently authorized GET for a selected
 * Asset Register item. Never interprets list visibility as detail permission.
 * Fail-closed synchronous presentation guards complement abort + request epoch.
 */
export function useAuthorizedAssetDetail(
  boundary: AuthSessionBoundary | null,
  selection: AssetPageSelection | null,
): AuthorizedAssetDetailController {
  const session = useAuthSession(boundary);
  const client = session.phase === "authenticated" ? session.client : null;
  const assetId = selection?.sessionRevision === session.revision ? selection.assetId : null;
  const [owned, setOwned] = useState<OwnedDetail | null>(null);
  const [retryRevision, setRetryRevision] = useState(0);
  const requestEpoch = useRef(0);
  const pending = useRef<AbortController | null>(null);

  const valid = client !== null && assetId !== null && (() => {
    try { validateAssetDetailId(assetId); return true; } catch { return false; }
  })();

  const retry = useCallback((): void => {
    if (!valid) return;
    requestEpoch.current += 1;
    pending.current?.abort();
    setOwned(null);
    setRetryRevision(value => value + 1);
  }, [valid]);

  useEffect(() => {
    const epoch = ++requestEpoch.current;
    if (!valid || client === null || assetId === null) {
      pending.current = null;
      return;
    }
    const abort = new AbortController();
    pending.current = abort;
    let live = true;
    setOwned({ client, sessionRevision: session.revision, assetId,
      state: { kind: "loading", assetId } });

    void requestAssetDetail(client, assetId, abort.signal).then(detail => {
      if (!live || abort.signal.aborted || requestEpoch.current !== epoch) return;
      setOwned({ client, sessionRevision: session.revision, assetId,
        state: { kind: "ready", assetId, detail } });
    }).catch((error: unknown) => {
      if (!live || abort.signal.aborted || requestEpoch.current !== epoch) return;
      setOwned({ client, sessionRevision: session.revision, assetId,
        state: { kind: "error", assetId, failure: classifyAssetDetailFailure(error) } });
    }).finally(() => {
      if (pending.current === abort) pending.current = null;
    });

    return () => {
      live = false;
      requestEpoch.current += 1;
      abort.abort();
      if (pending.current === abort) pending.current = null;
    };
  }, [client, assetId, session.revision, valid, retryRevision]);

  // Synchronous fail-closed guard: old records never flash while effects have
  // not yet run after a session, boundary, or selected asset changes.
  const visible: AssetDetailState = !valid || client === null || assetId === null
    ? IDLE
    : owned?.client !== client || owned.sessionRevision !== session.revision ||
        owned.assetId !== assetId ? { kind: "loading", assetId }
    : owned.state;

  return { phase: session.phase, state: visible, retry };
}
