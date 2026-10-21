#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const markerName = '.agent-toolkit-generated.json';
const ignored = new Set(['.git', 'node_modules', '.DS_Store', '.venv', '__pycache__', '.gradle', 'coverage']);
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => {
  throw new Error(message);
};
const at = (...parts) => path.join(root, ...parts);

async function stat(file) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readJSON(file) {
  const info = await stat(file);
  if (!info?.isFile() || info.isSymbolicLink()) fail('Expected a regular JSON file: ' + file);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    fail('Could not read JSON at ' + file + ': ' + error.message);
  }
}

function validID(value, label) {
  if (typeof value !== 'string' || value.length > 64 || !idPattern.test(value)) {
    fail(label + ' must be a lowercase kebab-case identifier of 1-64 characters.');
  }
}

async function directory(file, optional = false) {
  const info = await stat(file);
  if (!info && optional) return false;
  if (!info?.isDirectory() || info.isSymbolicLink()) fail('Expected a real directory: ' + file);
  return true;
}

function include(file) {
  const name = path.basename(file);
  return (
    !ignored.has(name) &&
    name !== '.env' &&
    !name.startsWith('.env.') &&
    !name.endsWith('.local.json') &&
    !name.endsWith('.local.jsonc')
  );
}

async function checkCopyTree(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (!include(file)) continue;
    if (entry.isSymbolicLink()) fail('Packaging requires real files; found symlink: ' + file);
    if (entry.isDirectory()) await checkCopyTree(file);
    else if (!entry.isFile()) fail('Unsupported file type in bundle: ' + file);
  }
}

async function inspect() {
  for (const relative of [
    'skills',
    'plugins',
    'plugins/opencode',
    'plugins/claude-code',
    'mcp-servers',
    'packages',
    'catalog',
    'config',
    'evals',
  ]) {
    await directory(at(relative));
  }
  const catalog = await readJSON(at('catalog/claude-bundles.json'));
  const external = await readJSON(at('catalog/external-tools.json'));
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.bundles))
    fail('Invalid Claude bundle catalog: expected schemaVersion 1 and bundles array.');
  if (external.schemaVersion !== 1 || !Array.isArray(external.tools))
    fail('Invalid external tools catalog: expected schemaVersion 1 and tools array.');
  validID(catalog.marketplace?.name, 'Marketplace name');
  if (typeof catalog.marketplace?.owner?.name !== 'string' || !catalog.marketplace.owner.name.trim())
    fail('Marketplace owner.name is required.');
  const skills = new Map();
  for (const entry of await fs.readdir(at('skills'), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isSymbolicLink()) fail('Canonical skill directories must be real directories: ' + entry.name);
    if (!entry.isDirectory()) continue;
    validID(entry.name, 'Skill folder name');
    const skillPath = at('skills', entry.name);
    const info = await stat(path.join(skillPath, 'SKILL.md'));
    if (!info?.isFile() || info.isSymbolicLink()) fail('Missing regular SKILL.md in ' + skillPath);
    skills.set(entry.name, skillPath);
  }
  const names = new Set();
  for (const bundle of catalog.bundles) {
    validID(bundle.name, 'Bundle name');
    if (names.has(bundle.name)) fail('Duplicate bundle name: ' + bundle.name);
    names.add(bundle.name);
    if (bundle.source !== 'plugins/claude-code/' + bundle.name)
      fail('Bundle source must equal plugins/claude-code/' + bundle.name);
    if (!Array.isArray(bundle.skills) || new Set(bundle.skills).size !== bundle.skills.length)
      fail('Bundle skills must be an array of unique skill identifiers.');
    for (const skill of bundle.skills) {
      validID(skill, 'Skill identifier');
      if (!skills.has(skill)) fail('Unknown skill ' + skill + ' in bundle ' + bundle.name);
    }
    const source = at(bundle.source);
    await directory(source);
    await directory(path.join(source, '.claude-plugin'));
    if (await stat(path.join(source, 'skills')))
      fail('The source plugin skills/ path is reserved for generated canonical skills: ' + source);
    const manifest = await readJSON(path.join(source, '.claude-plugin/plugin.json'));
    if (manifest.name !== bundle.name) fail('Plugin manifest name must match bundle name: ' + bundle.name);
    await checkCopyTree(source);
    for (const skill of bundle.skills) await checkCopyTree(skills.get(skill));
  }
  return { catalog, external, skills };
}

async function check() {
  const { catalog, external, skills } = await inspect();
  console.log(
    'Structure OK: ' +
      skills.size +
      ' skills, ' +
      catalog.bundles.length +
      ' Claude bundles, ' +
      external.tools.length +
      ' external tool records.',
  );
  console.log(
    'This checks structure and packaging inputs. Run native validators and real integration checks for each component.',
  );
}

async function buildClaude() {
  const { catalog, skills } = await inspect();
  if (catalog.bundles.length === 0) {
    if ((await stat(at('distribution/claude-code'))) || (await stat(at('.claude-plugin/marketplace.json')))) {
      fail(
        'The bundle catalog is empty but publication files still exist. Preserve or remove those obsolete files explicitly before publishing, or restore the bundle entries.',
      );
    }
    console.log('No Claude bundles configured. Nothing was generated.');
    return;
  }
  if (catalog.marketplace.owner.name === 'CHANGE_ME')
    fail('Set marketplace.owner.name in catalog/claude-bundles.json before building.');
  await directory(at('distribution'), true);
  await directory(at('.claude-plugin'), true);
  const target = at('distribution/claude-code');
  const marketplacePath = at('.claude-plugin/marketplace.json');
  let previous = null;
  if (await stat(target)) {
    await directory(target);
    previous = await readJSON(path.join(target, markerName));
    if (previous.generator !== 'agent-toolkit')
      fail('Refusing to replace an output directory not owned by this generator.');
  }
  if (await stat(marketplacePath)) {
    const info = await stat(marketplacePath);
    if (!info.isFile() || info.isSymbolicLink()) fail('Marketplace must be a regular file.');
    const currentHash = hash(await fs.readFile(marketplacePath));
    if (!previous || previous.marketplaceHash !== currentHash)
      fail('Marketplace is unmanaged or edited by hand. Preserve it before using this generator.');
  }
  const marketplace = {
    name: catalog.marketplace.name,
    owner: catalog.marketplace.owner,
    plugins: catalog.bundles.map((bundle) => ({
      name: bundle.name,
      source: './distribution/claude-code/' + bundle.name,
    })),
  };
  const marketplaceText = json(marketplace);
  await fs.mkdir(at('distribution'), { recursive: true });
  const stage = await fs.mkdtemp(at('distribution/.claude-stage-'));
  let marketplaceTemp = null;
  let backup = null;
  let installed = false;
  try {
    for (const bundle of catalog.bundles) {
      const output = path.join(stage, bundle.name);
      await fs.cp(at(bundle.source), output, { recursive: true, filter: include });
      for (const skill of bundle.skills) {
        await fs.cp(skills.get(skill), path.join(output, 'skills', skill), { recursive: true, filter: include });
      }
    }
    await fs.writeFile(
      path.join(stage, markerName),
      json({
        generator: 'agent-toolkit',
        schemaVersion: 1,
        marketplaceHash: hash(marketplaceText),
      }),
    );
    await fs.mkdir(at('.claude-plugin'), { recursive: true });
    marketplaceTemp = at('.claude-plugin/.marketplace-' + randomUUID() + '.json');
    await fs.writeFile(marketplaceTemp, marketplaceText, { flag: 'wx' });
    if (previous) {
      backup = at('distribution/.claude-backup-' + randomUUID());
      await fs.rename(target, backup);
    }
    try {
      await fs.rename(stage, target);
      installed = true;
      await fs.rename(marketplaceTemp, marketplacePath);
    } catch (error) {
      if (installed) await fs.rm(target, { recursive: true });
      if (backup) await fs.rename(backup, target);
      throw error;
    }
    if (backup) await fs.rm(backup, { recursive: true });
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
    if (marketplaceTemp) await fs.rm(marketplaceTemp, { force: true });
  }
  console.log('Built ' + catalog.bundles.length + ' Claude plugin bundles in distribution/claude-code/.');
  console.log(
    'Commit distribution/claude-code/ and .claude-plugin/marketplace.json when publishing this repository as a marketplace.',
  );
  console.log(
    'This copies files. Compile and package runtime dependencies separately, then validate and test the installed plugins.',
  );
}

async function opencodeConfig() {
  await inspect();
  const plugins = [];
  for (const entry of await fs.readdir(at('plugins/opencode'), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const base = at('plugins/opencode', entry.name);
    for (const candidate of ['package.json', 'index.ts', 'index.js']) {
      if ((await stat(path.join(base, candidate)))?.isFile()) {
        plugins.push(base);
        break;
      }
    }
  }
  process.stdout.write(
    json({
      $schema: 'https://opencode.ai/config.json',
      skills: [at('skills')],
      plugins: plugins.sort(),
    }),
  );
}

try {
  const command = process.argv[2] || 'help';
  if (command === 'check') await check();
  else if (command === 'build:claude') await buildClaude();
  else if (command === 'config:opencode') await opencodeConfig();
  else {
    console.log('Usage: node tooling/agent-toolkit.mjs check|build:claude|config:opencode');
    if (command !== 'help' && command !== '--help') process.exitCode = 1;
  }
} catch (error) {
  console.error('agent-toolkit: ' + error.message);
  process.exitCode = 1;
}
