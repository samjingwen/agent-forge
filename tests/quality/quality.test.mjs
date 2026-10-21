import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { commands } = parse(await fs.readFile(path.join(root, '.no-mistakes.yaml'), 'utf8'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(binary, args, cwd) {
  const result = spawnSync(binary, args, {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      ...process.env,
      NO_COLOR: '1',
      NPM_CONFIG_OFFLINE: 'true',
      NPM_CONFIG_AUDIT: 'false',
      NPM_CONFIG_FUND: 'false',
    },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return result;
}

function hook(command, cwd) {
  assert.equal(typeof command, 'string');
  return process.platform === 'win32'
    ? run('cmd.exe', ['/d', '/s', '/c', command], cwd)
    : run('sh', ['-c', command], cwd);
}

async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-toolkit-quality-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

async function fixture(t) {
  const directory = await temporary(t);
  for (const file of ['package.json', 'eslint.config.mjs', 'prettier.config.mjs', '.prettierignore']) {
    await fs.copyFile(path.join(root, file), path.join(directory, file));
  }
  await fs.symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'junction');
  await fs.mkdir(path.join(directory, 'tooling'));
  await fs.writeFile(path.join(directory, 'tooling/example.mjs'), 'export const answer = 42;\n');
  return directory;
}

test('configured quality hook executes ESLint and Prettier successfully on conforming Node ESM', async (t) => {
  const directory = await fixture(t);
  await fs.writeFile(path.join(directory, 'tooling/example.mjs'), 'export const pid = process.pid;\n');
  const result = hook(commands.lint, directory);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('CommonJS receives its runtime globals but ESM cannot accidentally use require', async (t) => {
  const directory = await fixture(t);
  await fs.writeFile(path.join(directory, 'tooling/common.cjs'), 'module.exports = process.pid;\n');
  const conforming = hook(commands.lint, directory);
  assert.equal(conforming.status, 0, conforming.stdout + conforming.stderr);
  await fs.writeFile(path.join(directory, 'tooling/example.mjs'), "export const fs = require('node:fs');\n");
  const rejected = run(npm, ['run', '--silent', 'lint', '--', '--format', 'json'], directory);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.ok(
    JSON.parse(rejected.stdout).some((report) => report.messages.some((message) => message.ruleId === 'no-undef')),
  );
});

for (const file of [
  'tooling/example.mjs',
  'skills/example/scripts/helper.mjs',
  'tests/example/example.test.mjs',
  'evals/example/smoke.mjs',
  'plugins/opencode/example/index.js',
  'plugins/claude-code/example/hook.js',
  'mcp-servers/example/index.mjs',
  'packages/example/index.mjs',
])
  test(`real ESLint rejects undefined names in maintained surface: ${file}`, async (t) => {
    const directory = await fixture(t);
    const destination = path.join(directory, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, 'export const answer = missingValue;\n');
    const result = run(npm, ['run', '--silent', 'lint', '--', '--format', 'json'], directory);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const findings = JSON.parse(result.stdout).flatMap((report) => report.messages);
    assert.ok(findings.some((finding) => finding.ruleId === 'no-undef' && finding.severity === 2));
  });

test('strict comparison and excessive nesting fail real lint consumers', async (t) => {
  const directory = await fixture(t);
  const input = [
    'export function compare(value) {',
    '  if (value == 1) {',
    '    if (value) {',
    '      if (value) {',
    '        if (value) {',
    '          if (value) return true;',
    '        }',
    '      }',
    '    }',
    '  }',
    '  return false;',
    '}',
    '',
  ].join('\n');
  await fs.writeFile(path.join(directory, 'tooling/example.mjs'), input);
  const result = run(npm, ['run', '--silent', 'lint', '--', '--format', 'json'], directory);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const rules = new Set(
    JSON.parse(result.stdout).flatMap((report) => report.messages.map((message) => message.ruleId)),
  );
  assert.ok(rules.has('eqeqeq'));
  assert.ok(rules.has('max-depth'));
});

test('quality hook fails erroneous code without modifying it', async (t) => {
  const directory = await fixture(t);
  const file = path.join(directory, 'tooling/example.mjs');
  const input = 'export const answer = missingValue;\n';
  await fs.writeFile(file, input);
  const result = hook(commands.lint, directory);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.equal(await fs.readFile(file, 'utf8'), input);
});

test('format checks fail without mutation; the separate configured formatter fixes layout', async (t) => {
  const directory = await fixture(t);
  const file = path.join(directory, 'tooling/example.mjs');
  const input = 'export const answer=42\n';
  await fs.writeFile(file, input);
  const checked = run(npm, ['run', '--silent', 'format:check'], directory);
  assert.equal(checked.status, 1, checked.stdout + checked.stderr);
  assert.equal(await fs.readFile(file, 'utf8'), input);
  const quality = hook(commands.lint, directory);
  assert.equal(quality.status, 1, quality.stdout + quality.stderr);
  assert.equal(await fs.readFile(file, 'utf8'), input);
  const fixed = hook(commands.format, directory);
  assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
  // The independently specified formatted artifact is this fixture's public output contract.
  assert.equal(await fs.readFile(file, 'utf8'), 'export const answer = 42;\n');
  const rechecked = hook(commands.lint, directory);
  assert.equal(rechecked.status, 0, rechecked.stdout + rechecked.stderr);
});

test('generated distribution and build output are excluded, not the maintained source trees', async (t) => {
  const directory = await fixture(t);
  for (const file of [
    'distribution/claude-code/example/generated.js',
    'dist/generated.js',
    'build/generated.js',
    'plugins/opencode/example/dist/generated.js',
    'mcp-servers/example/build/generated.js',
    'packages/example/dist/generated.js',
    '.worktrees/example/scratch.js',
  ]) {
    await fs.mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await fs.writeFile(path.join(directory, file), 'this is deliberately invalid JavaScript !!!\n');
  }
  const result = hook(commands.lint, directory);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('private environment filenames are not parsed as maintained JavaScript', async (t) => {
  const directory = await fixture(t);
  // Synthetic input only; neither this test nor the tools read its contents back.
  await fs.writeFile(path.join(directory, '.env.fixture.mjs'), 'deliberately invalid JavaScript !!!\n');
  const result = hook(commands.lint, directory);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const formatted = hook(commands.format, directory);
  assert.equal(formatted.status, 0, formatted.stdout + formatted.stderr);
});

test('formatting leaves non-JavaScript upstream byte contracts untouched', async (t) => {
  const directory = await fixture(t);
  const files = {
    'skills/example/schemas/pinned.json': '{"pinned":true,"version":1}\n',
    'skills/example/scripts/pinned.py': 'value=  1\n',
    'skills/example/references/protocol.md': '# Deliberately retained layout\n\nOriginal   spacing.\n',
  };
  for (const [file, contents] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await fs.writeFile(path.join(directory, file), contents);
  }
  const result = hook(commands.format, directory);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const [file, contents] of Object.entries(files))
    assert.equal(await fs.readFile(path.join(directory, file), 'utf8'), contents);
});

test('configured preparation runs npm ci without lifecycle scripts and rejects an invalid lockfile', async (t) => {
  const directory = await temporary(t);
  const packageJSON = {
    name: 'quality-prepare-fixture',
    version: '1.0.0',
    private: true,
    scripts: { preinstall: "node -e \"require('node:fs').writeFileSync('lifecycle-ran', 'unexpected')\"" },
  };
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify(packageJSON));
  await fs.writeFile(
    path.join(directory, 'package-lock.json'),
    JSON.stringify({
      name: packageJSON.name,
      version: packageJSON.version,
      lockfileVersion: 3,
      requires: true,
      packages: { '': { name: packageJSON.name, version: packageJSON.version, hasInstallScript: true } },
    }),
  );
  const prepared = hook(commands.prepare, directory);
  assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr);
  await assert.rejects(fs.access(path.join(directory, 'lifecycle-ran')));
  await fs.writeFile(path.join(directory, 'package-lock.json'), 'not a lockfile');
  const rejected = hook(commands.prepare, directory);
  assert.notEqual(rejected.status, 0);
});
