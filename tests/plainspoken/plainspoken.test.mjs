import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const skill = path.join(root, 'skills/plainspoken');
const cli = path.join(skill, 'scripts/ste-lint.py');
const python = process.env.PYTHON || 'python3';

function run(args = [], { input = '', script = cli, cwd = root } = {}) {
  const result = spawnSync(python, [script, ...args], {
    input,
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONUTF8: '1' },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return result;
}

async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plainspoken-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('upstream linter self-test passes without third-party packages', () => {
  const result = run(['--selftest']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'selftest OK');
});

test('JSON stdin output distinguishes hard findings from advisory findings', () => {
  const result = run(['--json'], {
    input:
      'The panel is removed; spin up the job. Perform an analysis of the seamless log. We have received the report.',
  });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(
    new Set(report.violations.map((finding) => finding.rule)),
    new Set(['semicolon', 'phrasal-verb', 'nominalization', 'marketing-adjective', 'passive-voice', 'present-perfect']),
  );
  assert.equal(report.hard_count, 4);
  assert.equal(report.count, 6);
  assert.equal(report.baseline, 0);
  assert.ok(report.words > 0);
  assert.ok(report.violations.every((finding) => finding.file === '<stdin>' && finding.line === 1 && finding.col > 0));
});

test('uncertainty and modal-perfect forms remain unflagged', () => {
  const result = run(['--json'], {
    input:
      "The request may have failed. The disk might have filled. The task couldn't have run. The task MAY NOT HAVE RUN.",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).violations, []);
});

test('advisory findings do not fail a run', () => {
  const result = run(['--json'], { input: 'The panel is removed. We have received the report.' });
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.hard_count, 0);
  assert.equal(report.count, 2);
  assert.ok(report.violations.every((finding) => finding.level === 'advisory'));
});

test('baseline permits only the configured number of hard findings', () => {
  const allowed = run(['--json', '--baseline', '2'], { input: 'a; b; c' });
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.equal(JSON.parse(allowed.stdout).hard_count, 2);
  assert.equal(JSON.parse(allowed.stdout).baseline, 2);
  const rejected = run(['--json', '--baseline', '1'], { input: 'a; b; c' });
  assert.equal(rejected.status, 1, rejected.stderr);
});

test('disabled rules are removed before counting hard findings', () => {
  const result = run(['--json', '--disable', 'semicolon'], { input: 'a; b' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).violations, []);
});

test('file arguments support spaces and intermixed flags, with a shared baseline', async (t) => {
  const directory = await temporary(t);
  const files = [path.join(directory, 'first document.md'), path.join(directory, 'second document.md')];
  for (const file of files) await fs.writeFile(file, 'One; two.\n');
  const result = run([files[0], '--json', '--baseline', '1', files[1]]);
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(report.hard_count, 2);
  assert.deepEqual(
    report.violations.map((finding) => finding.file),
    files,
  );
});

test('synonym rotation is scoped to each input file', async (t) => {
  const directory = await temporary(t);
  const first = path.join(directory, 'first.md');
  const second = path.join(directory, 'second.md');
  await fs.writeFile(first, 'Check the output.\n');
  await fs.writeFile(second, 'Verify the result.\n');
  assert.equal(run(['--json', first, second]).status, 0);
  const combined = run(['--json'], { input: 'Check the output. Verify the result.' });
  assert.equal(combined.status, 1, combined.stderr);
  assert.equal(JSON.parse(combined.stdout).violations[0].rule, 'synonym-rotation');
});

test('inline code and fenced code are excluded from prose findings', () => {
  const result = run(['--json'], {
    input: 'Run `sync; spin up seamless`.\n\n```text\na; b; spin up the seamless job\n```\n',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).violations, []);
});

test('bundled invalid example reports exactly two incomplete list items', () => {
  const file = path.join(skill, 'examples/linter-edge-cases.md');
  const result = run(['--json', file]);
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(report.hard_count, 2);
  assert.deepEqual(
    report.violations.map(({ rule, line, col }) => ({ rule, line, col })),
    [
      { rule: 'dangling-conjunction', line: 7, col: 1 },
      { rule: 'dangling-conjunction', line: 8, col: 1 },
    ],
  );
});

test('wrapped prose is counted as one sentence, not one sentence per source line', () => {
  const result = run(['--json'], { input: 'First ' + 'word '.repeat(15) + '\n' + 'word '.repeat(15) + 'last.' });
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(report.violations.length, 1);
  assert.equal(report.violations[0].rule, 'long-sentence');
  assert.equal(report.violations[0].line, 1);
  assert.equal(report.violations[0].col, 1);
});

test('worked example rewrites pass structural checks without raising the baseline', async () => {
  const document = await fs.readFile(path.join(skill, 'examples/before-after.md'), 'utf8');
  const rewrites = [...document.matchAll(/\*\*After:\*\*\n\n((?:>[^\n]*(?:\n|$))+)/g)];
  assert.equal(rewrites.length, 5);
  for (const [, block] of rewrites) {
    const input = block.replace(/^> ?/gm, '');
    const result = run(['--json'], { input });
    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.equal(JSON.parse(result.stdout).hard_count, 0);
  }
});

for (const args of [
  ['--basline', '3'],
  ['--baseline'],
  ['--baseline', '-1'],
  ['--baseline', 'invalid'],
  ['--disable', 'unknown-rule'],
  ['--base', '3'],
])
  test(`invalid CLI arguments exit 2: ${args.join(' ')}`, () => {
    const result = run(args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /error:/);
  });

test('unreadable input exits 2 instead of returning a clean report', async (t) => {
  const directory = await temporary(t);
  const result = run(['--json', path.join(directory, 'missing.md')]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /cannot read/);
  assert.equal(result.stdout, '');
});

test('parsed bundle metadata, catalog, and independently pinned upstream byte contracts agree', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(skill, 'manifest.json'), 'utf8'));
  const upstream = manifest.provenance[0];
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'catalog/external-tools.json'), 'utf8'));
  const record = catalog.tools.find((tool) => tool.name === upstream.project);
  const packageJSON = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.name, 'plainspoken');
  assert.equal(manifest.entrypoint, 'SKILL.md');
  const lines = (await fs.readFile(path.join(skill, manifest.entrypoint), 'utf8')).split(/\r?\n/);
  assert.equal(lines.shift(), '---');
  const boundary = lines.indexOf('---');
  assert.ok(boundary >= 0);
  const metadata = parse(lines.slice(0, boundary).join('\n'));
  assert.deepEqual(Object.keys(metadata).sort(), ['description', 'name']);
  assert.equal(metadata.name, manifest.name);
  assert.equal(typeof metadata.description, 'string');
  assert.ok(metadata.description.length > 0 && metadata.description.length <= 1024);
  // Independent byte-contract oracles verified against blobs at the pinned upstream commit.
  const pinned = {
    'scripts/ste-lint.py': '32263de1b6b74cc3f83846ae8545ba6c57994db0ba1ec1c8d842c310427886d1',
    LICENSE: 'd3c674e8592076c9021a59b55177adbcba6fd7e1710082becb922522b22ec672',
    'examples/linter-edge-cases.md': 'b6cc08af876014453b0c72d26ee4bfaeed1e9a154b5046947392752911ce1774',
  };
  assert.equal(upstream.revision, '3944283c183eea13fe5bd902b572da3b4de8bf44');
  assert.equal(upstream.version, '0.4.0');
  assert.equal(upstream.project, 'asd-ste100-skill');
  assert.equal(upstream.source, 'https://github.com/danyuchn/asd-ste100-skill');
  assert.equal(upstream.license, 'MIT');
  assert.deepEqual(upstream.unchangedFiles, pinned);
  for (const [file, expected] of Object.entries(pinned))
    assert.equal(
      createHash('sha256')
        .update(await fs.readFile(path.join(skill, file)))
        .digest('hex'),
      expected,
      file,
    );
  assert.equal(record.source, upstream.source);
  assert.equal(record.revision, upstream.revision);
  assert.equal(record.license, 'MIT');
  assert.equal(record.version, '0.4.0');
  assert.equal(record.vendoredAt, 'skills/plainspoken');
  assert.deepEqual(manifest.runtimePythonDependencies, []);
  assert.ok(packageJSON.pi.skills.includes('./skills/plainspoken'));
});

test('copied and relocated skill runs without root documentation, packages, or original working directory', async (t) => {
  const directory = await temporary(t);
  const installed = path.join(directory, 'install/plainspoken');
  await fs.cp(skill, installed, { recursive: true });
  const relocated = path.join(directory, 'relocated');
  await fs.rename(installed, relocated);
  const empty = path.join(directory, 'empty-project');
  await fs.mkdir(empty);
  const script = path.join(relocated, 'scripts/ste-lint.py');
  const result = run(['--json'], { script, cwd: empty, input: 'The request may have failed.' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).count, 0);
  const invalid = run(['--json', path.join(relocated, 'examples/linter-edge-cases.md')], { script, cwd: empty });
  assert.equal(invalid.status, 1, invalid.stderr);
  assert.equal(JSON.parse(invalid.stdout).hard_count, 2);
  for (const file of [
    'SKILL.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'manifest.json',
    'references/writing-rules.md',
    'examples/before-after.md',
  ]) {
    assert.deepEqual(await fs.readFile(path.join(relocated, file)), await fs.readFile(path.join(skill, file)));
  }
  await assert.rejects(fs.access(path.join(relocated, 'package.json')));
});
