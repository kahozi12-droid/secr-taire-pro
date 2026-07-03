// Helpers to log cloud activity + sync history.
import { supabase } from "@/integrations/supabase/client";

export type CloudAction =
  | "upload"
  | "download"
  | "delete"
  | "restore"
  | "purge"
  | "rename"
  | "move"
  | "mkdir"
  | "sync";

export async function logCloudActivity(
  action: CloudAction,
  path?: string | null,
  targetPath?: string | null,
  bytes?: number | null,
) {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  await supabase.from("cloud_activity_log").insert({
    user_id: uid,
    action,
    path: path ?? null,
    target_path: targetPath ?? null,
    bytes: bytes ?? null,
  });
}

export async function logSync(
  direction: "to_cloud" | "to_local" | "both",
  scope: string,
  filesSynced: number,
  filesSkipped: number,
  errors: number,
  durationMs: number,
) {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  await supabase.from("cloud_sync_log").insert({
    user_id: uid,
    direction,
    scope,
    files_synced: filesSynced,
    files_skipped: filesSkipped,
    errors,
    duration_ms: durationMs,
  });
}
