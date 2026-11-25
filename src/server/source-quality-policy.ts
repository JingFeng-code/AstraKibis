import { config } from "./config.ts";
import { CATALOG_SOURCE_IDS } from "../shared/resource-quality.ts";

/** Static directories have no reliable publication timestamp; keep them discoverable, but not in Taiwan trend counts. */
export function temporalSourceFilter(): { sql: string; params: string[] } {
  if (config.sourceProfile !== "taiwan") return { sql: "1=1", params: [] };
  return { sql: `source_id NOT IN (${CATALOG_SOURCE_IDS.map(() => "?").join(",")})`, params: [...CATALOG_SOURCE_IDS] };
}
