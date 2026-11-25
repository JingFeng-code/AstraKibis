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
  assert.ok(isTaiwanPreferred("rss-tw-news-briian"));
  assert.ok(isTaiwanPreferred("rss-global-news-github-changelog"));
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
    assert.equal(db.get<{ enabled: number }>("SELECT enabled FROM sources WHERE id='rss-tw-news-briian'")?.enabled, 1);
    assert.equal(db.get<{ enabled: number }>("SELECT enabled FROM sources WHERE id='rss-global-news-github-changelog'")?.enabled, 1);
    db.run("INSERT INTO sources (id,name,kind,enabled,config,interval_sec,created_at) VALUES (?,?,?,?,?,?,?)", "kibis-custom-test", "Custom feed", "rss", 1, "{}", 3600, new Date().toISOString());
    db.run("UPDATE sources SET enabled=1 WHERE id='cctv-news'");
    db.run("UPDATE sources SET enabled=0 WHERE id='rss-freegroup'");
    ingestItems("cctv-news", [{ externalId: "kibis-old", title: "Existing news article", url: "https://example.com/kibis-old" }]);
    db.run("UPDATE items SET status='active', ai_keep=1, kind='news', starred=1 WHERE external_id='kibis-old'");
    assert.equal(applyTaiwanProfile(), true);
    assert.equal(db.get<{ enabled: number }>("SELECT enabled FROM sources WHERE id='kibis-custom-test'")?.enabled, 1);
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
    assert.equal((await items("preset=all&source=cctv-news")).some(row => row.external_id === "kibis-old"), true);
    // The same scope must apply before aggregation, ranking, and digest selection.
    const { pickDaily, pickWeekly } = await import("../src/server/digest.ts");
    const now = new Date().toISOString();
    const earlier = new Date(Date.now() - 30 * 3600000).toISOString();
    const add = (source: string, id: string, title: string, date: string, kind: string, score: number) => {
      ingestItems(source, [{ externalId: id, title, url: "https://example.com/" + id }]);
      db.run("UPDATE items SET status='active', ai_keep=1, kind=?, score=?, ai_quality=5, published_at=?, expires_at=NULL, obtain='free', is_free=1, ai=? WHERE external_id=?", kind, score, date, '{"keep":true}', id);
    };
    add("bili-freebies", "kibis-deferred-deal", "ChinaFixture 免費遊戲領取", now, "freebie", 99);
    add("rss-freebieshark", "kibis-deferred-prev", "ChinaFixture 美國免費試用品", earlier, "freebie", 99);
    add("rss-tw-news-ithome", "kibis-taiwan-news", "TaiwanFixture 官方科技公告", now, "news", 80);
    add("rss-freegroup", "kibis-taiwan-deal", "TaiwanFixture 免費軟體授權", now, "freebie", 90);
    add("kibis-custom-test", "kibis-custom-deal", "CustomFixture 免費開發工具", now, "freebie", 85);
    const hot = async () => {
      const response = await app.request("/api/hot?hours=24");
      assert.equal(response.status, 200);
      return await response.json() as { scanned: number; prevScanned: number; rawScanned: number; words: { w: string }[]; top: { source_id: string; title: string }[]; topNews: { source_id: string; title: string }[] };
    };
    add("rss-freegroup", "kibis-region-excluded", "US residents only free trial", now, "freebie", 100);
    add("github-free-for-dev", "kibis-catalog", "CatalogFixture long term list", now, "info", 100);
    db.run("UPDATE items SET title='長期免費 VPS，台灣可申請，需綁卡，超額可能收費' WHERE external_id='kibis-taiwan-deal'");
    const quality = await app.request("/api/items?preset=all&freeType=long_term&regionHint=taiwan_mentioned&billingRisk=possible_charge&cardRequirement=required");
    assert.equal(quality.status,200);
    const qualified = await quality.json() as {items: {external_id:string;resourceQuality:{verifiedAt:null}}[]};
    assert.equal(qualified.items.length,1);
    assert.equal(qualified.items[0]?.external_id,"kibis-taiwan-deal");
    assert.equal(qualified.items[0]?.resourceQuality.verifiedAt,null);
    assert.ok((await items("preset=all&resourceNature=catalog")).some(row=>row.external_id==="kibis-catalog"));
    assert.ok(!(await items("preset=all&resourceNature=update")).some(row=>row.external_id==="kibis-catalog"));
    const report = await hot();
    assert.equal(report.scanned, 4);
    assert.equal(report.rawScanned, 4);
    assert.equal(report.prevScanned, 0);
    assert.ok(!report.words.some(w => w.w === "catalogfixture"));
    assert.ok(!report.words.some(w => w.w === "chinafixture"));
    assert.ok(report.top.some(i => i.source_id === "rss-freegroup"));
    assert.ok(report.top.every(i => !i.title.includes("US residents only")));
    assert.ok(report.top.some(i => i.source_id === "kibis-custom-test"));
    assert.ok(report.topNews.some(i => i.source_id === "rss-tw-news-ithome"));
    assert.ok([...report.top, ...report.topNews].every(i => !["cctv-news", "bili-freebies", "rss-freebieshark"].includes(i.source_id)));
    for (const chosen of [pickDaily(), pickWeekly()]) {
      assert.ok(chosen.some(i => i.source_id === "rss-freegroup"));
      assert.ok(chosen.every(i => !i.title.includes("US residents only")));
      assert.ok(chosen.every(i => !["cctv-news", "bili-freebies", "rss-freebieshark", "github-free-for-dev"].includes(i.source_id)));
    }
    // The underlying historical item and its bookmark must remain accessible.
    assert.ok(db.get("SELECT id FROM items WHERE external_id='kibis-deferred-deal'"));
    db.run("UPDATE items SET status='ignored' WHERE external_id='kibis-old'");
    assert.equal((await items("preset=hidden")).some(row => row.external_id === "kibis-old"), true);
    db.run("UPDATE items SET status='active' WHERE external_id='kibis-old'");
    db.run("UPDATE sources SET enabled=1 WHERE id='cctv-news'");
    assert.equal(applyTaiwanProfile(), false);
    assert.equal(db.get<{ enabled: number }>("SELECT enabled FROM sources WHERE id='cctv-news'")?.enabled, 1);
    assert.ok((await hot()).topNews.some(i => i.source_id === "cctv-news"));
  } finally {
    db.closeDb();
  }
});
