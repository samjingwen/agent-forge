import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = 'tooling/worktree-dependencies.mjs';
const receipt = 'node_modules/.agent-forge-dependencies.json';
const hasWorktrunk = spawnSync('wt', ['--version']).status === 0;

function run(binary, args, cwd, success = true) {
  const result = spawnSync(binary, args, {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      NPM_CONFIG_OFFLINE: 'true',
      NPM_CONFIG_AUDIT: 'false',
      NPM_CONFIG_FUND: 'false',
      // Every test has a disposable download cache; do not touch user npm state.
      NPM_CONFIG_CACHE: path.join(cwd, '.cache/npm'),
    },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  if (success) assert.equal(result.status, 0, result.stdout + result.stderr);
  return result;
}

async function write(directory, file, content) {
  await fs.mkdir(path.dirname(path.join(directory, file)), { recursive: true });
  await fs.writeFile(path.join(directory, file), content);
}

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-forge-worktrunk-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source with spaces');
  const dependency = path.join(directory, 'package');
  await write(
    dependency,
    'package.json',
    JSON.stringify({
      name: 'fixture-package',
      version: '1.0.0',
      files: ['bin.js'],
      bin: { 'fixture-bin': 'bin.js' },
    }),
  );
  await write(dependency, 'bin.js', '#!/usr/bin/env node\nconsole.log("fixture");\n');
  await fs.mkdir(source);
  run('npm', ['pack', '--ignore-scripts', '--pack-destination', source], dependency);
  await write(
    source,
    'package.json',
    JSON.stringify({
      name: 'worktree-fixture',
      version: '1.0.0',
      private: true,
      devDependencies: { 'fixture-package': 'file:fixture-package-1.0.0.tgz' },
      scripts: { preinstall: 'node -e "process.exit(91)"' },
    }),
  );
  for (const file of [script, '.config/wt.toml', '.worktreeinclude']) {
    await write(source, file, await fs.readFile(path.join(root, file)));
  }
  await write(
    source,
    '.gitignore',
    `${await fs.readFile(path.join(root, '.gitignore'), 'utf8')}\n.runtime/\n.credentials/\nvalidation/\n`,
  );
  run('npm', ['install', '--package-lock-only', '--ignore-scripts'], source);
  return { directory, source };
}

function prepare(directory, args = [], success = true) {
  return run(process.execPath, [script, ...args], directory, success);
}

test('locked preparation is offline, lifecycle-free, and idempotently reuses verified dependencies', async (t) => {
  const { source } = await fixture(t);
  assert.match(prepare(source).stdout, /Preparing locked dependencies/);
  await write(source, 'node_modules/reuse-proof', 'retain this installed tree');
  const before = await fs.readFile(path.join(source, receipt));
  const result = prepare(source);
  assert.match(result.stdout, /Reused verified dependencies without an install or download/);
  assert.equal(await fs.readFile(path.join(source, 'node_modules/reuse-proof'), 'utf8'), 'retain this installed tree');
  assert.deepEqual(await fs.readFile(path.join(source, receipt)), before);
});

test('changed ABI and installed metadata invalidate reuse; failed cold preparation leaves no receipt', async (t) => {
  const { source } = await fixture(t);
  prepare(source);
  const saved = JSON.parse(await fs.readFile(path.join(source, receipt)));
  saved.identity.abi = 'incompatible';
  await write(source, receipt, JSON.stringify(saved));
  assert.match(prepare(source).stdout, /Preparing locked dependencies/);
  await write(source, 'node_modules/.package-lock.json', '{}');
  assert.match(prepare(source).stdout, /Preparing locked dependencies/);
  await write(source, 'package-lock.json', 'invalid lockfile');
  assert.notEqual(prepare(source, [], false).status, 0);
  await assert.rejects(fs.access(path.join(source, receipt)), { code: 'ENOENT' });
});

test('preparation refuses writable dependency or cache paths redirected through symlinks', async (t) => {
  const { source, directory } = await fixture(t);
  const outside = path.join(directory, 'outside');
  await fs.mkdir(outside);
  await fs.symlink(outside, path.join(source, 'node_modules'));
  const result = prepare(source, [], false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing non-directory or symlink/);
  assert.deepEqual(await fs.readdir(outside), []);
});

test(
  'real Worktrunk copy and blocking creation reuse safe data but exclude private/runtime state',
  {
    skip: hasWorktrunk ? false : 'Worktrunk CLI not installed; run npm run test:worktrunk locally.',
  },
  async (t) => {
    const { source, directory } = await fixture(t);
    const userConfig = path.join(directory, 'wt-user.toml');
    await fs.writeFile(userConfig, '');
    const worktrunk = (args) => run('wt', ['--config', userConfig, ...args], source);
    run('git', ['init', '-b', 'master'], source);
    run('git', ['config', 'user.email', 'fixture@example.invalid'], source);
    run('git', ['config', 'user.name', 'Fixture'], source);
    prepare(source);
    await write(source, 'node_modules/reuse-proof', 'source dependency');
    // Synthetic fixtures only: none of these contents are read back.
    const privatePaths = [
      '.env',
      '.env.local',
      'settings.local.json',
      '.runtime/control.db',
      '.credentials/token',
      'validation/evidence.json',
      '.venv/bin/python',
      'build/output',
      '.cache/npm/_logs/session.log',
      '.cache/npm/_cacache/tmp/in-use.lock',
      '.cache/runtime/control.sqlite',
    ];
    for (const file of privatePaths) await write(source, file, 'synthetic-private-data');
    run('git', ['add', '.'], source);
    run('git', ['add', '--force', '.worktreeinclude'], source);
    run('git', ['commit', '-m', 'Disposable Worktrunk fixture'], source);
    const preview = path.join(directory, 'preview');
    worktrunk(['switch', '--create', 'preview', '--path', preview, '--no-hooks']);
    const dryRun = prepare(preview, ['--from', source, '--dry-run']);
    assert.match(dryRun.stdout, /node_modules/);
    assert.doesNotMatch(dryRun.stdout, /synthetic-private|\.env|control\.db|in-use\.lock|session\.log/);
    await assert.rejects(fs.access(path.join(preview, 'node_modules')), { code: 'ENOENT' });

    const warm = path.join(directory, 'warm');
    const created = worktrunk([
      'switch',
      '--create',
      'warm',
      '--path',
      warm,
      '--yes',
      '--execute',
      process.execPath,
      '--',
      '-e',
      "require('node:fs').accessSync('node_modules/fixture-package/package.json')",
    ]);
    assert.match(created.stdout + created.stderr, /Reused verified dependencies without an install or download/);
    assert.equal(await fs.readFile(path.join(warm, 'node_modules/reuse-proof'), 'utf8'), 'source dependency');
    for (const file of privatePaths) await assert.rejects(fs.access(path.join(warm, file)), { code: 'ENOENT' }, file);
    assert.equal((await fs.lstat(path.join(warm, 'node_modules'))).isSymbolicLink(), false);
    const left = await fs.stat(path.join(source, 'node_modules/reuse-proof'));
    const right = await fs.stat(path.join(warm, 'node_modules/reuse-proof'));
    assert.notEqual(left.ino, right.ino);
    await write(warm, 'node_modules/reuse-proof', 'isolated destination');
    assert.equal(await fs.readFile(path.join(source, 'node_modules/reuse-proof'), 'utf8'), 'source dependency');
    const cacheFiles = await fs.readdir(path.join(warm, '.cache/npm/_cacache'), { recursive: true });
    assert.ok(cacheFiles.some((file) => file.startsWith(`content-v2${path.sep}`)));
    assert.ok(cacheFiles.some((file) => file.startsWith(`index-v5${path.sep}`)));

    const original = await fs.readFile(path.join(source, receipt));
    for (const key of ['manifest', 'lock', 'node', 'npm', 'platform', 'arch', 'abi', 'target']) {
      const changed = JSON.parse(original);
      changed.identity[key] = 'incompatible';
      await write(source, receipt, JSON.stringify(changed));
      const result = prepare(preview, ['--from', source, '--dry-run']);
      assert.match(result.stdout, /Copying cache only/);
      assert.doesNotMatch(result.stdout, /reuse-proof|fixture-package\/package\.json/);
    }
    // An incompatible source still supplies download data, then npm prepares a new tree offline.
    const cold = prepare(preview, ['--from', source]);
    assert.match(cold.stdout, /Copying cache only/);
    assert.match(cold.stdout, /Preparing locked dependencies/);
    await assert.rejects(fs.access(path.join(preview, 'node_modules/reuse-proof')), { code: 'ENOENT' });
    await write(source, receipt, original);

    const missing = path.join(directory, 'missing-allowlist');
    worktrunk(['switch', '--create', 'missing-allowlist', '--path', missing, '--no-hooks']);
    await fs.rename(path.join(source, '.worktreeinclude'), path.join(source, 'saved-include'));
    assert.match(prepare(missing, ['--from', source, '--dry-run']).stdout, /Skipping copy/);
    await fs.rename(path.join(source, 'saved-include'), path.join(source, '.worktreeinclude'));
    await write(missing, 'node_modules/preserved', 'user work');
    assert.notEqual(prepare(missing, ['--from', source], false).status, 0);
    assert.equal(await fs.readFile(path.join(missing, 'node_modules/preserved'), 'utf8'), 'user work');
    await fs.symlink(
      path.relative(path.join(source, 'node_modules'), directory),
      path.join(source, 'node_modules/external-link'),
    );
    const unsafe = path.join(directory, 'unsafe');
    worktrunk(['switch', '--create', 'unsafe', '--path', unsafe, '--no-hooks']);
    assert.match(prepare(unsafe, ['--from', source], false).stderr, /Refusing dependency\/cache symlinks/);
    await assert.rejects(fs.access(path.join(unsafe, 'node_modules')), { code: 'ENOENT' });
    await fs.unlink(path.join(source, 'node_modules/external-link'));
    await fs.symlink(
      path.join(source, 'node_modules/fixture-package'),
      path.join(source, 'node_modules/absolute-link'),
    );
    assert.match(prepare(unsafe, ['--from', source], false).stderr, /Refusing path-bound absolute/);
    await fs.unlink(path.join(source, 'node_modules/absolute-link'));
    // Whole-directory copying cannot filter a nested private/control file.
    // The helper must refuse it before invoking the native copy consumer.
    for (const file of ['.env', 'nested/.npmrc', 'in-use.lock', 'control.db', '.cache/state']) {
      await write(source, `node_modules/${file}`, 'synthetic-private-data');
      const rejected = prepare(unsafe, ['--from', source, '--dry-run'], false);
      assert.notEqual(rejected.status, 0);
      assert.match(rejected.stderr, /Refusing private\/control paths/);
      await assert.rejects(fs.access(path.join(unsafe, 'node_modules')), { code: 'ENOENT' });
      await fs.rm(path.join(source, 'node_modules', file));
      if (file === '.cache/state') await fs.rmdir(path.join(source, 'node_modules/.cache'));
    }
  },
);
