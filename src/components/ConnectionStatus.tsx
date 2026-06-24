import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2, Wifi, Power } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const FORCED_OFFLINE_KEY = "lovable.forcedOffline";

function triggerSync() {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SYNC_NOW" });
  }
  // Best-effort: nudge react-query / supabase listeners
  window.dispatchEvent(new Event("online"));
}

/**
 * Floating connection status indicator + manual online/offline toggle.
 */
export function ConnectionStatus() {
  const { lang } = useI18n();
  const fr = lang === "fr";

  const [networkOnline, setNetworkOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [forcedOffline, setForcedOffline] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(FORCED_OFFLINE_KEY) === "1";
  });
  const [justReconnected, setJustReconnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const online = networkOnline && !forcedOffline;

  useEffect(() => {
    const goOnline = () => {
      setNetworkOnline(true);
      if (!forcedOffline) {
        setJustReconnected(true);
        triggerSync();
        setTimeout(() => setJustReconnected(false), 2500);
      }
    };
    const goOffline = () => setNetworkOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [forcedOffline]);

  const toggleForcedOffline = () => {
    const next = !forcedOffline;
    setForcedOffline(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(FORCED_OFFLINE_KEY, next ? "1" : "0");
    }
    if (!next && networkOnline) {
      // Coming back online manually → sync
      setSyncing(true);
      triggerSync();
      setTimeout(() => setSyncing(false), 1800);
    }
  };

  const handleSyncNow = () => {
    setSyncing(true);
    triggerSync();
    setTimeout(() => setSyncing(false), 1800);
  };

  return (
    <>
      {/* Top banner: offline / syncing / reconnected */}
      {(!online || justReconnected) && (
        <div
          className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 px-3"
          style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          {!online && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur">
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
              <span>
                {forcedOffline
                  ? fr
                    ? "Mode hors-ligne activé"
                    : "Offline mode enabled"
                  : fr
                    ? "Hors-ligne — vos modifications seront synchronisées"
                    : "Offline — changes will sync"}
              </span>
            </div>
          )}
          {online && justReconnected && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>{fr ? "Synchronisation..." : "Syncing..."}</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
          )}
        </div>
      )}

      {/* Floating toggle button */}
      <div
        className="fixed z-50 flex flex-col items-end gap-2"
        style={{
          right: "calc(env(safe-area-inset-right) + 0.75rem)",
          bottom: "calc(env(safe-area-inset-bottom) + 5rem)",
        }}
      >
        {online && (
          <button
            type="button"
            onClick={handleSyncNow}
            title={fr ? "Synchroniser maintenant" : "Sync now"}
            className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 text-xs font-medium text-foreground shadow-md backdrop-blur transition hover:bg-accent"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-primary" : ""}`} />
            <span>{fr ? "Sync" : "Sync"}</span>
          </button>
        )}
        <button
          type="button"
          onClick={toggleForcedOffline}
          title={
            online
              ? fr
                ? "Passer hors-ligne"
                : "Go offline"
              : fr
                ? "Revenir en ligne"
                : "Go online"
          }
          className={`flex h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-medium shadow-md backdrop-blur transition ${
            online
              ? "border-border bg-card/95 text-foreground hover:bg-accent"
              : "border-destructive/40 bg-destructive text-destructive-foreground hover:opacity-90"
          }`}
        >
          {online ? <Wifi className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          <span>
            {online
              ? fr
                ? "En ligne"
                : "Online"
              : fr
                ? "Hors-ligne"
                : "Offline"}
          </span>
        </button>
      </div>
    </>
  );
}
