import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, cpSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const root = fileURLToPath(new URL("../", import.meta.url));
const at = (...parts) => resolve(root, ...parts);
const say = (message) => console.log("[AstraKibis] " + message);
const stampPath = at("dist/.kibis-build");
const webPath = at("dist/web");
const previousWeb = at("dist/web.previous");

export function needsBuild({ current, built, hasIndex }) {
  return !hasIndex || !current || current !== built;
}
export function releaseFingerprint(commit, lock, manifest) {
  return createHash("sha256").update(JSON.stringify([commit, lock, manifest])).digest("hex");
}
function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: root, stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", encoding: "utf8", env: process.env });
  if (result.error || result.status !== 0) throw new Error(command + " 執行失敗（" + (result.error?.message ?? result.status) + "）");
  return capture ? result.stdout.trim() : "";
}
const git = (...args) => run("git", args, true);
function loadEnv() {
  for (const name of [".env.local", ".env"]) if (existsSync(at(name))) process.loadEnvFile(at(name));
  process.env.NODE_ENV = "production";
  process.env.HOST ||= "0.0.0.0";
  process.env.PORT ||= process.env.SERVER_PORT || "8788";
  process.env.DATABASE_PATH ||= "./data/radar.db";
}
function snapshot(commit) {
  const folder = at(".kibis-backups", new Date().toISOString().replace(/[:.]/g, "-") + "-" + commit.slice(0, 8));
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const dbPath = at(process.env.DATABASE_PATH);
  if (process.env.DATABASE_PATH === ":memory:") throw new Error("更新模式不支援記憶體資料庫");
  if (existsSync(dbPath)) {
    // SQLite online snapshot includes committed WAL changes; no raw copy of an open DB.
    const db = new DatabaseSync(dbPath);
    try { db.exec("VACUUM INTO '" + resolve(folder, "radar.db").replaceAll("'", "''") + "'"); }
    finally { db.close(); }
  }
  for (const name of [".env", ".env.local", "launcher.js"]) {
    if (existsSync(at(name))) cpSync(at(name), resolve(folder, name));
  }
  writeFileSync(resolve(folder, "manifest.json"), JSON.stringify({ commit, databasePath: dbPath, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  say("已建立更新前備份：" + folder);
  return folder;
}
function build(commit) {
  const lock = readFileSync(at("pnpm-lock.yaml"), "utf8");
  const manifest = readFileSync(at("package.json"), "utf8");
  const fingerprint = releaseFingerprint(commit, lock, manifest);
  const built = existsSync(stampPath) ? readFileSync(stampPath, "utf8").trim() : "";
  if (!needsBuild({ current: fingerprint, built, hasIndex: existsSync(at("dist/web/index.html")) })) {
    say("前端版本一致，略過重複建置");
    return;
  }
  say("原始碼已變更或缺少前端，開始重新建置");
  mkdirSync(at("dist"), { recursive: true });
  // Keep one prior build. Never serve it with a newer backend after a failed build.
  if (existsSync(previousWeb)) rmSync(previousWeb, { recursive: true, force: true });
  if (existsSync(webPath)) renameSync(webPath, previousWeb);
  try {
    run("npm", ["install", "--include=dev", "--no-audit", "--no-fund"]);
    run("npm", ["run", "build"]);
    if (!existsSync(at("dist/web/index.html"))) throw new Error("找不到建置後的 index.html");
    writeFileSync(stampPath, fingerprint + "\n");
  } catch (err) {
    if (existsSync(webPath)) rmSync(webPath, { recursive: true, force: true });
    if (existsSync(previousWeb)) renameSync(previousWeb, webPath);
    if (existsSync(stampPath)) rmSync(stampPath);
    throw err;
  }
}
export function parseAction(args) {
  if (args.length === 0) return { mode: "start" };
  if (args.length !== 1) throw new Error("每次只能指定一種部署操作");
  const arg = args[0];
  if (arg === "--update") return { mode: "update" };
  if (arg === "--backup") return { mode: "backup" };
  if (arg === "--return-main") return { mode: "return-main" };
  if (/^--rollback-code=\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{8}$/.test(arg)) return { mode: "rollback-code", backup: arg.slice("--rollback-code=".length) };
  throw new Error("不支援的部署操作；一般啟動請留空");
}
function cleanTracked() {
  if (git("status", "--porcelain", "--untracked-files=no")) throw new Error("有未提交的追蹤檔案，停止版本切換");
}
function rollbackCode(backup, current) {
  const manifest = JSON.parse(readFileSync(at(".kibis-backups", backup, "manifest.json"), "utf8"));
  const target = manifest.commit;
  if (typeof target !== "string" || !/^[a-f0-9]{40}$/.test(target) || !target.startsWith(backup.slice(-8))) throw new Error("備份版本資料不符");
  // A pre-launcher release must use the manual rollback procedure.
  run("git", ["cat-file", "-e", target + ":scripts/kibis-launcher.mjs"]);
  run("git", ["merge-base", "--is-ancestor", target, "main"]);
  cleanTracked();
  if (target !== current) {
    snapshot(current);
    run("git", ["switch", "--detach", target]);
  }
  say("已切回程式版本 " + target.slice(0, 8) + "，資料庫未還原");
  return git("rev-parse", "HEAD");
}
export async function main(args = process.argv.slice(2)) {
  loadEnv();
  const action = parseAction(args);
  if (!existsSync(at(".git"))) throw new Error("Nodaroo 啟動器需要 Git 原始碼部署");
  let commit = git("rev-parse", "HEAD");
  say("Node.js " + process.version + " / " + commit.slice(0, 8));
  if (action.mode === "backup") snapshot(commit);
  if (action.mode === "rollback-code") commit = rollbackCode(action.backup, commit);
  if (action.mode === "return-main") {
    cleanTracked();
    if (git("branch", "--show-current") !== "main") { snapshot(commit); run("git", ["switch", "main"]); }
    commit = git("rev-parse", "HEAD");
  }
  if (action.mode === "update") {
    if (git("branch", "--show-current") !== "main") throw new Error("更新僅允許 main 分支");
    if (git("remote", "get-url", "origin") !== "https://github.com/JingFeng-code/AstraKibis.git") throw new Error("origin 不符合 AstraKibis 正式來源");
    cleanTracked();
    run("git", ["fetch", "origin", "main"]);
    const target = git("rev-parse", "origin/main");
    if (target !== commit) {
      snapshot(commit);
      run("git", ["merge", "--ff-only", "origin/main"]);
      commit = git("rev-parse", "HEAD");
      if (commit !== target) throw new Error("版本不符，停止啟動");
    }
  }
  mkdirSync(dirname(at(process.env.DATABASE_PATH)), { recursive: true });
  build(commit);
  say("啟動 HTTP 服務，連接埠 " + process.env.PORT);
  const child = spawn(process.execPath, ["--no-warnings", "src/server/index.ts"], { cwd: root, stdio: "inherit", env: process.env });
  for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => child.kill(sig));
  child.on("error", error => { console.error("[AstraKibis] 啟動失敗：", error.message); process.exitCode = 1; });
  child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error("[AstraKibis] " + error.message); process.exitCode = 1; });
}
