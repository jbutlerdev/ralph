/**
 * Regression test for the simple-git 3.x -> 4.0.2 MAJOR migration.
 *
 * Covers the EXACT call surface ralph uses in production (src/executor.ts,
 * src/status.ts) so a future v4 minor/patch that changes any of these
 * surfaces fails loudly instead of silently breaking commits:
 *   - import('simple-git').simpleGit(cwd)
 *   - .status()      -> .isClean()
 *   - .add(paths[])  (incl. the ':file' deletion-prefix form)
 *   - .commit(msg)
 *   - .log({ maxCount })  -> .all[] and .latest.hash
 *
 * These are the same APIs the "guard-bypass / option-parsing RCE" advisories
 * (npm audit: simple-git <=4.0.0, critical) are fixed in 4.0.1+.
 *
 * Uses node:test (Node >=18 built-in) + a real temp git repo; no new deps.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { RalphExecutor } from '../executor.js';

async function makeRepo(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'ralph-sg-'));
  const run = (...a: string[]) =>
    execFileSync('git', a, { cwd: dir, stdio: 'ignore', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  run('init', '-b', 'main');
  run('config', 'user.email', 'test@example.com');
  run('config', 'user.name', 'test');
  // seed a first commit so HEAD exists (log/latest semantics need a tip)
  writeFileSync(join(dir, 'seed.txt'), 'seed\n');
  run('add', 'seed.txt');
  run('commit', '-m', 'seed');
  return dir;
}

test('v4 surface: status/add/commit/log round-trip matches ralph executor.ts flow', async () => {
  const dir = await makeRepo();
  try {
    const git = await import('simple-git');

    // executor.ts:417 — simpleGit(projectRoot)
    const gitInstance = git.simpleGit(dir);

    // executor.ts:420 — initial status()
    const initial = await gitInstance.status();
    assert.equal(typeof initial.isClean, 'function', 'v4 status().isClean is a function');
    assert.ok(initial.isClean(), 'fresh repo should be clean');

    // executor.ts:699 — add(filesToStage[]) where filesToStage mixes normal
    // paths (filesAdded/filesModified) and ':file' deletion-prefixed entries
    // (filesDeleted). Exercise BOTH forms.
    writeFileSync(join(dir, 'added.txt'), 'added by test\n');
    // make a file to "delete" via the :prefix form (must exist first)
    execFileSync('git', ['rm', '--cached', 'seed.txt'], { cwd: dir, stdio: 'ignore' });
    await gitInstance.add(['added.txt', ':seed.txt']);

    const midStatus = await gitInstance.status();
    assert.equal(typeof midStatus.isClean, 'function');
    assert.ok(!midStatus.isClean(), 'staged changes should make tree dirty');

    // executor.ts:708 — commit(message)
    await gitInstance.commit('[abcd-1] test commit');

    // executor.ts:723 / status.ts:136 — log({ maxCount }) -> .latest.hash, .all[]
    const log1 = await gitInstance.log({ maxCount: 1 });
    assert.ok(log1.latest, 'log({maxCount:1}) must have .latest');
    assert.match(log1.latest!.hash, /^[0-9a-f]{7,40}$/, '.latest.hash must be a commit hash');
    assert.equal(log1.latest!.message, '[abcd-1] test commit', 'commit message preserved');
    assert.equal(log1.all.length, 1, 'maxCount:1 caps .all to 1 entry');

    // status.ts:136 — log({ maxCount: 100 }) -> .all[] parsed for [xxxx-n] markers
    const logAll = await gitInstance.log({ maxCount: 100 });
    assert.ok(logAll.all.length >= 2, 'seed + test commit both present');
    const marker = /^\[([a-z]{4}-\d+)\]/;
    const matched = logAll.all.filter((c) => marker.test(c.message)).map((c) => c.message.match(marker)![1]);
    assert.deepEqual(matched, ['abcd-1'], 'task-marker extraction from commit messages works (status.ts logic)');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('v4 surface: empty-commit resolves with falsy .commit (v4 regression guard)', async () => {
  // v3 threw a "nothing to commit" Error here; v4 RESOLVES with an empty
  // .commit. ralph/executor.ts commitTask was migrated to detect the no-op
  // via `!commitResult.commit` (return early) so it NEVER records the stale
  // HEAD hash as the task commit. This test locks that contract.
  const dir = await makeRepo();
  try {
    const git = await import('simple-git');
    const gitInstance = git.simpleGit(dir);
    const headBefore = (await gitInstance.log({ maxCount: 1 })).latest!.hash;

    const res = await gitInstance.commit('should be a no-op — nothing staged');
    assert.ok(!res || !res.commit, 'v4 empty commit must resolve with falsy .commit (NOT a real hash)');

    // and HEAD must be unchanged — proving why the early-return guard matters
    const headAfter = (await gitInstance.log({ maxCount: 1 })).latest!.hash;
    assert.equal(headAfter, headBefore, 'HEAD unchanged after no-op commit');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


// ---- Real-path integration: drive the ACTUAL commitTask (not a re-assertion)
// to prove the v4 empty-commit migration guard protects ralph from recording a
// stale HEAD hash. Suppress the executor's console.warn noise during these.

function makeTask(id: string): any {
  return { id, title: 't', description: 'd', priority: 'high', dependencies: [],
           acceptanceCriteria: [], status: 'In Progress' };
}
function makeResult(filesAdded: string[] = [], filesModified: string[] = [], filesDeleted: string[] = []): any {
  return { filesChanged: filesAdded.length + filesModified.length + filesDeleted.length,
           filesAdded, filesModified, filesDeleted,
           acceptanceCriteriaPassed: [], acceptanceCriteriaFailed: [], output: '' };
}

test('real commitTask: v4 records the NEW commit hash (happy path)', async () => {
  const dir = await makeRepo();
  const warn = console.warn; console.warn = () => {};
  try {
    const executor = new RalphExecutor({ projectRoot: dir, autoCommit: true } as any);
    writeFileSync(join(dir, 'added.txt'), 'real content\n');
    const result = makeResult(['added.txt']);
    const headBefore = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).toString().trim();

    await (executor as any).commitTask(makeTask('abcd-1'), result);

    assert.ok(result.commitHash, 'commitHash must be set on a real commit');
    assert.match(result.commitHash, /^[0-9a-f]{7,40}$/, 'commitHash is a real hash');
    assert.notEqual(result.commitHash, headBefore, 'must be the NEW commit, not the stale HEAD');
    const headAfter = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).toString().trim();
    assert.ok(headAfter.startsWith(result.commitHash) || result.commitHash.startsWith(headAfter),
      'commitHash matches actual HEAD');
  } finally {
    console.warn = warn;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('real commitTask: v4 empty-commit guard leaves commitHash UNSET + HEAD unchanged', async () => {
  const dir = await makeRepo();
  // Pre-create a TRACKED, UNMODIFIED file and list it in filesAdded so the
  // add() is a no-op and git has "nothing to commit" -> exercises the v4 path
  // where commit() RESOLVES falsy instead of throwing (the regression case).
  writeFileSync(join(dir, 'added.txt'), 'preexisting\n');
  execFileSync('git', ['add', 'added.txt'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'track added'], { cwd: dir, stdio: 'ignore' });

  const warn = console.warn; const warned: string[] = [];
  console.warn = (m?: any) => { warned.push(String(m)); };
  try {
    const executor = new RalphExecutor({ projectRoot: dir, autoCommit: true } as any);
    const headBefore = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).toString().trim();
    const result = makeResult(['added.txt']); // unchanged, already tracked -> nothing to commit

    await (executor as any).commitTask(makeTask('abcd-1'), result);

    assert.equal(result.commitHash, undefined,
      'commitHash MUST stay unset on a no-op (v4 guard prevents stale-HEAD recording)');
    assert.ok(warned.some((w) => /No changes to commit/i.test(w)),
      'must take the "No changes to commit" warning branch');
    const headAfter = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).toString().trim();
    assert.equal(headAfter, headBefore, 'HEAD unchanged — no phantom commit');
  } finally {
    console.warn = warn;
    rmSync(dir, { recursive: true, force: true });
  }
});
