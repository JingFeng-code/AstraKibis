import assert from "node:assert/strict";
import { test } from "node:test";
import { toTaiwanUi } from "../src/web/src/lib/i18n/zh-tw.ts";
test("Taiwan UI terms and placeholders", () => {
  assert.equal(toTaiwanUi("资源雷达"), "AstraKibis");
  assert.equal(toTaiwanUi("保存设置"), "儲存設定");
  assert.equal(toTaiwanUi("数据源"), "資料來源");
  assert.equal(toTaiwanUi("切换界面语言：{lang}"), "切換介面語言：{lang}");
  assert.equal(toTaiwanUi("https://example.com/{id}"), "https://example.com/{id}");
});
