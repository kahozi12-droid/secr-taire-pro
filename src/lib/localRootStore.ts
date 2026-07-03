// Shared singleton holding the local scanner-archive root directory handle,
// so that any part of the app (DocumentRowCard, Dashboard sync…) can access
// it after the user has picked it once in the Scanner folder dialog.

import { useEffect, useState } from "react";
import { pickLocalRoot } from "@/lib/scannerArchive";

let handle: FileSystemDirectoryHandle | null = null;
let name: string | null = null;
const listeners = new Set<() => void>();

export function setLocalRoot(h: FileSystemDirectoryHandle | null, n: string | null) {
  handle = h;
  name = n;
  listeners.forEach((l) => l());
}

export function getLocalRoot(): FileSystemDirectoryHandle | null {
  return handle;
}

export function getLocalRootName(): string | null {
  return name;
}

/** If no root is set yet, prompts the user to pick one, then stores it. */
export async function ensureLocalRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (handle) return handle;
  const h = await pickLocalRoot();
  if (h) setLocalRoot(h, h.name);
  return handle;
}

export function useLocalRoot() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { handle, name };
}
