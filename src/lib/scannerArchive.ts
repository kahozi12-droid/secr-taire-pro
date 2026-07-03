// Shared taxonomy + helpers for the "Scanner archive" — a mirrored
// folder structure kept in the Cloud (Supabase Storage `documents` bucket)
// AND on the user's PC (File System Access API). The structure is:
//
//   {year}/
//     {NN-Mois}/
//       Courriers Entrants/
//         {sub_code}/   ← files chronologiquement
//       Courriers Sortants/
//         {sub_code}/
//
// Sub-categories come from `src/lib/classification.ts` (SAE/DG, SAE/INT…)
// The "/" in codes is replaced by "_" to be safe for filesystems and Storage keys.

import { CATEGORIES } from "@/lib/classification";
import { supabase } from "@/integrations/supabase/client";

export const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
] as const;

export const FOLDER_INCOMING = "Courriers Entrants";
export const FOLDER_OUTGOING = "Courriers Sortants";

export function sanitizeCode(code: string): string {
  return code.replace(/\//g, "_");
}

export function monthFolderName(monthIdx0: number): string {
  const n = String(monthIdx0 + 1).padStart(2, "0");
  return `${n}-${MONTHS_FR[monthIdx0]}`;
}

/** All sub-category folder names for INCOMING (SAE_DG, SAE_INT, ETA_MIN, ...). */
export function allSubFolders(): { code: string; label: string }[] {
  const out: { code: string; label: string }[] = [];
  for (const c of CATEGORIES) {
    for (const s of c.subs) {
      out.push({ code: sanitizeCode(s.code), label: s.labelFr });
    }
  }
  return out;
}

/** Sub-category folder names for OUTGOING — only two fixed folders. */
export const OUTGOING_SUBS: { code: string; label: string }[] = [
  { code: "Courriers_Administratifs", label: "Courriers Administratifs" },
  { code: "Courriers_Techniques", label: "Courriers Techniques" },
];

function subsForGroup(group: string): { code: string; label: string }[] {
  return group === FOLDER_OUTGOING ? OUTGOING_SUBS : allSubFolders();
}

/** Compute the full logical tree for a given year. */
export interface TreeNode {
  name: string;
  path: string;    // relative to archive root, no leading slash
  kind: "folder" | "file";
  children?: TreeNode[];
  size?: number;
}

export function buildLogicalYearTree(year: number): TreeNode {
  const months: TreeNode[] = [];
  for (let m = 0; m < 12; m++) {
    const mName = monthFolderName(m);
    const mPath = `${year}/${mName}`;
    const groups: TreeNode[] = [FOLDER_INCOMING, FOLDER_OUTGOING].map((g) => ({
      name: g,
      path: `${mPath}/${g}`,
      kind: "folder",
      children: subsForGroup(g).map((s) => ({
        name: s.code,
        path: `${mPath}/${g}/${s.code}`,
        kind: "folder",
        children: [],
      })),
    }));
    months.push({ name: mName, path: mPath, kind: "folder", children: groups });
  }
  return { name: String(year), path: `${year}`, kind: "folder", children: months };
}

// -----------------------------------------------------------------------------
// CLOUD (Supabase Storage — bucket "documents")
// -----------------------------------------------------------------------------
// RLS requires object paths to start with `{auth.uid()}/…`.
// We nest the archive under `{uid}/scanner-archive/{year}/…`.

export function cloudRoot(uid: string): string {
  return `${uid}/scanner-archive`;
}
export function cloudPath(uid: string, relative: string): string {
  return `${cloudRoot(uid)}/${relative}`.replace(/\/+$/, "");
}

/** List one folder level in cloud. Returns {folders, files}. */
export async function cloudList(uid: string, relative: string) {
  const prefix = relative ? cloudPath(uid, relative) : cloudRoot(uid);
  const { data, error } = await supabase.storage
    .from("documents")
    .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  const folders: { name: string; path: string }[] = [];
  const files: { name: string; path: string; size: number; updated_at?: string }[] = [];
  for (const it of data ?? []) {
    // Supabase returns a placeholder ".emptyFolderPlaceholder" for empty prefixes
    if (it.name === ".emptyFolderPlaceholder") continue;
    if (it.id === null) {
      folders.push({ name: it.name, path: relative ? `${relative}/${it.name}` : it.name });
    } else {
      files.push({
        name: it.name,
        path: relative ? `${relative}/${it.name}` : it.name,
        size: (it.metadata as { size?: number } | null)?.size ?? 0,
        updated_at: it.updated_at ?? undefined,
      });
    }
  }
  return { folders, files };
}

export async function cloudUpload(uid: string, relativePath: string, file: File) {
  const { error } = await supabase.storage
    .from("documents")
    .upload(cloudPath(uid, relativePath), file, { upsert: true, contentType: file.type });
  if (error) throw error;
}

export async function cloudSignedUrl(uid: string, relativePath: string, expiresIn = 300) {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(cloudPath(uid, relativePath), expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function cloudDelete(uid: string, relativePaths: string[]) {
  if (relativePaths.length === 0) return;
  const { error } = await supabase.storage
    .from("documents")
    .remove(relativePaths.map((p) => cloudPath(uid, p)));
  if (error) throw error;
}

/**
 * Create the year's full logical structure in the cloud by uploading a tiny
 * placeholder file to every leaf sub-folder. Storage has no notion of empty
 * folders, so this is the only way to make them exist for listing.
 */
export async function cloudInitYear(uid: string, year: number, onProgress?: (n: number, total: number) => void) {
  const groups = [FOLDER_INCOMING, FOLDER_OUTGOING];
  const total = 12 * groups.reduce((acc, g) => acc + subsForGroup(g).length, 0);
  let n = 0;
  const placeholder = new File([""], ".keep", { type: "text/plain" });
  for (let m = 0; m < 12; m++) {
    const mName = monthFolderName(m);
    for (const g of groups) {
      for (const s of subsForGroup(g)) {
        const rel = `${year}/${mName}/${g}/${s.code}/.keep`;
        try {
          await cloudUpload(uid, rel, placeholder);
        } catch {
          // ignore duplicates
        }
        n++;
        onProgress?.(n, total);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// LOCAL (File System Access API)
// -----------------------------------------------------------------------------

export function fsSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function pickLocalRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!fsSupported()) return null;
  try {
    // @ts-expect-error not yet in TS lib
    const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
      mode: "readwrite",
      id: "scanner-archive-root",
    });
    return handle;
  } catch {
    return null;
  }
}

export async function ensureDir(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let cur = root;
  for (const seg of segments) {
    cur = await cur.getDirectoryHandle(seg, { create: true });
  }
  return cur;
}

export async function localInitYear(
  root: FileSystemDirectoryHandle,
  year: number,
  onProgress?: (n: number, total: number) => void,
) {
  const groups = [FOLDER_INCOMING, FOLDER_OUTGOING];
  const total = 12 * groups.reduce((acc, g) => acc + subsForGroup(g).length, 0);
  let n = 0;
  const yearDir = await ensureDir(root, [String(year)]);
  for (let m = 0; m < 12; m++) {
    const monthDir = await ensureDir(yearDir, [monthFolderName(m)]);
    for (const g of groups) {
      const gDir = await ensureDir(monthDir, [g]);
      for (const s of subsForGroup(g)) {
        await ensureDir(gDir, [s.code]);
        n++;
        onProgress?.(n, total);
      }
    }
  }
}

/** List one local folder level. */
export async function localList(
  root: FileSystemDirectoryHandle,
  relative: string,
): Promise<{ folders: string[]; files: { name: string; size: number }[] }> {
  const segments = relative ? relative.split("/").filter(Boolean) : [];
  let cur: FileSystemDirectoryHandle = root;
  for (const seg of segments) {
    cur = await cur.getDirectoryHandle(seg, { create: false });
  }
  const folders: string[] = [];
  const files: { name: string; size: number }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const [name, handle] of (cur as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
    if (handle.kind === "directory") {
      folders.push(name);
    } else {
      const f = await (handle as FileSystemFileHandle).getFile();
      if (f.name === ".keep") continue;
      files.push({ name, size: f.size });
    }
  }
  folders.sort();
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { folders, files };
}

export async function localWriteFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  file: File | Blob,
) {
  const parts = relativePath.split("/").filter(Boolean);
  const fileName = parts.pop()!;
  const dir = await ensureDir(root, parts);
  const fh = await dir.getFileHandle(fileName, { create: true });
  const w = await fh.createWritable();
  await w.write(file);
  await w.close();
}

export async function localReadFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<File> {
  const parts = relativePath.split("/").filter(Boolean);
  const fileName = parts.pop()!;
  let cur: FileSystemDirectoryHandle = root;
  for (const p of parts) cur = await cur.getDirectoryHandle(p, { create: false });
  const fh = await cur.getFileHandle(fileName, { create: false });
  return await fh.getFile();
}

export async function localDelete(
  root: FileSystemDirectoryHandle,
  relativePath: string,
) {
  const parts = relativePath.split("/").filter(Boolean);
  const fileName = parts.pop()!;
  let cur: FileSystemDirectoryHandle = root;
  for (const p of parts) cur = await cur.getDirectoryHandle(p, { create: false });
  await cur.removeEntry(fileName);
}

// -----------------------------------------------------------------------------
// SYNC (manual, both directions)
// -----------------------------------------------------------------------------

export async function walkCloud(uid: string, relative: string): Promise<string[]> {
  const out: string[] = [];
  const { folders, files } = await cloudList(uid, relative);
  for (const f of files) if (f.name !== ".keep") out.push(f.path);
  for (const d of folders) {
    if (d.name === ".trash") continue;
    out.push(...(await walkCloud(uid, d.path)));
  }
  return out;
}

async function walkLocal(
  root: FileSystemDirectoryHandle,
  relative: string,
): Promise<string[]> {
  const out: string[] = [];
  const { folders, files } = await localList(root, relative);
  for (const f of files) out.push(relative ? `${relative}/${f.name}` : f.name);
  for (const d of folders) {
    const sub = relative ? `${relative}/${d}` : d;
    out.push(...(await walkLocal(root, sub)));
  }
  return out;
}

/** Upload every local file that doesn't exist in the cloud (year scoped). */
export async function syncLocalToCloud(
  uid: string,
  root: FileSystemDirectoryHandle,
  year: number,
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<{ uploaded: number; skipped: number }> {
  const localFiles = await walkLocal(root, String(year));
  const cloudFiles = new Set(await walkCloud(uid, String(year)));
  let uploaded = 0, skipped = 0;
  for (let i = 0; i < localFiles.length; i++) {
    const rel = localFiles[i];
    onProgress?.(i, localFiles.length, rel);
    if (cloudFiles.has(rel)) { skipped++; continue; }
    const file = await localReadFile(root, rel);
    await cloudUpload(uid, rel, file);
    uploaded++;
  }
  onProgress?.(localFiles.length, localFiles.length, "");
  return { uploaded, skipped };
}

/** Download every cloud file missing locally (year scoped). */
export async function syncCloudToLocal(
  uid: string,
  root: FileSystemDirectoryHandle,
  year: number,
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<{ downloaded: number; skipped: number }> {
  const cloudFiles = await walkCloud(uid, String(year));
  const localFiles = new Set(await walkLocal(root, String(year)));
  let downloaded = 0, skipped = 0;
  for (let i = 0; i < cloudFiles.length; i++) {
    const rel = cloudFiles[i];
    onProgress?.(i, cloudFiles.length, rel);
    if (localFiles.has(rel)) { skipped++; continue; }
    const { data, error } = await supabase.storage
      .from("documents")
      .download(cloudPath(uid, rel));
    if (error) throw error;
    await localWriteFile(root, rel, data);
    downloaded++;
  }
  onProgress?.(cloudFiles.length, cloudFiles.length, "");
  return { downloaded, skipped };
}

// -----------------------------------------------------------------------------
// Extended cloud helpers: rename, move, soft-delete (trash), restore, purge,
// download-as-blob, statistics.
// -----------------------------------------------------------------------------

const TRASH_PREFIX = ".trash";

export async function cloudDownload(uid: string, relativePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from("documents")
    .download(cloudPath(uid, relativePath));
  if (error) throw error;
  return data;
}

/** Copy then remove — Supabase Storage supports move natively. */
export async function cloudMove(uid: string, from: string, to: string): Promise<void> {
  const { error } = await supabase.storage
    .from("documents")
    .move(cloudPath(uid, from), cloudPath(uid, to));
  if (error) throw error;
}

export async function cloudRename(uid: string, relative: string, newName: string): Promise<string> {
  const parts = relative.split("/");
  parts[parts.length - 1] = newName;
  const to = parts.join("/");
  await cloudMove(uid, relative, to);
  return to;
}

/** Soft-delete: move the file to .trash/{timestamp}_{basename}. Returns new path. */
export async function cloudSoftDelete(uid: string, relative: string): Promise<string> {
  const ts = Date.now();
  const base = relative.split("/").pop()!;
  const to = `${TRASH_PREFIX}/${ts}_${base}`;
  await cloudMove(uid, relative, to);
  return to;
}

export async function cloudRestore(uid: string, trashedPath: string, originalPath: string): Promise<void> {
  await cloudMove(uid, trashedPath, originalPath);
}

export async function cloudPurge(uid: string, trashedPath: string): Promise<void> {
  await cloudDelete(uid, [trashedPath]);
}

export async function cloudMkdir(uid: string, relative: string): Promise<void> {
  const placeholder = new File([""], ".keep", { type: "text/plain" });
  await cloudUpload(uid, `${relative}/.keep`, placeholder);
}

export interface CloudFileEntry {
  path: string;
  name: string;
  size: number;
  updated_at?: string;
}

/** Recursively walk all files in the cloud archive (scoped to year or all). */
export async function cloudWalkAll(uid: string, rootRelative = ""): Promise<CloudFileEntry[]> {
  const out: CloudFileEntry[] = [];
  const stack: string[] = [rootRelative];
  while (stack.length) {
    const cur = stack.pop()!;
    const { folders, files } = await cloudList(uid, cur);
    for (const f of files) {
      if (f.name === ".keep") continue;
      out.push({ path: f.path, name: f.name, size: f.size, updated_at: f.updated_at });
    }
    for (const d of folders) {
      if (d.name === TRASH_PREFIX) continue;
      stack.push(d.path);
    }
  }
  return out;
}

export interface CloudStats {
  totalFiles: number;
  totalBytes: number;
  byGroup: Record<string, { files: number; bytes: number }>;
  bySub: Record<string, { files: number; bytes: number }>;
  byMonth: Record<string, { files: number; bytes: number }>;
}

export function computeStats(files: CloudFileEntry[]): CloudStats {
  const s: CloudStats = {
    totalFiles: files.length,
    totalBytes: 0,
    byGroup: {},
    bySub: {},
    byMonth: {},
  };
  for (const f of files) {
    s.totalBytes += f.size;
    // path shape: {year}/{NN-Month}/{group}/{sub}/{name}
    const parts = f.path.split("/");
    const month = parts[1] ?? "?";
    const group = parts[2] ?? "?";
    const sub = parts[3] ?? "?";
    s.byGroup[group] ??= { files: 0, bytes: 0 };
    s.byGroup[group].files++; s.byGroup[group].bytes += f.size;
    s.bySub[sub] ??= { files: 0, bytes: 0 };
    s.bySub[sub].files++; s.bySub[sub].bytes += f.size;
    s.byMonth[month] ??= { files: 0, bytes: 0 };
    s.byMonth[month].files++; s.byMonth[month].bytes += f.size;
  }
  return s;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} Ko`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} Mo`;
  return `${(mb / 1024).toFixed(2)} Go`;
}
