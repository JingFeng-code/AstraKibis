import { get, run, tx } from "./db.ts";
import { TAIWAN_ENABLED_SOURCE_IDS, TAIWAN_DEFERRED_SOURCE_IDS } from "../shared/taiwan-profile.ts";
const MARKER = "kibis.sourceProfile.taiwan.v1";
/** Apply once. Keep history, user-created sources and all other settings. */
export function applyTaiwanProfile(): boolean {
  return tx(() => {
    if (get("SELECT key FROM settings WHERE key = ?", MARKER)) return false;
    for (const id of TAIWAN_DEFERRED_SOURCE_IDS) run("UPDATE sources SET enabled = 0 WHERE id = ?", id);
    for (const id of TAIWAN_ENABLED_SOURCE_IDS) run("UPDATE sources SET enabled = 1 WHERE id = ?", id);
    run("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)", MARKER, "true", new Date().toISOString());
    return true;
  });
}
