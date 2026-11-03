import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const optional = ['plugins', 'plugins/opencode', 'plugins/claude-code', 'mcp-servers', 'packages'];
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

async function fixture(t) {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'agent-forge-layout-')));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  for (const relative of ['tooling', 'skills/example', 'catalog', 'config', 'evals']) {
    await fs.mkdir(path.join(directory, relative), { recursive: true });
  }
  await fs.copyFile(path.join(root, 'tooling/agent-toolkit.mjs'), path.join(directory, 'tooling/agent-toolkit.mjs'));
  await fs.writeFile(
    path.join(directory, 'skills/example/SKILL.md'),
    '---\nname: example\ndescription: Layout fixture.\n---\n\nReview fixture.\n',
  );
  await fs.writeFile(path.join(directory, 'config/README.md'), 'Real configuration documentation.\n');
  await fs.writeFile(path.join(directory, 'evals/README.md'), 'Real evaluation documentation.\n');
  await fs.writeFile(
    path.join(directory, 'catalog/claude-bundles.json'),
    json({ schemaVersion: 1, marketplace: { name: 'agent-forge', owner: { name: 'Fixture' } }, bundles: [] }),
  );
  await fs.writeFile(path.join(directory, 'catalog/external-tools.json'), json({ schemaVersion: 1, tools: [] }));
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

test('sparse checkout runs every tooling entrypoint without creating optional scaffolding', async (t) => {
  const directory = await fixture(t);
  const before = (await fs.readdir(directory, { recursive: true })).sort();
  for (const command of ['check', 'config:opencode', 'build:claude']) {
    const result = run(directory, command);
    assert.equal(result.status, 0, result.stderr);
    if (command === 'config:opencode')
      assert.deepEqual(JSON.parse(result.stdout), {
        $schema: 'https://opencode.ai/config.json',
        skills: [path.join(directory, 'skills')],
        plugins: [],
      });
  }
  assert.deepEqual((await fs.readdir(directory, { recursive: true })).sort(), before);
  for (const relative of optional) await assert.rejects(fs.lstat(path.join(directory, relative)), { code: 'ENOENT' });
});

for (const relative of optional)
  for (const kind of ['file', 'symlink'])
    test(`optional path ${relative} rejects a present ${kind}`, async (t) => {
      const directory = await fixture(t);
      const target = path.join(directory, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      if (kind === 'file') await fs.writeFile(target, 'Preserve this non-directory.\n');
      else {
        const outside = path.join(directory, 'outside');
        await fs.mkdir(outside);
        await fs.symlink(outside, target);
      }
      for (const command of ['check', 'config:opencode', 'build:claude']) {
        const result = run(directory, command);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Expected a real directory/);
        assert.ok(result.stderr.includes(target));
      }
      assert.equal((await fs.lstat(target)).isSymbolicLink(), kind === 'symlink');
      if (kind === 'file') assert.equal(await fs.readFile(target, 'utf8'), 'Preserve this non-directory.\n');
      else assert.equal(await fs.readlink(target), path.join(directory, 'outside'));
    });

for (const relative of ['skills', 'catalog', 'config', 'evals'])
  test(`required directory ${relative} is still enforced`, async (t) => {
    const directory = await fixture(t);
    await fs.rm(path.join(directory, relative), { recursive: true });
    const result = run(directory, 'check');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Expected a real directory/);
    assert.ok(result.stderr.includes(path.join(directory, relative)));
  });

test('OpenCode configuration still discovers sorted real plugin entrypoints', async (t) => {
  const directory = await fixture(t);
  for (const name of ['alpha', 'zeta', 'not-a-plugin', '.hidden']) {
    await fs.mkdir(path.join(directory, 'plugins/opencode', name), { recursive: true });
  }
  await fs.writeFile(path.join(directory, 'plugins/opencode/alpha/index.js'), 'export default async () => ({});\n');
  await fs.writeFile(
    path.join(directory, 'plugins/opencode/zeta/package.json'),
    json({ name: 'fixture-zeta', version: '0.1.0' }),
  );
  await fs.writeFile(path.join(directory, 'plugins/opencode/.hidden/index.js'), 'export default async () => ({});\n');
  const result = run(directory, 'config:opencode');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    JSON.parse(result.stdout).plugins,
    ['alpha', 'zeta'].map((name) => path.join(directory, 'plugins/opencode', name)),
  );
  await assert.rejects(fs.access(path.join(directory, 'plugins/claude-code')));
});

async function configureBundle(directory) {
  const catalogPath = path.join(directory, 'catalog/claude-bundles.json');
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  catalog.bundles = [{ name: 'example', source: 'plugins/claude-code/example', skills: ['example'] }];
  await fs.writeFile(catalogPath, json(catalog));
}

test('a declared Claude bundle still requires its real wrapper source', async (t) => {
  const directory = await fixture(t);
  await configureBundle(directory);
  for (const command of ['check', 'build:claude']) {
    const result = run(directory, command);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Expected a real directory: .*plugins\/claude-code\/example/);
  }
  await assert.rejects(fs.access(path.join(directory, 'distribution')));
});

test('a configured Claude wrapper packages without unrelated optional roots', async (t) => {
  const directory = await fixture(t);
  await configureBundle(directory);
  const wrapper = path.join(directory, 'plugins/claude-code/example/.claude-plugin');
  await fs.mkdir(wrapper, { recursive: true });
  await fs.writeFile(path.join(wrapper, 'plugin.json'), json({ name: 'example', version: '0.1.0' }));
  const result = run(directory, 'build:claude');
  assert.equal(result.status, 0, result.stderr);
  const marketplace = JSON.parse(await fs.readFile(path.join(directory, '.claude-plugin/marketplace.json'), 'utf8'));
  assert.deepEqual(marketplace.plugins, [{ name: 'example', source: './distribution/claude-code/example' }]);
  assert.deepEqual(
    await fs.readFile(path.join(directory, 'distribution/claude-code/example/skills/example/SKILL.md')),
    await fs.readFile(path.join(directory, 'skills/example/SKILL.md')),
  );
  for (const relative of ['plugins/opencode', 'mcp-servers', 'packages'])
    await assert.rejects(fs.access(path.join(directory, relative)));
});

test('an empty catalog still refuses existing publication output in a sparse checkout', async (t) => {
  const directory = await fixture(t);
  const output = path.join(directory, 'distribution/claude-code/retained.txt');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, 'Preserve this publication.\n');
  const result = run(directory, 'build:claude');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /catalog is empty but publication files still exist/);
  assert.equal(await fs.readFile(output, 'utf8'), 'Preserve this publication.\n');
});
