import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { Server as HttpServer } from "node:http";
import { logger } from "hono/logger";
import { compress } from "hono/compress";
import { config } from "./config.ts";
import { getDb, migrate, run } from "./db.ts";
import { registerApi, warmClusterCache } from "./routes.ts";
import { startPushScheduler } from "./push.ts";
import { startPromptSync } from "./enrich/prompt-sync.ts";
import { digestExists, runDaily } from "./digest.ts";
import { startIntervalScheduler, startScheduler } from "./cron.ts";
import { getRetention, runCleanup } from "./retention.ts";
import { ensureSources } from "./collectors/index.ts";
import { releaseFlareSession } from "./flaresolverr.ts";
import { pushUserDaily, startUserPushScheduler } from "./user-push.ts";
import { purgeExpiredSessions } from "./auth.ts";
import { getBuildInfo } from "./updater.ts";
import { registerSecurity } from "./security.ts";
import { reconcileFixedSourceCategories } from "./source-settings.ts";

import { applyTaiwanProfile } from "./taiwan-profile.ts";

migrate();
ensureSources();
if (config.sourceProfile === "taiwan" && applyTaiwanProfile()) console.log("[kibis] 已套用台灣資料來源設定（保留歷史資料與收藏）");
const rerouted = reconcileFixedSourceCategories();
if (rerouted) console.log(`[sources] 固定分類已重新整理 ${rerouted} 筆歷史資源（未觸發 AI 或推播）`);
// 上次进程意外退出可能遗留 status='running' 的记录，启动时收口
run(
  "UPDATE runs SET status = 'failed', finished_at = ?, error = COALESCE(error, '程序重新啟動而中斷') WHERE status = 'running'",
  new Date().toISOString(),
);
const cleanupLabels: Record<string, string> = {
  "过期非福利条目": "過期非免費資源",
  "过期福利条目": "過期免費資源",
  "手动关闭的条目": "手動隱藏項目",
  "推送日志": "推播日誌",
  "每日精选": "每日精選",
};
const app = new Hono();
registerSecurity(app);
// JSON 接口动辄几十 KB，先压缩再发；/api/items?limit=100 从 75KB 降到 ~15KB
app.use("*", compress());
app.use("*", logger((message, ...rest) => console.log(
  message.replace(/\/rss\/u\/[^?\s\u001b]+/g, "/rss/u/[redacted]").replace(/([?&](?:code|state|invite)=)[^&\s\u001b]+/g, "$1[redacted]"),
  ...rest,
)));

app.get("/health", async (c) => {
  const row = getDb().prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
  // 一键更新后前端轮询 /health 等 commit 变化来判断「新版本真的起来了」
  const build = await getBuildInfo().catch(() => null);
  return c.json({
    ok: row?.ok === 1,
    version: build?.version ?? "0.1.0",
    commit: build?.commitShort ?? null,
    runtimeMode: build?.runtimeMode ?? null,
    time: new Date().toISOString(),
    sources: config.enabledSources.length || "all",
  });
});

registerApi(app);

// Hono 的 serveStatic 的 root/path 都相对 process.cwd()，传绝对路径会拼出错误路径；
// 另外带 hash 的 assets 应该长缓存，index.html 必须 no-store，否则发版后用户会拿到旧 HTML 白屏。
const webDistAbs = fileURLToPath(new URL("../../dist/web", import.meta.url));
if (existsSync(webDistAbs)) {
  const relRoot = relative(process.cwd(), webDistAbs).split(sep).join("/") || ".";
  app.use(
    "/assets/*",
    serveStatic({
      root: relRoot,
      onFound: (_path, c) => {
        c.header("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );
  app.use(
    "/*",
    serveStatic({
      root: relRoot,
      // 命中 index.html 的响应必须不缓存，否则发版后浏览器会拿旧 HTML 去请求已删除的旧 JS
      onFound: (p, c) => {
        if (p.endsWith(".html")) c.header("Cache-Control", "no-store, must-revalidate");
      },
    }),
  );
  app.get(
    "*",
    serveStatic({
      path: relRoot + "/index.html",
      onFound: (_path, c) => {
        c.header("Cache-Control", "no-store, must-revalidate");
      },
    }),
  );
} else {
  app.get("/", (c) => c.text("AstraKibis API 已啟動。尚未建置前端，請執行 pnpm build 或 pnpm dev:web。"));
}

if (config.enableScheduler) {
  // 采集：每个源按自己的 interval_sec 轮询（linux.do 90 秒，RSS 15 分钟，GitHub 6 小时）
  startIntervalScheduler();
  // 聚类缓存预热：公开列表要命中 40+ 个 (kind,category) 组合，冷启动单次要 4-5 秒。
  // 延迟 5 秒等采集启动完，再在后台分批建索引，让第一个用户请求就命中缓存。
  setTimeout(() => { void warmClusterCache(); }, 2_000);
  // 推送：攒批队列按 batchIntervalMin 定时合并发送（静默时段自动跳过）
  startPushScheduler();
  // 云端提示词：配了 PROMPT_URL / PROMPT_EXTRA_URL 才启动
  startPromptSync();
  // 个人 Bot 攒批：各用户按自己的周期出队，与全局攒批互不干扰
  startUserPushScheduler();
  // 日报：仍然按 DAILY_CRON 触发
  startScheduler({
    collect: async () => undefined,
    daily: async () => {
      const now = new Date();
      const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (digestExists(day)) return;
      await runDaily({ date: now });
      // 每日精选落库后，给开了「个人日报」的用户各发一份
      await pushUserDaily().catch((err) => {
        console.error("[user-push] 個人日報失敗：", err instanceof Error ? err.message : err);
      });
    },
  });

  // 数据清理：每天跑一次，按保留策略删掉过期条目与日志（收藏的永不删）
  const tickCleanup = () => {
    try {
      const cfg = getRetention();
      if (!cfg.auto) return;
      const r = runCleanup(cfg);
      const total = Object.values(r.deleted).reduce((a, b) => a + b, 0);
      if (total > 0) console.log("[cleanup]", JSON.stringify(Object.fromEntries(Object.entries(r.deleted).map(([key, count]) => [cleanupLabels[key] ?? key, count]))), "剩餘", r.remaining);
    } catch (err) {
      console.error("[cleanup] 失敗：", err instanceof Error ? err.message : err);
    }
  };
  tickCleanup();
  // 过期的登录 Session 顺手清掉，避免 sessions 表无限增长
  try {
    const n = purgeExpiredSessions();
    if (n > 0) console.log("[auth] 清理過期工作階段", n, "筆");
  } catch {
    /* ignore */
  }
  setInterval(tickCleanup, 12 * 3600_000);
}

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`[AstraKibis] HTTP 服務已啟動：http://${config.host}:${info.port}`);
});
if (server instanceof HttpServer) {
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    server.close();
    Promise.race([releaseFlareSession(), new Promise((r) => setTimeout(r, 800))]).finally(() => {
      process.exit(0);
    });
  });
}
