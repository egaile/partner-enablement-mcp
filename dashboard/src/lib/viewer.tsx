"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { gatewayFetch } from "@/lib/api";

export interface Me {
  tenantId: string;
  tenantName: string;
  userId: string;
  role: string;
  plan: string;
  readOnly: boolean;
  /**
   * True only for the shared demo login. Other read-only (`viewer`) accounts
   * are regular users. Older gateways omit it, so it's normalized to false.
   */
  demo: boolean;
}

interface ViewerState {
  me: Me | null;
  /** False until `/api/me` has answered (or failed). */
  loaded: boolean;
  /**
   * True for `viewer` accounts (including the demo login), and also while
   * `/api/me` is loading or after it fails (fail closed). The gateway enforces
   * it; the UI just hides controls.
   */
  readOnly: boolean;
  /** Re-run the `/api/me` request, e.g. after a failure. */
  retry: () => void;
}

const ViewerContext = createContext<ViewerState>({
  me: null,
  loaded: false,
  readOnly: true,
  retry: () => {},
});

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  // Remember which user the loaded permissions belong to, so a render right
  // after switching accounts never shows the previous user's permissions.
  const [state, setState] = useState<{ forUser: string | null; me: Me | null; loaded: boolean }>({
    forUser: null,
    me: null,
    loaded: false,
  });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, loaded: false }));
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const forUser = userId ?? null;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await gatewayFetch<Omit<Me, "demo"> & { demo?: boolean }>(
          "/api/me",
          token
        );
        if (!cancelled) {
          setState({ forUser, me: { ...data, demo: data.demo === true }, loaded: true });
        }
      } catch {
        // Leave `me` null. The UI stays read-only and DemoBanner offers a retry.
        if (!cancelled) setState({ forUser, me: null, loaded: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, userId, attempt]);

  // Permissions loaded for a different (previous) user count as not loaded.
  const current = state.forUser === (userId ?? null);
  const me = current ? state.me : null;
  const loaded = current && state.loaded;

  return (
    // Treat the user as read-only until the gateway says otherwise, and keep
    // it that way if `/api/me` fails, so write controls never show by mistake.
    <ViewerContext.Provider value={{ me, loaded, readOnly: me ? me.readOnly : true, retry }}>
      {children}
    </ViewerContext.Provider>
  );
}

export function useViewer(): ViewerState {
  return useContext(ViewerContext);
}

export function useReadOnly(): boolean {
  return useContext(ViewerContext).readOnly;
}

/**
 * Why write controls are hidden, so copy can match the situation:
 * - "demo": the shared demo login
 * - "account": a regular read-only (`viewer`) account
 * - "unknown": `/api/me` hasn't answered yet, or failed
 * - null: the user can edit
 */
export type ReadOnlyReason = "demo" | "account" | "unknown" | null;

export function useReadOnlyReason(): ReadOnlyReason {
  const { me } = useContext(ViewerContext);
  if (!me) return "unknown";
  if (!me.readOnly) return null;
  return me.demo ? "demo" : "account";
}
