/**
 * Guarded service-worker registration.
 *
 * Strict rules (see PWA skill):
 * - Never register in dev / Lovable preview / iframe.
 * - Honors ?sw=off kill switch.
 * - Unregisters any matching stale registration when refused.
 */
export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const host = window.location.hostname;
  const inIframe = window.self !== window.top;

  const refused =
    !import.meta.env.PROD ||
    inIframe ||
    url.searchParams.get("sw") === "off" ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");

  if (refused) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs
          .filter((r) => r.active?.scriptURL.endsWith("/sw.js"))
          .map((r) => r.unregister()),
      );
    } catch {
      // ignore
    }
    return;
  }

  try {
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox("/sw.js");
    wb.addEventListener("waiting", () => {
      wb.messageSkipWaiting();
    });
    wb.addEventListener("controlling", () => {
      // New SW activated — reload once so users get the fresh build.
      window.location.reload();
    });
    await wb.register();
  } catch (err) {
    console.warn("[pwa] registration failed", err);
  }
}
