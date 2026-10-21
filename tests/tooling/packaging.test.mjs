import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

async function fixture(t, generator = 'agent-toolkit') {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'agent-forge-packaging-')));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  for (const relative of [
    'tooling',
    'skills/example',
    'plugins/opencode',
    'plugins/claude-code/example/.claude-plugin',
    'mcp-servers',
    'packages',
    'catalog',
    'config',
    'evals',
    '.claude-plugin',
    'distribution/claude-code/example',
  ])
    await fs.mkdir(path.join(directory, relative), { recursive: true });
  await fs.copyFile(path.join(root, 'tooling/agent-toolkit.mjs'), path.join(directory, 'tooling/agent-toolkit.mjs'));
  const json = (value) => JSON.stringify(value, null, 2) + '\n';
  await fs.writeFile(
    path.join(directory, 'catalog/claude-bundles.json'),
    json({
      schemaVersion: 1,
      marketplace: { name: 'agent-forge', owner: { name: 'Fixture' } },
      bundles: [{ name: 'example', source: 'plugins/claude-code/example', skills: ['example'] }],
    }),
  );
  await fs.writeFile(path.join(directory, 'catalog/external-tools.json'), json({ schemaVersion: 1, tools: [] }));
  await fs.writeFile(
    path.join(directory, 'plugins/claude-code/example/.claude-plugin/plugin.json'),
    json({ name: 'example', version: '0.1.0' }),
  );
  await fs.writeFile(
    path.join(directory, 'skills/example/SKILL.md'),
    '---\nname: example\ndescription: A packaging fixture.\n---\n\nFixture skill.\n',
  );
  // The independent oracle is the documented pre-rename ownership protocol.
  const legacyMarketplace = json({
    name: 'agent-toolkit',
    owner: { name: 'Fixture' },
    plugins: [{ name: 'example', source: './distribution/claude-code/example' }],
  });
  await fs.writeFile(path.join(directory, '.claude-plugin/marketplace.json'), legacyMarketplace);
  await fs.writeFile(
    path.join(directory, 'distribution/claude-code/.agent-toolkit-generated.json'),
    json({
      generator,
      schemaVersion: 1,
      marketplaceHash: createHash('sha256').update(legacyMarketplace).digest('hex'),
    }),
  );
  await fs.writeFile(
    path.join(directory, 'distribution/claude-code/example/old.txt'),
    'Previously installed output.\n',
  );
  return directory;
}

function run(directory, command) {
  const result = spawnSync(process.execPath, [path.join(directory, 'tooling/agent-toolkit.mjs'), command], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return result;
}

test('current marketplace identity rebuilds legacy-owned distribution without changing its ownership protocol', async (t) => {
  const directory = await fixture(t);
  const result = run(directory, 'build:claude');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const marketplace = JSON.parse(await fs.readFile(path.join(directory, '.claude-plugin/marketplace.json'), 'utf8'));
  assert.equal(marketplace.name, 'agent-forge');
  assert.equal(marketplace.plugins[0].source, './distribution/claude-code/example');
  const marker = JSON.parse(
    await fs.readFile(path.join(directory, 'distribution/claude-code/.agent-toolkit-generated.json'), 'utf8'),
  );
  assert.equal(marker.generator, 'agent-toolkit');
  assert.equal(
    marker.marketplaceHash,
    createHash('sha256')
      .update(await fs.readFile(path.join(directory, '.claude-plugin/marketplace.json')))
      .digest('hex'),
  );
  assert.equal(
    await fs.readFile(path.join(directory, 'distribution/claude-code/example/skills/example/SKILL.md'), 'utf8'),
    await fs.readFile(path.join(directory, 'skills/example/SKILL.md'), 'utf8'),
  );
  await assert.rejects(fs.access(path.join(directory, 'distribution/claude-code/example/old.txt')));
  await assert.rejects(fs.access(path.join(directory, 'distribution/claude-code/.agent-forge-generated.json')));
});

test('unowned distribution is refused and preserved after the rename', async (t) => {
  const directory = await fixture(t, 'another-tool');
  const before = await fs.readFile(path.join(directory, '.claude-plugin/marketplace.json'));
  const result = run(directory, 'build:claude');
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /^agent-forge: /);
  assert.deepEqual(await fs.readFile(path.join(directory, '.claude-plugin/marketplace.json')), before);
  assert.equal(
    await fs.readFile(path.join(directory, 'distribution/claude-code/example/old.txt'), 'utf8'),
    'Previously installed output.\n',
  );
});

test('legacy CLI entrypoint resolves resources from its own checkout rather than the caller directory', async (t) => {
  const directory = await fixture(t);
  const result = run(directory, 'config:opencode');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).skills, [path.join(directory, 'skills')]);
  assert.deepEqual(JSON.parse(result.stdout).plugins, []);
});
