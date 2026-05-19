import { useEffect, useState } from "react";

// Per-device folder connection status, persisted in localStorage.
// The File System Access handle itself isn't persisted; this is a UX
// indicator showing whether a folder has been linked on this device.
export type PrinterRoleKey = "main" | "director";

const KEY = (k: PrinterRoleKey) => `printer-folder:${k}`;
const EVT = "printer-folder-change";

export function getFolderStatus(k: PrinterRoleKey): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY(k));
}

export function setFolderStatus(k: PrinterRoleKey, name: string | null) {
  if (typeof window === "undefined") return;
  if (name) window.localStorage.setItem(KEY(k), name);
  else window.localStorage.removeItem(KEY(k));
  window.dispatchEvent(new Event(EVT));
}

export function usePrinterFolderStatus() {
  const [state, setState] = useState<{ main: string | null; director: string | null }>(() => ({
    main: getFolderStatus("main"),
    director: getFolderStatus("director"),
  }));
  useEffect(() => {
    const update = () =>
      setState({ main: getFolderStatus("main"), director: getFolderStatus("director") });
    window.addEventListener(EVT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return state;
}
