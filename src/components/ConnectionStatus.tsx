import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Floating connection status indicator.
 * - Shows "Hors-ligne" badge when navigator goes offline.
 * - Shows a brief "Synchronisation..." then "Synchronisé" toast when coming back online.
 */
export function ConnectionStatus() {
  const { lang } = useI18n();
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setJustReconnected(true);
      // Notify the SW (if any) to replay queued requests.
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "SYNC_NOW" });
      }
      setTimeout(() => setJustReconnected(false), 2500);
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online && !justReconnected) return null;

  const fr = lang === "fr";

  return (
    <div
      className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 px-3"
      style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      {!online && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur">
          <WifiOff className="h-3.5 w-3.5 text-destructive" />
          <span>{fr ? "Hors-ligne — vos modifications seront synchronisées" : "Offline — changes will sync"}</span>
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
  );
}
