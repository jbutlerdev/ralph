/**
 * End-to-end regression test for the @modelcontextprotocol/sdk 0.6.1 -> 1.32.2
 * (0.x->1.x MAJOR) migration.
 *
 * Spawns the ACTUAL built MCP server (node dist/mcp/server.js) — the exact
 * contract the Ralph executor uses when it launches the task-complete tool —
 * and drives a full newline-delimited JSON-RPC conversation over stdio:
 *   initialize -> notifications/initialized -> tools/list -> tools/call
 * Then asserts:
 *   1. initialize succeeds (SDK handshake works on 1.x)
 *   2. tools/list advertises ralph_task_complete (setRequestHandler(ListTools…))
 *   3. tools/call returns the success text (setRequestHandler(CallTool…) wired)
 *   4. the session file was MUTATED (completedTasks gained the current task)
 *      -> proves the handler actually ran against real state, not just schema
 *
 * node:test, zero new deps, uses the built server (same as production).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

function makeSession() {
  const root = mkdtempSync(join(tmpdir(), 'ralph-mcp-'));
  const sessionId = 'test-session-1';
  const currentTaskId = 'task-007';
  const sessionsDir = join(root, '.ralph', 'sessions');
  mkdirSync(sessionsDir, { recursive: true });
  const session = {
    sessionId,
    planPath: join(root, 'IMPLEMENTATION_PLAN.md'),
    completedTasks: [],
    skippedTasks: [],
    failedTasks: [currentTaskId],
    currentTaskId,
    taskHistory: [{ taskId: currentTaskId, status: 'in_progress', startedAt: new Date().toISOString(), attempts: 1 }],
    startedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  };
  writeFileSync(join(sessionsDir, `${sessionId}.json`), JSON.stringify(session, null, 2));
  return { root, sessionId, currentTaskId, sessionPath: join(sessionsDir, `${sessionId}.json`) };
}

function driveServer(env, messages) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['dist/mcp/server.js'], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buf = '';
    const responses = [];
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('server timeout')); }, 15000);
    child.stdout.on('data', (d) => {
      buf += d.toString();
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (line) { try { responses.push(JSON.parse(line)); } catch { /* non-JSON noise */ } }
      }
    });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', () => { clearTimeout(timer); resolve(responses); });
    for (const m of messages) child.stdin.write(JSON.stringify(m) + '\n');
    child.stdin.end();
  });
}

test('MCP 1.x: built server completes initialize / tools-list / tools-call over stdio', async () => {
  const s = makeSession();
  try {
    const msgs = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ralph_task_complete', arguments: {} } },
    ];
    const responses = await driveServer(
      {
        RALPH_SESSION_ID: s.sessionId,
        RALPH_PROJECT_ROOT: s.root,
        RALPH_CURRENT_TASK_ID: s.currentTaskId,
        RALPH_PLAN_PATH: s.planPath,
      },
      msgs,
    );

    const init = responses.find((r) => r.id === 1);
    assert.ok(init && init.result, 'initialize must succeed (SDK 1.x handshake)');
    assert.ok(init.result.capabilities, 'initialize returns capabilities');

    const list = responses.find((r) => r.id === 2);
    assert.ok(list && Array.isArray(list.result?.tools), 'tools/list returns tools array');
    assert.ok(list.result.tools.some((t) => t.name === 'ralph_task_complete'),
      'ListToolsRequestSchema handler advertises ralph_task_complete');

    const call = responses.find((r) => r.id === 3);
    assert.ok(call && call.result, 'tools/call returns a result');
    assert.equal(call.result.isError, undefined, 'CallTool handler did not set isError');
    const text = call.result.content?.[0]?.text || '';
    assert.match(text, /"success":\s*true/, 'handler reports success on valid session');

    // The real contract: the session file was MUTATED by handleTaskComplete.
    const saved = JSON.parse(readFileSync(s.sessionPath, 'utf-8'));
    assert.ok(saved.completedTasks.includes(s.currentTaskId),
      'completedTasks gained the current task (handler ran against real state)');
    assert.ok(!saved.failedTasks.includes(s.currentTaskId), 'current task removed from failedTasks');
    assert.equal(saved.taskHistory.find((h) => h.taskId === s.currentTaskId).status, 'completed',
      'taskHistory entry marked completed');
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test('MCP 1.x: tools/call without session env -> isError handler path still returns structured error', async () => {
  const msgs = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ralph_task_complete', arguments: {} } },
  ];
  // No RALPH_SESSION_ID -> handleTaskComplete returns success:false; the
  // server wraps it in content (not an RPC error). Ensures the CallTool
  // handler's non-throw path is intact under 1.x.
  const responses = await driveServer({}, msgs);
  const call = responses.find((r) => r.id === 3);
  assert.ok(call && call.result, 'tools/call still returns result (no crash)');
  const text = call.result.content?.[0]?.text || '';
  assert.match(text, /"success":\s*false/, 'reports success:false when session env missing');
});
