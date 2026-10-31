import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { execute } from '../../skills/hardlook/scripts/process.mjs';
import { packet } from '../../skills/hardlook/scripts/context.mjs';
import { review } from '../../skills/hardlook/scripts/review.mjs';
import { decodeReport, pipelineReport, validateReport } from '../../skills/hardlook/scripts/report.mjs';
import { validateStrictSchema } from './strict-schema.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = fileURLToPath(new URL('./', import.meta.url));
const skillVersion = JSON.parse(await fs.readFile(path.join(root, 'skills/hardlook/manifest.json'), 'utf8')).version;
const cli = path.join(root, 'skills/hardlook/scripts/hardlook.mjs');
const hosts = ['opencode', 'claude-code', 'codex', 'cursor', 'pi'];

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hardlook-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  // Extensionless native-CLI fixtures must not rely on newer Node syntax detection.
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}\n');
  const repo = path.join(dir, 'repo');
  await fs.mkdir(repo);
  const git = async (...args) => execute('git', args, { cwd: repo });
  await git('init', '-b', 'main');
  await git('config', 'user.email', 'fixture@example.invalid');
  await git('config', 'user.name', 'Fixture');
  await fs.writeFile(path.join(repo, 'calc.js'), 'export const calc = n => n + 1;\n');
  await fs.writeFile(path.join(repo, 'AGENTS.md'), 'Review this fixture; never change it.\n');
  await git('add', '.');
  await git('commit', '-m', 'base');
  await git('checkout', '-b', 'change');
  await fs.writeFile(path.join(repo, 'calc.js'), 'export const calc = n => n + 2;\n');
  await git('add', '.');
  await git('commit', '-m', 'change');
  const binaries = {};
  await fs.copyFile(path.join(fixtures, 'strict-schema.mjs'), path.join(dir, 'strict-schema.mjs'));
  await fs.copyFile(path.join(fixtures, 'opencode-contract.mjs'), path.join(dir, 'opencode-contract.mjs'));
  for (const host of hosts) {
    const bin = path.join(dir, host);
    await fs.copyFile(path.join(fixtures, 'fixture-harness.mjs'), bin);
    await fs.chmod(bin, 0o755);
    binaries[host] = bin;
  }
  return {
    dir,
    repo,
    git,
    binaries,
    options: {
      repo,
      scope: 'branch',
      base: 'main',
      intent: 'Change calculation.',
      binaryOverrides: binaries,
      timeoutMs: 3000,
    },
  };
}

test('packet pins merge base and HEAD and covers tracked changes', async (t) => {
  const f = await fixture(t);
  const p = await packet(f.options);
  assert.deepEqual(p.changed_paths, ['calc.js']);
  assert.equal(p.files[0].content, 'export const calc = n => n + 2;\n');
  assert.equal(p.instructions[0].path, 'AGENTS.md');
  assert.equal(p.head, (await f.git('rev-parse', 'HEAD')).stdout.trim());
  assert.notEqual(p.head, p.base);
  assert.equal(p.identity, (await packet(f.options)).identity);
});

test('staged and working scopes read different authoritative contents', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.repo, 'calc.js'), 'staged content\n');
  await f.git('add', 'calc.js');
  await fs.writeFile(path.join(f.repo, 'calc.js'), 'working content\n');
  assert.equal((await packet({ ...f.options, scope: 'staged' })).files[0].content, 'staged content\n');
  assert.equal((await packet({ ...f.options, scope: 'uncommitted' })).files[0].content, 'working content\n');
  await assert.rejects(packet(f.options), /clean tracked worktree/);
});

test('private changed contents are excluded and explicit private includes are refused', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.repo, '.env.secret'), 'PRIVATE_FIXTURE_VALUE');
  await f.git('add', '.env.secret');
  await f.git('commit', '-m', 'private fixture');
  const p = await packet(f.options);
  assert.deepEqual(p.excluded_paths, ['.env.secret']);
  assert.ok(!JSON.stringify(p).includes('PRIVATE_FIXTURE_VALUE'));
  await assert.rejects(packet({ ...f.options, include: ['.env.secret'] }), /private path/);
  const result = await review({ ...f.options, peers: ['opencode:valid'] });
  assert.equal(result.status, 'partial');
  assert.throws(() => pipelineReport(result), /incomplete/);
});

test('context rejects excessive packets, traversal, and escaped symlink parents', async (t) => {
  const f = await fixture(t);
  await assert.rejects(packet({ ...f.options, maxBytes: 10 }));
  await assert.rejects(packet({ ...f.options, include: ['../outside'] }), /relative path/);
  await fs.writeFile(path.join(f.dir, 'outside'), 'outside evidence');
  await fs.symlink(f.dir, path.join(f.repo, 'link'));
  await assert.rejects(packet({ ...f.options, scope: 'uncommitted', include: ['link/outside'] }), /escaped repository/);
});

test('literal wildcard filenames cannot expand a filtered diff into private contents', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.repo, '*'), 'ordinary public source\n');
  await fs.writeFile(path.join(f.repo, '.env.secret'), 'PRIVATE_PATHSPEC_FIXTURE\n');
  await f.git('add', '.');
  const p = await packet({ ...f.options, scope: 'staged' });
  assert.ok(p.changed_paths.includes('*'));
  assert.ok(!p.diff.includes('PRIVATE_PATHSPEC_FIXTURE'));
  assert.ok(!JSON.stringify(p.files).includes('PRIVATE_PATHSPEC_FIXTURE'));
});

test('known credential stores are excluded from capture and explicit includes', async (t) => {
  const f = await fixture(t);
  const stores = ['.netrc', '.git-credentials', '.claude/.credentials.json', '.aws/sso/cache/session.json'];
  for (const file of stores) {
    await fs.mkdir(path.dirname(path.join(f.repo, file)), { recursive: true });
    await fs.writeFile(path.join(f.repo, file), 'PRIVATE_CREDENTIAL_FIXTURE');
  }
  await f.git('add', '.');
  const p = await packet({ ...f.options, scope: 'staged' });
  assert.ok(!JSON.stringify(p).includes('PRIVATE_CREDENTIAL_FIXTURE'));
  assert.deepEqual(new Set(p.excluded_paths), new Set(stores));
  for (const file of stores)
    await assert.rejects(packet({ ...f.options, scope: 'staged', include: [file] }), /private path/);
});

test('public-file to private-directory transitions fail before diff capture', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.repo, 'config'), 'public config\n');
  await f.git('add', '.');
  await f.git('commit', '-m', 'public file');
  await f.git('branch', 'boundary-base');
  await fs.rm(path.join(f.repo, 'config'));
  await fs.mkdir(path.join(f.repo, 'config'));
  await fs.writeFile(path.join(f.repo, 'config/.env.secret'), 'PRIVATE_DIRECTORY_TRANSITION');
  await f.git('add', '.');
  await assert.rejects(packet({ ...f.options, scope: 'staged' }), /excluded descendant/);
  await f.git('commit', '-m', 'file to directory');
  await assert.rejects(packet({ ...f.options, base: 'boundary-base' }), /excluded descendant/);
});

test('stage-prefixed literal filenames cannot select a private index blob', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.repo, '.env.secret'), 'PRIVATE_INDEX_FIXTURE');
  await f.git('add', '.');
  await f.git('commit', '-m', 'indexed private fixture');
  await fs.writeFile(path.join(f.repo, '0:.env.secret'), 'public literal content\n');
  await f.git('add', '.');
  const staged = await packet({ ...f.options, scope: 'staged' });
  assert.equal(staged.files[0].content, 'public literal content\n');
  assert.ok(!JSON.stringify(staged).includes('PRIVATE_INDEX_FIXTURE'));
  await f.git('commit', '-m', 'public literal filename');
  await fs.appendFile(path.join(f.repo, 'calc.js'), '// supporting change\n');
  await f.git('add', '.');
  const included = await packet({ ...f.options, scope: 'staged', include: ['0:.env.secret'] });
  assert.equal(included.files.find((file) => file.path === '0:.env.secret').content, 'public literal content\n');
  assert.ok(!JSON.stringify(included).includes('PRIVATE_INDEX_FIXTURE'));
});

test('unresolved index entries cannot produce a complete staged or pipeline verdict', async (t) => {
  const f = await fixture(t);
  await f.git('checkout', '-b', 'other', 'main');
  await fs.writeFile(path.join(f.repo, 'calc.js'), 'export const calc = n => n + 3;\n');
  await f.git('add', '.');
  await f.git('commit', '-m', 'other change');
  await f.git('checkout', 'change');
  const merged = await execute('git', ['merge', '--no-edit', 'other'], { cwd: f.repo, allowFailure: true });
  assert.equal(merged.code, 1);
  await assert.rejects(packet({ ...f.options, scope: 'staged' }), /unresolved index/);
  const blocked = await execute(
    process.execPath,
    [
      cli,
      'review',
      '--repo',
      f.repo,
      '--scope',
      'staged',
      '--intent',
      'Review the calculation.',
      '--peer',
      'opencode:valid',
      '--binary',
      `opencode=${f.binaries.opencode}`,
      '--format',
      'no-mistakes',
    ],
    { allowFailure: true },
  );
  assert.equal(blocked.code, 2);
  assert.equal(blocked.stdout, '');
  await fs.writeFile(path.join(f.repo, 'calc.js'), 'export const calc = n => n + 4;\n');
  await f.git('add', '.');
  const resolved = await review({ ...f.options, scope: 'staged', peers: ['opencode:valid'] });
  assert.equal(resolved.status, 'complete');
});

test('only confirmed deletions become null source; missing explicit context is an error', async (t) => {
  const f = await fixture(t);
  await fs.rm(path.join(f.repo, 'calc.js'));
  await f.git('add', '.');
  const deleted = await packet({ ...f.options, scope: 'staged' });
  assert.equal(deleted.files[0].content, null);
  await assert.rejects(packet({ ...f.options, scope: 'staged', include: ['missing.js'] }), /context file unavailable/);
});

for (const host of hosts)
  test(`${host}: execute native-shaped CLI protocol and normalize a complete report`, async (t) => {
    const f = await fixture(t);
    const result = await review({ ...f.options, peers: [`${host}:valid`] });
    assert.equal(result.status, 'complete');
    assert.deepEqual(result.report.reviewed_paths, ['calc.js']);
    assert.equal(result.peers[0].harness, host);
  });

test('deep mode runs independent sessions on identical packets followed by lead synthesis', async (t) => {
  const f = await fixture(t);
  const traces = path.join(f.dir, 'trace');
  await fs.mkdir(traces);
  const result = await execute(
    process.execPath,
    [
      cli,
      'review',
      '--repo',
      f.repo,
      '--base',
      'main',
      '--intent',
      'Change calculation.',
      '--mode',
      'deep',
      '--peer',
      'opencode:valid',
      '--peer',
      'codex:valid',
      '--binary',
      `opencode=${f.binaries.opencode}`,
      '--binary',
      `codex=${f.binaries.codex}`,
    ],
    {
      env: { ...process.env, HARDLOOK_TEST_TRACE: traces },
      timeoutMs: 10_000,
    },
  );
  assert.equal(JSON.parse(result.stdout).status, 'complete');
  const calls = await Promise.all(
    (await fs.readdir(traces)).map(async (file) => JSON.parse(await fs.readFile(path.join(traces, file), 'utf8'))),
  );
  assert.equal(calls.length, 3);
  assert.equal(calls.filter((call) => call.lead).length, 1);
  assert.equal(new Set(calls.map((call) => call.context)).size, 1);
  assert.equal(new Set(calls.map((call) => call.pid)).size, 3);
});

for (const [version, generation] of [
  ['1.19.5', 1],
  ['opencode v2.2.5', 2],
])
  test(`latest OpenCode V${generation} uses its own launch and permission contract`, async (t) => {
    const f = await fixture(t);
    await fs.writeFile(path.join(f.dir, 'opencode-version.txt'), version);
    const result = await review({ ...f.options, mode: 'deep', peers: ['opencode:repro-reported', 'codex:valid'] });
    assert.equal(result.status, 'complete');
    assert.equal(result.peers[0].harness_version, generation === 1 ? '1.19.5' : '2.2.5');
    assert.equal(result.peers[0].harness_generation, generation);
    assert.equal(result.lead.harness_generation, generation);
    assert.equal(result.report.findings[0].reproduction.status, 'reported-unverified');
    const doctor = await execute(process.execPath, [
      cli,
      'doctor',
      ...Object.entries(f.binaries).flatMap(([host, binary]) => ['--binary', `${host}=${binary}`]),
    ]);
    const entry = JSON.parse(doctor.stdout).harnesses.find((item) => item.harness === 'opencode');
    assert.equal(entry.generation, generation);
    assert.equal(entry.available, true);
  });

for (const version of ['1.19.5', '2.2.5'])
  test(`OpenCode ${version} deep peers avoid shared-state contention`, async (t) => {
    const f = await fixture(t);
    await fs.writeFile(path.join(f.dir, 'opencode-version.txt'), version);
    // Native startup's exclusive state access must not prevent independent deep sessions.
    // An overlapping launch fails at the executable boundary instead of returning a report.
    const result = await review({
      ...f.options,
      mode: 'deep',
      peers: ['opencode:shared-state-one', 'opencode:shared-state-two'],
      lead: 'opencode:shared-state-lead',
    });
    assert.equal(result.status, 'complete');
    assert.deepEqual(result.peers.map((peer) => peer.status), ['ok', 'ok']);
    assert.equal(result.lead.requested_model, 'shared-state-lead');
    assert.deepEqual(result.report.reviewed_paths, ['calc.js']);
    assert.equal((await f.git('status', '--porcelain')).stdout, '');
  });

test('OpenCode V2 variant selectors reach the CLI unchanged', async (t) => {
  const f = await fixture(t);
  const result = await review({ ...f.options, peers: ['opencode:valid#high'] });
  assert.equal(result.status, 'complete');
  assert.equal(result.report.summary, 'Variant selector arrived unchanged.');
  assert.equal(result.peers[0].requested_model, 'valid#high');
});

for (const version of ['1.19.5', '2.2.5'])
  test(`OpenCode ${version} peers and leads read the reviewed repo across directories`, async (t) => {
    const f = await fixture(t);
    const caller = await fixture(t);
    const traces = path.join(f.dir, 'trace');
    await fs.mkdir(traces);
    await fs.writeFile(path.join(f.dir, 'opencode-version.txt'), version);
    await fs.writeFile(path.join(f.repo, 'supporting.txt'), 'Reviewed repository evidence.');
    await fs.writeFile(path.join(caller.repo, 'supporting.txt'), 'Wrong caller repository evidence.');
    const result = await execute(
      process.execPath,
      [
        cli,
        'review',
        '--repo',
        f.repo,
        '--base',
        'main',
        '--intent',
        'Change calculation.',
        '--mode',
        'deep',
        '--peer',
        'opencode:supporting-read',
        '--peer',
        'codex:valid',
        '--binary',
        `opencode=${f.binaries.opencode}`,
        '--binary',
        `codex=${f.binaries.codex}`,
      ],
      { cwd: caller.repo, env: { ...process.env, PWD: caller.repo, HARDLOOK_TEST_TRACE: traces } },
    );
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'complete');
    assert.equal(output.peers[0].report.summary, 'Reviewed repository evidence.');
    assert.equal(output.report.summary, 'Reviewed repository evidence.');
    const calls = await Promise.all(
      (await fs.readdir(traces)).map(async (file) => JSON.parse(await fs.readFile(path.join(traces, file), 'utf8'))),
    );
    const opencodeCalls = calls.filter((call) => call.harness === 'opencode');
    assert.equal(opencodeCalls.length, 2);
    assert.equal(opencodeCalls.filter((call) => call.lead).length, 1);
    const reviewedRepo = await fs.realpath(f.repo);
    for (const call of opencodeCalls) {
      assert.equal(call.cwd, reviewedRepo);
      assert.equal(call.pwd, reviewedRepo);
    }
  });

for (const host of hosts.filter((host) => host !== 'opencode'))
  test(`${host} rejects OpenCode-only variant syntax before invocation`, async (t) => {
    const f = await fixture(t);
    const options = { ...f.options, binaryOverrides: { [host]: path.join(f.dir, 'missing-harness') } };
    await assert.rejects(review({ ...options, peers: [`${host}:valid#high`] }), /invalid model selector/);
    await assert.rejects(
      review({ ...options, mode: 'deep', peers: ['opencode:valid', 'codex:valid'], lead: `${host}:valid#high` }),
      /invalid model selector/,
    );
  });

for (const version of ['3.0.0', 'not-a-version', '2.2.5-beta.1'])
  test(`OpenCode version ${version} fails closed without a model invocation`, async (t) => {
    const f = await fixture(t);
    await fs.writeFile(path.join(f.dir, 'opencode-version.txt'), version);
    const result = await review({ ...f.options, peers: ['opencode:valid'] });
    assert.equal(result.status, 'incomplete');
    assert.equal(result.peers[0].reason, 'unsupported-cli-version');
    await assert.rejects(fs.access(path.join(f.dir, 'opencode-invocations')));
    assert.throws(() => pipelineReport(result));
  });

for (const version of ['1.19.5', '2.2.5'])
  test(`relocated bundle supports latest OpenCode ${version}`, async (t) => {
    const f = await fixture(t);
    await fs.writeFile(path.join(f.dir, 'opencode-version.txt'), version);
    const installed = path.join(f.dir, 'installed/hardlook');
    await execute(process.execPath, [cli, 'install', '--dest', installed]);
    const relocated = path.join(f.dir, 'relocated-hardlook');
    await fs.rename(installed, relocated);
    const result = await execute(process.execPath, [
      path.join(relocated, 'scripts/hardlook.mjs'),
      'review',
      '--repo',
      f.repo,
      '--base',
      'main',
      '--intent',
      'Review calculation.',
      '--peer',
      'opencode:valid',
      '--binary',
      `opencode=${f.binaries.opencode}`,
    ]);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'complete');
    assert.equal(output.peers[0].harness_version, version);
  });

test('failed peer, partial coverage, invalid JSON, mutation, and duplicates cannot approve a panel', async (t) => {
  const f = await fixture(t);
  const failed = await review({ ...f.options, mode: 'deep', peers: ['opencode:valid', 'codex:exit'] });
  assert.equal(failed.status, 'incomplete');
  assert.ok(!JSON.stringify(failed).includes('credential-looking-private-error'));
  assert.equal(failed.peers[0].status, 'ok');
  for (const model of ['partial', 'invalid', 'timeout']) {
    const result = await review({ ...f.options, timeoutMs: 250, peers: [`opencode:${model}`] });
    assert.notEqual(result.status, 'complete');
    assert.throws(() => pipelineReport(result));
  }
  await assert.rejects(review({ ...f.options, mode: 'deep', peers: ['opencode:valid', 'opencode:valid'] }));
  const mutated = await review({ ...f.options, peers: ['opencode:mutate'] });
  assert.equal(mutated.status, 'incomplete');
  assert.ok(mutated.limitations.includes('reviewed-context-changed'));
});

test('pipeline format preserves evidence, action, severity, risk scope, and coverage', async (t) => {
  const f = await fixture(t);
  const result = await review({ ...f.options, peers: ['claude-code:finding'] });
  const converted = pipelineReport(result);
  assert.equal(converted.findings[0].severity, 'error');
  assert.equal(converted.findings[0].action, 'auto-fix');
  assert.equal(converted.findings[0].review_scope, 'source');
  assert.equal(converted.risk_scope, 'source-or-external');
  assert.deepEqual(converted.reviewed_paths, ['calc.js']);
  assert.match(converted.findings[0].description, /Input 0 produces an incorrect result/);
  result.report.findings[0].line = null;
  assert.equal(Object.hasOwn(pipelineReport(result).findings[0], 'line'), false);
});

for (const host of hosts)
  test(`${host}: reported reproduction stays explicitly unverified in report and pipeline output`, async (t) => {
    const f = await fixture(t);
    const result = await review({ ...f.options, peers: [`${host}:repro-reported`] });
    assert.equal(result.status, 'complete');
    assert.deepEqual(result.report.findings[0].reproduction, {
      status: 'reported-unverified',
      command: 'node calc.js',
      expected: '1\n',
      observed: '2\n',
    });
    const finding = pipelineReport(result).findings[0];
    assert.match(finding.description, /reported-unverified/);
    assert.match(finding.description, /not independently verified/);
    assert.ok(finding.description.includes('node calc.js'));
    assert.ok(finding.description.includes(JSON.stringify('1\n')));
    assert.ok(finding.description.includes(JSON.stringify('2\n')));
    assert.equal(finding.action, 'auto-fix');
  });

for (const status of ['not-run', 'reported-unverified'])
  test(`CLI preserves ${status} commands as data without executing them`, async (t) => {
    const f = await fixture(t);
    const marker = path.join(f.dir, 'must-not-execute');
    const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed')`)}`;
    const result = await execute(
      process.execPath,
      [
        cli,
        'review',
        '--repo',
        f.repo,
        '--base',
        'main',
        '--intent',
        'Review the calculation.',
        '--peer',
        status === 'not-run' ? 'opencode:repro-not-run' : 'opencode:repro-reported',
        '--binary',
        `opencode=${f.binaries.opencode}`,
      ],
      { env: { ...process.env, HARDLOOK_TEST_REPRO_COMMAND: command }, allowFailure: true },
    );
    assert.equal(result.code, 1);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'complete');
    assert.deepEqual(output.report.findings[0].reproduction, {
      status,
      command,
      expected: '1\n',
      observed: status === 'not-run' ? null : '2\n',
    });
    await assert.rejects(fs.access(marker));
    assert.equal((await f.git('status', '--porcelain')).stdout, '');
    const converted = pipelineReport(output);
    assert.ok(converted.findings[0].description.includes(status));
    assert.ok(
      converted.findings[0].description.includes(status === 'not-run' ? 'Observed: not run' : 'Observed: "2\\n"'),
    );
    const pipeline = await execute(
      process.execPath,
      [
        cli,
        'review',
        '--repo',
        f.repo,
        '--base',
        'main',
        '--intent',
        'Review the calculation.',
        '--peer',
        status === 'not-run' ? 'opencode:repro-not-run' : 'opencode:repro-reported',
        '--binary',
        `opencode=${f.binaries.opencode}`,
        '--format',
        'no-mistakes',
      ],
      { env: { ...process.env, HARDLOOK_TEST_REPRO_COMMAND: command }, allowFailure: true },
    );
    assert.equal(pipeline.code, 1);
    assert.deepEqual(JSON.parse(pipeline.stdout), converted);
    await assert.rejects(fs.access(marker));
  });

test('source-only findings remain actionable without a claimed reproduction', async (t) => {
  const f = await fixture(t);
  const result = await review({ ...f.options, peers: ['opencode:finding'] });
  assert.equal(result.status, 'complete');
  assert.equal(result.report.findings.length, 1);
  assert.equal(Object.hasOwn(result.report.findings[0], 'reproduction'), false);
  assert.equal(result.report.findings[0].judgment, 'act-on');
  assert.equal(pipelineReport(result).findings.length, 1);
});

test('OpenAI strict-schema contract rejects optional fields at every object depth', () => {
  const object = (properties) => ({
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  });
  const valid = object({
    findings: { type: 'array', items: object({ reproduction: object({ status: { type: 'string' } }) }) },
  });
  validateStrictSchema(valid);
  for (const location of [
    [],
    ['properties', 'findings', 'items'],
    ['properties', 'findings', 'items', 'properties', 'reproduction'],
  ]) {
    const invalid = structuredClone(valid);
    let node = invalid;
    for (const key of location) node = node[key];
    node.required = [];
    assert.throws(() => validateStrictSchema(invalid));
  }
  const open = structuredClone(valid);
  open.properties.findings.items.additionalProperties = true;
  assert.throws(() => validateStrictSchema(open));
});

for (const model of ['valid', 'finding', 'repro-not-run', 'repro-reported', 'repro-empty'])
  test(`Codex strict transport handles ${model} for reviewers and deep leads`, async (t) => {
    const f = await fixture(t);
    const result = await review({
      ...f.options,
      mode: 'deep',
      peers: [`codex:${model}`, 'opencode:valid'],
    });
    assert.equal(result.status, 'complete');
    assert.deepEqual(result.report, result.peers[0].report);
    assert.deepEqual(result.lead.report, result.report);
    if (model === 'valid') assert.deepEqual(result.report.findings, []);
    else if (model === 'finding') {
      assert.equal(Object.hasOwn(result.report.findings[0], 'reproduction'), false);
      assert.equal(pipelineReport(result).findings.length, 1);
    } else {
      assert.deepEqual(result.report.findings[0].reproduction, {
        status: model === 'repro-not-run' ? 'not-run' : 'reported-unverified',
        command: 'node calc.js',
        expected: '1\n',
        observed: model === 'repro-not-run' ? null : model === 'repro-empty' ? '' : '2\n',
      });
    }
  });

for (const host of hosts)
  test(`${host}: null reproduction is normalized only for Codex transport`, async (t) => {
    const f = await fixture(t);
    const result = await review({ ...f.options, peers: [`${host}:null-reproduction`] });
    assert.equal(result.status, host === 'codex' ? 'complete' : 'incomplete');
    if (host === 'codex') assert.equal(Object.hasOwn(result.report.findings[0], 'reproduction'), false);
    else assert.throws(() => pipelineReport(result), /incomplete/);
  });

for (const model of ['repro-verified', 'repro-missing-output', 'repro-inconsistent'])
  test(`Codex transport does not weaken ${model} evidence validation`, async (t) => {
    const f = await fixture(t);
    const result = await review({ ...f.options, peers: [`codex:${model}`] });
    assert.equal(result.status, 'incomplete');
    assert.throws(() => pipelineReport(result), /incomplete/);
  });

test('Codex lead normalization still refuses altered peer observations', async (t) => {
  const f = await fixture(t);
  const result = await review({
    ...f.options,
    mode: 'deep',
    peers: ['codex:repro-reported', 'opencode:valid'],
    lead: 'codex:repro-tampered',
  });
  assert.equal(result.status, 'incomplete');
  assert.ok(result.peers.every((peer) => peer.status === 'ok'));
  assert.equal(result.lead.status, 'failed');
  assert.throws(() => pipelineReport(result), /incomplete/);
});

test('deep synthesis retains an identical peer observation without upgrading it to confirmation', async (t) => {
  const f = await fixture(t);
  const result = await review({ ...f.options, mode: 'deep', peers: ['opencode:repro-reported', 'codex:valid'] });
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.report.findings[0].reproduction, result.peers[0].report.findings[0].reproduction);
  assert.equal(result.report.findings[0].reproduction.status, 'reported-unverified');
  assert.equal(result.peers[1].report.findings.length, 0);
});

for (const [name, peers, lead] of [
  ['invented observation', ['opencode:valid', 'codex:valid'], 'opencode:repro-reported'],
  ['altered observation', ['opencode:repro-reported', 'codex:valid'], 'opencode:repro-tampered'],
  ['altered command', ['opencode:repro-reported', 'codex:valid'], 'opencode:repro-tampered-command'],
  ['altered expectation', ['opencode:repro-reported', 'codex:valid'], 'opencode:repro-tampered-expected'],
  ['different file', ['opencode:repro-reported', 'codex:valid'], 'opencode:repro-tampered-file'],
  ['combined peer fragments', ['opencode:repro-peer-command', 'codex:repro-peer-expected'], 'opencode:repro-reported'],
  ['unrun check promoted to observed', ['opencode:repro-not-run', 'codex:valid'], 'opencode:repro-reported'],
])
  test(`deep synthesis refuses ${name} and cannot emit pipeline approval`, async (t) => {
    const f = await fixture(t);
    if (name === 'different file') {
      await fs.writeFile(path.join(f.repo, 'other.js'), 'export const other = 1;\n');
      await f.git('add', 'other.js');
      await f.git('commit', '-m', 'second changed file');
    }
    const result = await review({ ...f.options, mode: 'deep', peers, lead });
    assert.equal(result.status, 'incomplete');
    assert.ok(result.peers.every((peer) => peer.status === 'ok'));
    assert.ok(result.limitations.includes('reviewer-or-lead-failed'));
    assert.equal(result.report, null);
    assert.equal(result.lead.status, 'failed');
    assert.throws(() => pipelineReport(result), /incomplete/);
  });

test('deep lead can propose an unrun check without a peer observation', async (t) => {
  const f = await fixture(t);
  const result = await review({
    ...f.options,
    mode: 'deep',
    peers: ['opencode:valid', 'codex:valid'],
    lead: 'opencode:repro-not-run',
  });
  assert.equal(result.status, 'complete');
  assert.equal(result.report.findings[0].reproduction.status, 'not-run');
  assert.equal(result.report.findings[0].reproduction.observed, null);
});

for (const mode of ['structure', 'deep'])
  test(`${mode}: source-only findings survive without execution or reviewer agreement`, async (t) => {
    const f = await fixture(t);
    const peers = mode === 'deep' ? ['opencode:finding', 'codex:valid'] : ['opencode:finding'];
    const result = await review({ ...f.options, mode, peers });
    assert.equal(result.status, 'complete');
    assert.equal(result.report.findings[0].judgment, 'act-on');
    assert.equal(Object.hasOwn(result.report.findings[0], 'reproduction'), false);
    assert.equal(pipelineReport(result).findings.length, 1);
  });

for (const model of ['repro-verified', 'repro-missing-output', 'repro-inconsistent'])
  test(`runner rejects ${model} without emitting pipeline approval`, async (t) => {
    const f = await fixture(t);
    const result = await review({ ...f.options, peers: [`opencode:${model}`] });
    assert.equal(result.status, 'incomplete');
    assert.equal(result.peers[0].reason, 'invalid-report');
    assert.throws(() => pipelineReport(result), /incomplete/);
  });

test('empty reported output survives deep synthesis and pipeline serialization', async (t) => {
  const f = await fixture(t);
  const result = await review({ ...f.options, mode: 'deep', peers: ['opencode:repro-empty', 'codex:valid'] });
  assert.equal(result.status, 'complete');
  assert.equal(result.report.findings[0].reproduction.observed, '');
  assert.ok(pipelineReport(result).findings[0].description.includes('Observed: ""'));
});

test('report contract rejects forged confirmation and inconsistent observations but permits real empty output', () => {
  const finding = {
    file: 'calc.js',
    line: 1,
    severity: 'error',
    judgment: 'act-on',
    evidence: 'Input 0 returns 2.',
    consequence: 'Expected 1.',
    suggestion: 'Preserve the calculation contract.',
    action: 'auto-fix',
  };
  const report = {
    summary: 'Calculation.',
    risk_level: 'low',
    risk_rationale: 'Local defect.',
    reviewed_paths: ['calc.js'],
    findings: [
      {
        ...finding,
        reproduction: {
          status: 'reported-unverified',
          command: 'node calc.js',
          expected: '',
          observed: '',
        },
      },
    ],
  };
  assert.equal(validateReport(report, ['calc.js']), report);
  const legacy = structuredClone(report);
  delete legacy.findings[0].reproduction;
  assert.equal(validateReport(legacy, ['calc.js']), legacy);
  const nullReproduction = structuredClone(report);
  nullReproduction.findings[0].reproduction = null;
  assert.throws(() => validateReport(nullReproduction, ['calc.js']));
  for (const invalid of [
    { status: 'verified' },
    { verified: true },
    { command: ' ' },
    { observed: null },
    { status: 'not-run', observed: '2\n' },
  ]) {
    const changed = structuredClone(report);
    Object.assign(changed.findings[0].reproduction, invalid);
    assert.throws(() => validateReport(changed, ['calc.js']));
  }
});

test('schema rejects missing fields and source outside the reviewed scope', () => {
  const clean = {
    summary: 'Clean.',
    risk_level: 'low',
    risk_rationale: 'Bounded.',
    reviewed_paths: ['calc.js'],
    findings: [],
  };
  assert.throws(() => validateReport({ ...clean, risk_level: 'unknown' }, ['calc.js']));
  assert.throws(() => validateReport({ ...clean, reviewed_paths: ['../outside'] }, ['calc.js']));
  assert.throws(() => validateReport({ ...clean, findings: [{}] }, ['calc.js']));
  assert.throws(() =>
    decodeReport(
      `${JSON.stringify({ type: 'text', part: { text: JSON.stringify(clean) } })}\n${JSON.stringify({ type: 'error' })}`,
    ),
  );
});

test('installed, relocated fat bundle reviews without the source checkout and refuses overwrite', async (t) => {
  const f = await fixture(t);
  const dest = path.join(f.dir, 'installed/hardlook');
  await execute(process.execPath, [cli, 'install', '--dest', dest]);
  const relocated = path.join(f.dir, 'moved-skill');
  await fs.rename(dest, relocated);
  const installedCLI = path.join(relocated, 'scripts/hardlook.mjs');
  const result = await execute(
    process.execPath,
    [
      installedCLI,
      'review',
      '--repo',
      f.repo,
      '--base',
      'main',
      '--intent',
      'Change calculation.',
      '--peer',
      'codex:repro-reported',
      '--binary',
      `codex=${f.binaries.codex}`,
    ],
    { allowFailure: true },
  );
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).status, 'complete');
  assert.equal(JSON.parse(result.stdout).report.findings[0].reproduction.status, 'reported-unverified');
  const refused = await execute(process.execPath, [cli, 'install', '--dest', relocated], { allowFailure: true });
  assert.equal(refused.code, 2);
  const nested = await execute(process.execPath, [installedCLI, 'install', '--dest', path.join(relocated, 'nested')], {
    allowFailure: true,
  });
  assert.equal(nested.code, 2);
  await assert.rejects(fs.access(path.join(relocated, 'nested')));
  assert.equal(JSON.parse(await fs.readFile(path.join(relocated, 'manifest.json'), 'utf8')).version, skillVersion);
  for (const host of [...hosts, 'no-mistakes'])
    await fs.access(path.join(relocated, 'adapters', host, 'instructions.md'));
});

test('process caps output, times out, and does not expose stderr', async () => {
  await assert.rejects(
    execute(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 30 }),
    (error) => error.kind === 'timeout',
  );
  await assert.rejects(
    execute(process.execPath, ['-e', 'process.stdout.write("a".repeat(20000))'], { maxBytes: 100 }),
    (error) => error.kind === 'output-limit',
  );
  await assert.rejects(
    execute(process.execPath, ['-e', 'console.error("secret");process.exit(2)']),
    (error) => !error.message.includes('secret'),
  );
  await assert.rejects(
    execute(process.execPath, ['-e', 'console.error("Invalid API key: PRIVATE_FIXTURE");process.exit(1)']),
    (error) =>
      error.diagnosis === 'harness-reported-credential-rejection' && !JSON.stringify(error).includes('PRIVATE_FIXTURE'),
  );
  const value = await execute(process.execPath, [
    '-e',
    'const b=Buffer.from("🙂");process.stdout.write(b.subarray(0,2));setTimeout(()=>process.stdout.write(b.subarray(2)),20)',
  ]);
  assert.equal(value.stdout, '🙂');
});

async function waitForRecord(file) {
  for (let i = 0; i < 100; i++) {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('fixture did not start');
}

async function running(pid) {
  const { stdout } = await execute('ps', ['-o', 'stat=', '-p', String(pid)], { allowFailure: true });
  return Boolean(stdout.trim()) && !stdout.trim().startsWith('Z');
}

for (const cancel of [false, true])
  test(`process groups are reaped after ${cancel ? 'runner cancellation' : 'successful leader exit'}`, async (t) => {
    if (process.platform === 'win32') return t.skip('POSIX process groups');
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hardlook-process-'));
    const record = path.join(directory, 'pids.json');
    const caller = spawn(
      process.execPath,
      [path.join(fixtures, 'process-fixture.mjs'), 'caller', record, ...(cancel ? ['hold'] : [])],
      { stdio: 'ignore' },
    );
    const exited = new Promise((resolve) => caller.on('close', resolve));
    const pids = await waitForRecord(record);
    t.after(async () => {
      for (const pid of [caller.pid, pids.leader, pids.descendant]) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {}
      }
      await fs.rm(directory, { recursive: true, force: true });
    });
    if (cancel) caller.kill('SIGTERM');
    await Promise.race([
      exited,
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('runner failed to exit')), 3000);
        timer.unref();
      }),
    ]);
    assert.equal(await running(pids.descendant), false);
    assert.equal(await running(pids.leader), false);
  });

test(
  'SIGTERM on the actual CLI cancels reviewers and exits 143 after descendant cleanup',
  { timeout: 8000 },
  async (t) => {
    if (process.platform === 'win32') return t.skip('POSIX process groups');
    const f = await fixture(t);
    const record = path.join(f.dir, 'native-pids.json');
    const caller = spawn(
      process.execPath,
      [
        cli,
        'review',
        '--repo',
        f.repo,
        '--base',
        'main',
        '--intent',
        'Review the calculation.',
        '--peer',
        'opencode:process-hold',
        '--binary',
        `opencode=${f.binaries.opencode}`,
        '--timeout-ms',
        '3000',
      ],
      {
        env: {
          ...process.env,
          HARDLOOK_TEST_PROCESS_RECORD: record,
          HARDLOOK_TEST_PROCESS_FIXTURE: path.join(fixtures, 'process-fixture.mjs'),
        },
        stdio: 'ignore',
      },
    );
    const exited = new Promise((resolve) => caller.on('close', resolve));
    const pids = await waitForRecord(record);
    t.after(() => {
      for (const pid of [caller.pid, pids.leader, pids.descendant]) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {}
      }
    });
    caller.kill('SIGTERM');
    assert.equal(await exited, 143);
    assert.equal(await running(pids.descendant), false);
  },
);
