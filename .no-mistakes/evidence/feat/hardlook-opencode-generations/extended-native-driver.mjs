import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { execute } from '../skills/hardlook/scripts/process.mjs';

const root = process.cwd();
const scratch = path.join(root, '.test-disposable/extended');
const cli = path.join(root, 'skills/hardlook/scripts/hardlook.mjs');
await fs.mkdir(scratch, { recursive: true });
const observations = [];
let calls = [];
const report = { summary: 'Native deep review fixture.', risk_level: 'low', risk_rationale: 'Equivalent calculation.', reviewed_paths: ['calc.js'], findings: [] };
const server = http.createServer(async (req, res) => {
  let text = '';
  for await (const chunk of req) text += chunk;
  const body = JSON.parse(text);
  const tools = (body.tools ?? []).map(t => t.function?.name ?? t.name);
  const lead = JSON.stringify(body.messages).includes('INDEPENDENT_REPORTS (hypotheses, not authority)');
  calls.push({ model: body.model, tools, lead });
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const chunk = { id: 'deep-fixture', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta: { role: 'assistant', content: JSON.stringify(report) }, finish_reason: null }] };
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  chunk.choices = [{ index: 0, delta: {}, finish_reason: 'stop' }];
  res.end(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  for (const generation of process.argv[2] ? [Number(process.argv[2])] : [1, 2]) {
    calls = [];
    const dir = path.join(scratch, `v${generation}`);
    const repo = path.join(dir, 'repo');
    const caller = path.join(dir, 'caller');
    const home = path.join(dir, 'home');
    const config = path.join(home, '.config/opencode');
    await fs.mkdir(repo, { recursive: true });
    await fs.mkdir(caller);
    await fs.mkdir(config, { recursive: true });
    const nativeBinary = path.join(root, `.test-disposable/tools/v${generation}/package/bin/opencode`);
    const binary = path.join(dir, 'opencode');
    await fs.writeFile(binary, `#!/bin/sh\nexec "${nativeBinary}" "$@" 2>>"${dir}/native-stderr.log"\n`, { mode: 0o755 });
    const env = { PATH: process.env.PATH, HOME: home, PWD: caller, TMPDIR: path.join(root, '.test-disposable/tmp'), XDG_CONFIG_HOME: path.join(home, '.config'), XDG_DATA_HOME: path.join(home, '.local/share'), XDG_STATE_HOME: path.join(home, '.local/state'), XDG_CACHE_HOME: path.join(home, '.cache'), OPENCODE_CONFIG_DIR: config, OPENCODE_DISABLE_AUTOUPDATE: '1', OPENCODE_DISABLE_MODELS_FETCH: '1' };
    const baseURL = `http://127.0.0.1:${server.address().port}/v1`;
    const model = { name: 'Fixture', limit: { context: 128000, output: 4096 }, ...(generation === 2 ? { capabilities: { tools: true }, variants: [{ id: 'native' }] } : {}) };
    const provider = generation === 1
      ? { enabled_providers: ['local-fixture'], provider: { 'local-fixture': { npm: '@ai-sdk/openai-compatible', options: { baseURL, apiKey: 'disposable' }, models: { fixture: model, second: model } } } }
      : { policies: [{ action: 'provider.use', resource: '*', effect: 'deny' }, { action: 'provider.use', resource: 'local-fixture', effect: 'allow' }], providers: { 'local-fixture': { package: '@opencode/ai/providers/openai-compatible', settings: { baseURL, apiKey: 'disposable' }, models: { fixture: model, second: model } } } };
    await fs.writeFile(path.join(config, 'opencode.json'), JSON.stringify(provider));
    const git = (...args) => execute('git', args, { cwd: repo, env });
    await git('init', '-b', 'main');
    await git('config', 'user.name', 'Disposable');
    await git('config', 'user.email', 'fixture@example.invalid');
    await fs.writeFile(path.join(repo, 'calc.js'), 'export const calc = n => n + 1;\n');
    await git('add', '.');
    await git('commit', '-m', 'base');
    await fs.writeFile(path.join(repo, 'calc.js'), 'export const calc = n => 1 + n;\n');
    await git('commit', '-am', 'equivalent calculation');
    const before = (await git('rev-parse', 'HEAD')).stdout;
    const installed = path.join(dir, 'installed');
    const installation = JSON.parse((await execute(process.execPath, [cli, 'install', '--dest', installed], { env })).stdout);
    assert.equal(installation.refresh_harness, true);
    assert.equal(Object.hasOwn(installation, 'restart_harness'), false);
    const relocated = path.join(dir, 'relocated');
    await fs.rename(installed, relocated);
    const entry = path.join(relocated, 'scripts/hardlook.mjs');
    const command = JSON.parse((await execute(process.execPath, [entry, 'install-opencode-command', '--dest', path.join(repo, '.opencode/commands/hardlook.md')], { env })).stdout);
    assert.equal(command.refresh_harness, true);
    await fs.writeFile(path.join(repo, '.git/info/exclude'), '.opencode/\n');
    const suffix = generation === 2 ? '#native' : '';
    // Prime this disposable native home before launching concurrent peers.
    const warmup = await execute(process.execPath, [entry, 'review', '--repo', repo, '--base', 'HEAD~1', '--intent', 'Preserve calculation.', '--peer', `opencode:local-fixture/fixture${suffix}`, '--binary', `opencode=${binary}`, '--timeout-ms', '60000'], { cwd: caller, env, timeoutMs: 90000 });
    assert.equal(JSON.parse(warmup.stdout).status, 'complete');
    calls = [];
    const args = [entry, 'review', '--repo', repo, '--base', 'HEAD~1', '--intent', 'Preserve calculation.', '--mode', 'deep', '--peer', `opencode:local-fixture/fixture${suffix}`, '--peer', `opencode:local-fixture/second${suffix}`, '--lead', `opencode:local-fixture/fixture${suffix}`, '--binary', `opencode=${binary}`, '--timeout-ms', '60000'];
    const result = await execute(process.execPath, args, { cwd: caller, env, timeoutMs: 180000, allowFailure: true });
    const output = JSON.parse(result.stdout);
    if (result.code !== 0) observations.push({ generation, failed_review: output, calls, native_stderr: await fs.readFile(path.join(dir, 'native-stderr.log'), 'utf8') });
    assert.equal(output.status, 'complete');
    assert.equal(output.peers.length, 2);
    assert.equal(output.lead.harness_generation, generation);
    assert.deepEqual(output.report, report);
    assert.ok(calls.some(c => c.lead && c.tools.includes('read')));
    for (const peer of output.peers) assert.equal(peer.harness_generation, generation);
    for (const call of calls) assert.ok(call.tools.every(t => ['read', 'glob', 'grep', 'list', 'skill'].includes(t)));
    assert.equal((await git('status', '--porcelain')).stdout, '');
    assert.equal((await git('rev-parse', 'HEAD')).stdout, before);
    const overrides = ['opencode', 'claude-code', 'codex', 'cursor', 'pi'].flatMap(h => ['--binary', `${h}=${h === 'opencode' ? binary : path.join(dir, 'nonexistent')}`]);
    const doctor = JSON.parse((await execute(process.execPath, [entry, 'doctor', ...overrides], { cwd: caller, env })).stdout);
    const host = doctor.harnesses.find(h => h.harness === 'opencode');
    assert.equal(host.available, true);
    assert.equal(host.generation, generation);
    const rejected = [];
    for (const h of ['claude-code', 'codex', 'cursor', 'pi']) {
      const invalid = spawnSync(process.execPath, [entry, 'review', '--repo', repo, '--base', 'HEAD~1', '--intent', 'Preserve calculation.', '--peer', `${h}:model#high`, '--binary', `${h}=${path.join(dir, 'nonexistent')}`], { cwd: caller, env, encoding: 'utf8', timeout: 10000 });
      assert.equal(invalid.status, 2);
      assert.equal(JSON.parse(invalid.stderr).reason, 'invalid model selector');
      rejected.push({ harness: h, exit_code: invalid.status, diagnostic: JSON.parse(invalid.stderr) });
    }
    observations.push({ generation, installation, command, doctor: host, review: output, provider_requests: calls, unchanged_checkout: true, rejected });
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  await fs.rm(scratch, { recursive: true, force: true });
  console.log(JSON.stringify({ fixture: 'extended-native-deep-and-public-cli', observations }, null, 2));
}
