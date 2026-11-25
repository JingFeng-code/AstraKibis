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
