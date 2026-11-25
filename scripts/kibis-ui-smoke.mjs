import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

const temp = await mkdtemp(join(tmpdir(), "kibis-browser-"));
const socket = createServer();
await new Promise((resolve, reject) => { socket.once("error", reject); socket.listen(0, "127.0.0.1", resolve); });
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const url = "http://127.0.0.1:" + port;
const child = spawn(process.execPath, ["--no-warnings", "src/server/index.ts"], { env: {
  ...process.env, NODE_ENV:"production", HOST:"127.0.0.1", PORT:String(port),
  DATABASE_PATH:join(temp,"radar.db"), ENABLE_SCHEDULER:"false", SITE_MODE:"selfhost",
  KIBIS_SOURCE_PROFILE:"taiwan", ADMIN_TOKEN:"", AI_BASE_URL:"", AI_MODEL:"", AI_API_KEY:"", PUSH_CHANNEL:"none"
}, stdio: ["ignore","pipe","pipe"] });
let logs = "";
child.stdout.on("data", chunk => { logs += chunk; });
child.stderr.on("data", chunk => { logs += chunk; });
let browser;
try {
  let healthy = false;
  for (let i=0; i<100; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(url + "/health")).ok) { healthy=true; break; } } catch {}
    await new Promise(r => setTimeout(r,100));
  }
  assert.ok(healthy, "local server must start: " + logs);
  const fixture = new DatabaseSync(join(temp,"radar.db"));
  const now = new Date().toISOString();
  fixture.prepare("INSERT INTO items (source_id,external_id,url,url_key,title,title_key,category,kind,score,status,is_free,obtain,first_seen_at,last_seen_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,'active',1,'free',?,?,?)").run("rss-freegroup","ui-quality","https://example.com/kibis-ui-quality","example/kibis-ui-quality","長期免費 VPS，台灣可申請，需綁卡，超額可能收費","kibis-ui-quality","vps","freebie",80,now,now,now);
  fixture.close();
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:900},colorScheme:"light"});
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(url + "/?lang=zh-TW");
  await page.locator(".kibis-intro h2").waitFor({state:"visible"});
  assert.equal(await page.locator("html").getAttribute("lang"),"zh-TW");
  assert.equal(await page.locator(".kibis-wordmark").innerText(),"AstraKibis");
  assert.equal(await page.locator(".kibis-intro h2").innerText(),"今天發現什麼？");
  assert.equal(await page.locator("html").getAttribute("data-theme"),"light");
  assert.ok(await page.locator(".kibis-mark").evaluate(img => img.complete && img.naturalWidth > 0));
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(desktopOverflow <= 2, "desktop overflow: " + desktopOverflow);
  const sources = await page.evaluate(async () => (await fetch("/api/sources")).json());
  assert.ok(Array.isArray(sources.sources));
  assert.equal(sources.sources.find(s => s.id==="cctv-news")?.enabled,false);
  assert.equal(sources.sources.find(s => s.id==="rss-tw-news-ithome")?.enabled,true);
  await page.getByRole("button", {name:"高階篩選",exact:true}).click();
  await page.getByLabel("免費類型",{exact:true}).selectOption("long_term");
  await page.getByLabel("地區線索",{exact:true}).selectOption("taiwan_mentioned");
  await page.getByLabel("收費風險",{exact:true}).selectOption("possible_charge");
  await page.getByRole("button",{name:"長期免費 VPS，台灣可申請，需綁卡，超額可能收費",exact:true}).click();
  await page.getByText("資源資格與費用線索",{exact:true}).waitFor({state:"visible"});
  await page.getByText("已查證日期：尚未查證",{exact:true}).waitFor({state:"visible"});
  assert.ok(new URL(page.url()).searchParams.get("billingRisk")==="possible_charge");
  await page.goto(url+"/?lang=en");
  await page.locator(".kibis-intro h2").waitFor({state:"visible"});
  assert.equal(await page.locator("html").getAttribute("lang"),"en");
  assert.equal(await page.locator(".kibis-intro h2").innerText(),"What will you discover today?");
  await page.emulateMedia({colorScheme:"dark"});
  await page.setViewportSize({width:390,height:844});
  await page.goto(url+"/?lang=zh-TW");
  await page.locator(".kibis-intro h2").waitFor({state:"visible"});
  assert.equal(await page.locator("html").getAttribute("data-theme"),"dark");
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(mobileOverflow <= 2, "mobile overflow: " + mobileOverflow);
  assert.deepEqual(errors,[]);
  console.log("[kibis-ui] PASS desktop 1440, mobile 390, zh-TW/en, dark/light, logo, source profile, quality filters and unverified evidence detail");
} catch(error) {
  console.error(logs);
  throw error;
} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) {
    const done=once(child,"exit");
    child.kill("SIGTERM");
    await done;
  }
  await rm(temp,{recursive:true,force:true});
}
