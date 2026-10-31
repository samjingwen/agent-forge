import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { execute } from '../skills/hardlook/scripts/process.mjs';

const root = process.cwd();
const area = path.join(root, '.test-disposable/public-rerun');
await fs.mkdir(area, { recursive: true });
const env = { PATH: process.env.PATH, HOME: area, TMPDIR: path.join(root, '.test-disposable/tmp'),
  XDG_CONFIG_HOME: path.join(area, 'config'), XDG_DATA_HOME: path.join(area, 'data'),
  XDG_STATE_HOME: path.join(area, 'state'), XDG_CACHE_HOME: path.join(area, 'cache'),
  OPENCODE_DISABLE_AUTOUPDATE: '1', OPENCODE_DISABLE_MODELS_FETCH: '1' };
const cli = path.join(root, 'skills/hardlook/scripts/hardlook.mjs');
const observations = [];
async function call(args, expected = 0) {
  const child = spawnSync(process.execPath, [cli, ...args], { cwd: area, env, encoding: 'utf8', timeout: 20000 });
  if (child.error) throw child.error;
  const result = { code: child.status, stdout: child.stdout, stderr: child.stderr };
  observations.push({ args, ...result });
  assert.equal(result.code, expected);
  return result;
}
for (const generation of [1, 2]) {
  const binary = path.join(root, `.test-disposable/native/v${generation}/package/bin/opencode`);
  const doctor = await call(['doctor', '--binary', `opencode=${binary}`,
    ...['claude-code', 'codex', 'cursor', 'pi'].flatMap(h => ['--binary', `${h}=${process.execPath}`])]);
  const state = JSON.parse(doctor.stdout);
  assert.equal(state.model_access_checked, false);
  assert.equal(state.harnesses[0].generation, generation);
  assert.equal(state.harnesses[0].available, true);
}
const installed = await call(['install', '--dest', path.join(area, 'hardlook')]);
assert.equal(JSON.parse(installed.stdout).refresh_harness, true);
assert.equal(Object.hasOwn(JSON.parse(installed.stdout), 'restart_harness'), false);
const command = ['install-opencode-command', '--dest', path.join(area, '.opencode/commands/hardlook.md')];
assert.equal(JSON.parse((await call(command)).stdout).already_installed, false);
assert.equal(JSON.parse((await call(command)).stdout).already_installed, true);
for (const harness of ['claude-code', 'codex', 'cursor', 'pi']) {
  const result = await call(['review', '--repo', area, '--intent', 'Reject invalid selectors before repository access.',
    '--peer', `${harness}:model#high`, '--binary', `${harness}=${path.join(area, 'nonexistent')}`], 2);
  assert.equal(JSON.parse(result.stderr).reason, 'invalid model selector');
}
const git = args => execute('git', args, { cwd: area, env });
await git(['init', '-b', 'main']);
await git(['config', 'user.email', 'fixture@example.invalid']);
await git(['config', 'user.name', 'Fixture']);
await fs.writeFile(path.join(area, 'calc.js'), 'export const calc = n => n + 1;\n');
await git(['add', 'calc.js']);
await git(['commit', '-m', 'base']);
await git(['checkout', '-b', 'change']);
await fs.writeFile(path.join(area, 'calc.js'), 'export const calc = n => 1 + n;\n');
await git(['commit', '-am', 'change']);
const refused = await call(['review', '--repo', area, '--base', 'main', '--intent', 'Reject unsupported actual executable.',
  '--peer', 'opencode:fixture', '--binary', `opencode=${process.execPath}`], 2);
assert.equal(JSON.parse(refused.stdout).peers[0].reason, 'unsupported-cli-version');
console.log(JSON.stringify(observations, null, 2));
