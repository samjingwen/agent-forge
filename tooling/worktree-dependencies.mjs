#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const receiptPath = 'node_modules/.agent-forge-dependencies.json';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const hash = (value) => createHash('sha256').update(value).digest('hex');

function run(binary, args, cwd = root, capture = false) {
  const result = spawnSync(binary, args, { cwd, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${binary} ${args[0]} failed (${result.signal ?? result.status}).`);
  return result.stdout?.trim();
}

async function info(file) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function regular(file, optional = false) {
  const stat = await info(file);
  if (!stat && optional) return null;
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Expected a regular dependency metadata file: ${path.basename(file)}.`);
  }
  return fs.readFile(file);
}

async function directories(directory, relatives) {
  for (const relative of relatives) {
    const stat = await info(path.join(directory, relative));
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
      throw new Error(`Refusing non-directory or symlink at ${relative}.`);
    }
  }
}

async function identity(directory) {
  const [manifest, lock] = await Promise.all(
    ['package.json', 'package-lock.json'].map((file) => regular(path.join(directory, file))),
  );
  return {
    schema: 1,
    manifest: hash(manifest),
    lock: hash(lock),
    node: process.version,
    npm: run(npm, ['--version'], root, true),
    platform: process.platform,
    arch: process.arch,
    abi: process.versions.modules,
    // Preserve explicit cross-target settings, without reading private npm configuration.
    target: Object.fromEntries(
      Object.entries(process.env)
        .filter(([key]) => /^npm_config_(arch|platform|target|target_arch|target_platform|cpu|os|libc)$/i.test(key))
        .map(([key, value]) => [key.toLowerCase(), value])
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}

async function receipt(directory) {
  await directories(directory, ['node_modules']);
  const data = await regular(path.join(directory, receiptPath), true);
  if (!data) return null;
  const result = JSON.parse(data);
  const installed = await regular(path.join(directory, 'node_modules/.package-lock.json'), true);
  return result.installed === (installed ? hash(installed) : null) ? result : null;
}

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function compatible(directory, expected) {
  const saved = await receipt(directory);
  return saved && equal(saved.identity, expected) && equal(await identity(directory), expected);
}

async function safeTree(directory, relative) {
  const base = path.join(directory, relative);
  if (!(await info(base))) return;
  const entries = await fs.readdir(base, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    // Worktrunk v0.81 copies ignored directories as units. Do not rely on
    // descendant exclusion patterns to sanitize a selected directory.
    const name = entry.name;
    if (
      name === '.env' ||
      name.startsWith('.env.') ||
      name === '.npmrc' ||
      name === '.cache' ||
      /\.(lock|pid|sock|db)$|\.sqlite|\.local\.jsonc?$/i.test(name) ||
      (!entry.isFile() && !entry.isDirectory() && !entry.isSymbolicLink())
    ) {
      throw new Error('Refusing private/control paths inside a selected dependency/cache directory.');
    }
    if (!entry.isSymbolicLink()) continue;
    const link = path.join(entry.parentPath, entry.name);
    if (path.isAbsolute(await fs.readlink(link))) {
      throw new Error('Refusing path-bound absolute dependency/cache symlinks.');
    }
    const target = await fs.realpath(link);
    const escaped = path.relative(base, target);
    if (escaped === '..' || escaped.startsWith(`..${path.sep}`) || path.isAbsolute(escaped)) {
      throw new Error('Refusing dependency/cache symlinks outside their copied directory.');
    }
  }
}

async function copy(source, expected, dryRun) {
  // Worktrunk's source allowlist must match this reviewed destination policy.
  const include = await regular(path.join(root, '.worktreeinclude'));
  const sourceInclude = await regular(path.join(source, '.worktreeinclude'), true);
  if (!sourceInclude || !include.equals(sourceInclude)) {
    console.log('Skipping copy: source has no matching explicit allowlist.');
    return false;
  }
  await directories(source, ['node_modules', '.cache', '.cache/npm', '.cache/npm/_cacache']);
  const reuse = Boolean(await compatible(source, expected));
  const excludes = reuse ? [] : ['node_modules/'];
  if (reuse) await safeTree(source, 'node_modules');
  for (const part of ['content-v2', 'index-v5']) {
    const relative = `.cache/npm/_cacache/${part}`;
    await directories(source, [relative]);
    await safeTree(source, relative);
  }
  console.log(
    reuse
      ? 'Copying compatible npm dependencies and allowlisted cache.'
      : 'Copying cache only: dependencies are unverified or incompatible.',
  );
  run('wt', [
    '--config-set',
    `step.copy-ignored.exclude=${JSON.stringify(excludes)}`,
    'step',
    'copy-ignored',
    '--require-include',
    '--from',
    source,
    ...(dryRun ? ['--dry-run'] : []),
  ]);
  return reuse && !dryRun && Boolean(await compatible(source, expected)) && Boolean(await compatible(root, expected));
}

async function saveReceipt(expected) {
  await fs.mkdir(path.join(root, 'node_modules'), { recursive: true });
  const installed = await regular(path.join(root, 'node_modules/.package-lock.json'), true);
  await fs.writeFile(
    path.join(root, receiptPath),
    `${JSON.stringify({ identity: expected, installed: installed ? hash(installed) : null }, null, 2)}\n`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.at(-1) === '--dry-run';
  if (dryRun) args.pop();
  if (args.length && (args.length !== 2 || args[0] !== '--from')) {
    throw new Error('Usage: node tooling/worktree-dependencies.mjs [--from <worktree-path>] [--dry-run]');
  }
  await directories(root, [
    'node_modules',
    '.cache',
    '.cache/npm',
    '.cache/npm/_cacache',
    '.cache/npm/_cacache/content-v2',
    '.cache/npm/_cacache/index-v5',
  ]);
  for (const relative of ['.cache/npm/_cacache/content-v2', '.cache/npm/_cacache/index-v5']) {
    await safeTree(root, relative);
  }
  const expected = await identity(root);
  let ready = Boolean(await compatible(root, expected));
  if (args.length && path.resolve(args[1]) !== path.resolve(root)) {
    if (!ready && (await info(path.join(root, 'node_modules')))) {
      throw new Error('Destination already has unverified dependencies; run npm run deps:prepare without --from.');
    }
    if (!ready) ready = await copy(await fs.realpath(args[1]), expected, dryRun);
  }
  if (dryRun) return;
  if (ready) {
    await safeTree(root, 'node_modules');
    // npm checks the whole installed graph offline, including missing transitive packages.
    run(npm, ['ls', '--all', '--include=dev', '--offline'], root, true);
    if (!equal(await identity(root), expected)) throw new Error('Dependency inputs changed during reuse; retry.');
    console.log('Reused verified dependencies without an install or download.');
    return;
  }
  console.log('Preparing locked dependencies (npm ci, scripts disabled, cache preferred).');
  await fs.rm(path.join(root, receiptPath), { force: true });
  const cache = (await info(path.join(root, '.cache/npm/_cacache'))) ? ['--cache', '.cache/npm'] : [];
  run(npm, ['ci', '--ignore-scripts', '--include=dev', '--prefer-offline', '--no-audit', '--no-fund', ...cache]);
  run(npm, ['ls', '--all', '--include=dev', '--offline'], root, true);
  if (!equal(await identity(root), expected)) throw new Error('Dependency inputs changed during preparation; retry.');
  await saveReceipt(expected);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
