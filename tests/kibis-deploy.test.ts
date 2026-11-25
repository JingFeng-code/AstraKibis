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
