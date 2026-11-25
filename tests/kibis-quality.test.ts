import assert from "node:assert/strict";
import { test } from "node:test";
import { assessResource } from "../src/shared/resource-quality.ts";
import { readFeedState, writeFeedSearch, buildFeedQuery } from "../src/web/src/lib/feedQuery.ts";
test("quality hints stay conservative and distinguish free type and charge risk", () => {
  const r = assessResource("長期免費 VPS，台灣可申請，需綁卡，超額可能收費", null, "freebie");
  assert.deepEqual([r.freeType,r.region,r.card,r.billing,r.verifiedAt],["long_term","taiwan_mentioned","required","possible_charge",null]);
  assert.equal(assessResource("free trial then charged; always free?",null).freeType,"unknown");
  assert.equal(assessResource("免費試用 30 天，永久免費",null).freeType,"trial");
  assert.equal(assessResource("每月免費額度",null).freeType,"recurring");
  assert.equal(assessResource("新戶贈送額度",null).freeType,"one_time");
  assert.equal(assessResource("US residents only; available in Taiwan",null).region,"restricted_elsewhere");
  assert.equal(assessResource("not available in Taiwan",null).region,"restricted_elsewhere");
  assert.equal(assessResource("No credit card required; no overage charges",null).card,"not_required_claim");
  assert.equal(assessResource("No credit card required; no overage charges",null).billing,"no_charge_claim");
  assert.equal(assessResource("free shipping",null).freeType,"unknown");
  assert.equal(assessResource("A free tier was discontinued",null).freeType,"unknown");
  assert.equal(assessResource("Taiwan tech news",null,"news").region,"unknown");
  assert.equal(assessResource("no text evidence",null).evidenceStatus,"unknown");
});
test("quality filters survive URL state and reject unrecognized parameters", () => {
  const state=readFeedState("?freeType=recurring&billingRisk=possible_charge&regionHint=taiwan_mentioned&cardRequirement=required&resourceNature=update");
  const q=new URLSearchParams(buildFeedQuery(state));
  for (const key of ["freeType","billingRisk","regionHint","cardRequirement","resourceNature"] as const) assert.equal(q.get(key),state[key]);
  assert.deepEqual(readFeedState(writeFeedSearch("?lang=en",state)),state);
  assert.equal(readFeedState("?billingRisk=zero_guaranteed").billingRisk,"all");
});

import { toTaiwanUi } from "../src/web/src/lib/i18n/zh-tw.ts";
test("resource UI labels use user-facing Taiwan terminology, not programming jargon", () => {
  for (const label of ["免費類型","資訊類型","免費類型未確認","地區線索","收費風險","資源資格與費用線索","已查證日期：尚未查證"]) assert.equal(toTaiwanUi(label),label);
});
