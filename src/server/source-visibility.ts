import { config } from "./config.ts";
import { TAIWAN_DEFERRED_SOURCE_IDS } from "../shared/taiwan-profile.ts";

/** Shared public discovery scope. Exclude disabled deferred built-in sources, not their historical rows. */
export function discoverySourceFilter(): { sql: string; params: string[] } {
  if (config.sourceProfile !== "taiwan") return { sql: "1=1", params: [] };
  const ids = [...TAIWAN_DEFERRED_SOURCE_IDS];
  return {
    sql: `source_id NOT IN (SELECT id FROM sources WHERE enabled = 0 AND id IN (${ids.map(() => "?").join(",")}))`,
    params: ids,
  };
}
