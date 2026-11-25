import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_FEED_STATE, readFeedState, buildFeedQuery } from "../src/web/src/lib/feedQuery.ts";
import { isTaiwanPreferred, TAIWAN_DEFERRED_SOURCE_IDS, TAIWAN_ENABLED_SOURCE_IDS } from "../src/shared/taiwan-profile.ts";

test("default feed works without AI; verified channel stays strict", () => {
  assert.equal(DEFAULT_FEED_STATE.preset, "all");
  assert.equal(readFeedState("").preset, "all");
  assert.equal(new URLSearchParams(buildFeedQuery(readFeedState(""))).has("aiOnly"), false);
  assert.equal(new URLSearchParams(buildFeedQuery(readFeedState("?preset=verified"))).get("aiOnly"), "1");
});
test("Taiwan profile prioritizes global and Taiwan sources", () => {
  assert.ok(isTaiwanPreferred("rss-freegroup"));
  assert.ok(isTaiwanPreferred("openrouter-free"));
  assert.ok(isTaiwanPreferred("rss-tw-news-ithome"));
  assert.ok(TAIWAN_DEFERRED_SOURCE_IDS.includes("cctv-news"));
  assert.ok(TAIWAN_DEFERRED_SOURCE_IDS.includes("nga-deals"));
  assert.ok(TAIWAN_DEFERRED_SOURCE_IDS.every(id => !isTaiwanPreferred(id)));
  assert.equal(new Set(TAIWAN_ENABLED_SOURCE_IDS).size, TAIWAN_ENABLED_SOURCE_IDS.length);
});

test("existing SQLite profile applies once, retains data, and filters deferred sources", async () => {
  Object.assign(process.env, {
    DATABASE_PATH: ":memory:", SITE_MODE: "selfhost", NODE_ENV: "test",
    ADMIN_TOKEN: "", AI_BASE_URL: "", AI_MODEL: "", PUSH_CHANNEL: "none",
    ENABLE_SCHEDULER: "false", KIBIS_SOURCE_PROFILE: "taiwan",
  });
  const db = await import("../src/server/db.ts");
  const { ensureSources, ingestItems } = await import("../src/server/collectors/index.ts");
  const { applyTaiwanProfile } = await import("../src/server/taiwan-profile.ts");
  const { registerApi } = await import("../src/server/routes.ts");
  const { Hono } = await import("hono");
  try {
    db.migrate();
    ensureSources();
    db.run("UPDATE sources SET enabled=1 WHERE id='cctv-news'");
    db.run("UPDATE sources SET enabled=0 WHERE id='rss-freegroup'");
    ingestItems("cctv-news", [{ externalId: "kibis-old", title: "Existing news article", url: "https://example.com/kibis-old" }]);
    db.run("UPDATE items SET status='active', ai_keep=1, kind='news', starred=1 WHERE external_id='kibis-old'");
    assert.equal(applyTaiwanProfile(), true);
    assert.equal(db.get<{ enabled: number }>("SELECT enabled FROM sources WHERE id='cctv-news'")?.enabled, 0);
    assert.equal(db.get<{ enabled: number }>("SELECT enabled FROM sources WHERE id='rss-freegroup'")?.enabled, 1);
    assert.equal(db.get<{ starred: number }>("SELECT starred FROM items WHERE external_id='kibis-old'")?.starred, 1);
    const app = new Hono();
    registerApi(app);
    const items = async (query: string) => {
      const res = await app.request("/api/items?" + query);
      assert.equal(res.status, 200);
      return (await res.json() as { items: { external_id: string }[] }).items;
    };
    assert.equal((await items("preset=all")).some(row => row.external_id === "kibis-old"), false);
    assert.equal((await items("preset=starred")).some(row => row.external_id === "kibis-old"), true);
    db.run("UPDATE sources SET enabled=1 WHERE id='cctv-news'");
    assert.equal(applyTaiwanProfile(), false);
    assert.equal(db.get<{ enabled: number }>("SELECT enabled FROM sources WHERE id='cctv-news'")?.enabled, 1);
  } finally {
    db.closeDb();
  }
});
