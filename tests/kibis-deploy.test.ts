import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error Native ESM deployment script is JavaScript, not included in the TypeScript project.
import { needsBuild, releaseFingerprint, parseAction } from "../scripts/kibis-launcher.mjs";
test("deployment rebuilds on commit or manifest change and skips unchanged output", () => {
  const a = releaseFingerprint("commit-a", "lock", "manifest");
  const b = releaseFingerprint("commit-b", "lock", "manifest");
  assert.notEqual(a, b);
  assert.notEqual(a, releaseFingerprint("commit-a", "new-lock", "manifest"));
  assert.notEqual(a, releaseFingerprint("commit-a", "lock", "new-manifest"));
  assert.equal(needsBuild({ current: a, built: a, hasIndex: true }), false);
  assert.equal(needsBuild({ current: b, built: a, hasIndex: true }), true);
  assert.equal(needsBuild({ current: a, built: a, hasIndex: false }), true);
});

test("deployment actions reject path traversal, unknown flags and multiple operations", () => {
  assert.deepEqual(parseAction([]), { mode: "start" });
  assert.deepEqual(parseAction(["--update"]), { mode: "update" });
  assert.deepEqual(parseAction(["--return-main"]), { mode: "return-main" });
  assert.deepEqual(parseAction(["--rollback-code=2026-11-25T18-32-28-001Z-abcdef12"]), { mode: "rollback-code", backup: "2026-11-25T18-32-28-001Z-abcdef12" });
  assert.throws(() => parseAction(["--rollback-code=../../data"]));
  assert.throws(() => parseAction(["--update", "--backup"]));
  assert.throws(() => parseAction(["--restore-data"]));
});

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

test("isolated Git and SQLite backup, code rollback, return-main and rebuild", { timeout: 60000 }, () => {
  const root = mkdtempSync(join(tmpdir(), "kibis-deploy-"));
  const dbFile = join(root, "data", "radar.db");
  const env = { ...process.env, DATABASE_PATH: dbFile, PORT: "8788", HOST: "127.0.0.1", npm_config_offline: "true", npm_config_update_notifier: "false", npm_config_package_lock: "false" };
  const exec = (command: string, args: string[]) => {
    const result = spawnSync(command, args, { cwd: root, env, encoding: "utf8", timeout: 20000 });
    assert.equal(result.status, 0, result.error?.message ?? result.stdout + "\n" + result.stderr);
    return result.stdout.trim();
  };
  const git = (...args: string[]) => exec("git", args);
  const start = (...args: string[]) => exec(process.execPath, ["--no-warnings", "scripts/kibis-launcher.mjs", ...args]);
  try {
    for (const dir of ["scripts", "src/server", "data"]) mkdirSync(join(root, dir), { recursive: true });
    cpSync(new URL("../scripts/kibis-launcher.mjs", import.meta.url), join(root, "scripts", "kibis-launcher.mjs"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "kibis-test-fixture", version: "1.0.0", type: "module", scripts: { build: "node build.mjs" } }));
    writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    writeFileSync(join(root, "build.mjs"), "import {mkdirSync,writeFileSync} from 'node:fs'; mkdirSync('dist/web',{recursive:true}); writeFileSync('dist/web/index.html','test');");
    writeFileSync(join(root, "src/server/index.ts"), "console.log('fixture server');");
    writeFileSync(join(root, ".gitignore"), "data/\ndist/\n.kibis-backups/\nnode_modules/\npackage-lock.json\n");
    writeFileSync(join(root, "README.md"), "release A");
    git("init", "-b", "main"); git("config", "user.email", "fixture@example.invalid"); git("config", "user.name", "Fixture"); git("add", "."); git("commit", "-m", "A");
    const a = git("rev-parse", "HEAD");
    let db = new DatabaseSync(dbFile);
    db.exec("PRAGMA journal_mode=WAL; CREATE TABLE records (value TEXT); INSERT INTO records VALUES ('original');");
    db.close();
    start("--backup");
    const snapshot = readdirSync(join(root, ".kibis-backups")).find(name => name.endsWith(a.slice(0, 8)));
    assert.ok(snapshot);
    const saved = new DatabaseSync(join(root, ".kibis-backups", snapshot, "radar.db"), { readOnly: true });
    assert.equal(saved.prepare("SELECT value FROM records").get()?.value, "original");
    saved.close();
    writeFileSync(join(root, "README.md"), "release B"); git("add", "README.md"); git("commit", "-m", "B");
    const b = git("rev-parse", "HEAD");
    db = new DatabaseSync(dbFile); db.exec("INSERT INTO records VALUES ('new');"); db.close();
    start("--rollback-code=" + snapshot);
    assert.equal(git("rev-parse", "HEAD"), a);
    assert.equal(readFileSync(join(root, "README.md"), "utf8"), "release A");
    assert.ok(start().includes("略過重複建置"));
    start("--return-main");
    assert.equal(git("rev-parse", "HEAD"), b);
    assert.equal(git("branch", "--show-current"), "main");
    db = new DatabaseSync(dbFile);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM records").get()?.n, 2);
    db.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
