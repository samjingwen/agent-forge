import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { execute } from '../../skills/hardlook/scripts/process.mjs';

const { values } = parseArgs({ options: { peer: { type: 'string' }, 'timeout-ms': { type: 'string' } } });
if (!values.peer) throw new Error('--peer is required; live evaluation is opt-in');
const cli = fileURLToPath(new URL('../../skills/hardlook/scripts/hardlook.mjs', import.meta.url));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'hardlook-eval-'));
const observations = [];
try {
  for (const [name, implementation] of [
    ['introduced-defect', 'export function subtract(a, b) { return a + b; }\n'],
    ['clean-control', 'export function subtract(a, b) { const difference = a - b; return difference; }\n'],
  ]) {
    const repo = path.join(temporary, name);
    await fs.mkdir(repo);
    const git = (...args) => execute('git', args, { cwd: repo });
    await git('init', '-b', 'main');
    await git('config', 'user.email', 'evaluation@example.invalid');
    await git('config', 'user.name', 'Evaluation');
    await fs.writeFile(path.join(repo, 'math.js'), 'export function subtract(a, b) { return a - b; }\n');
    await fs.writeFile(
      path.join(repo, 'AGENTS.md'),
      'Review the subtraction contract. Do not demand scaffolding for this small module.\n',
    );
    await git('add', '.');
    await git('commit', '-m', 'base');
    await git('checkout', '-b', 'change');
    await fs.writeFile(path.join(repo, 'math.js'), implementation);
    await git('add', '.');
    await git('commit', '-m', 'change');
    const started = Date.now();
    const result = await execute(
      process.execPath,
      [
        cli,
        'review',
        '--repo',
        repo,
        '--base',
        'main',
        '--intent',
        'Keep subtract(a, b) returning a minus b for ordinary numeric inputs.',
        '--peer',
        values.peer,
        '--timeout-ms',
        values['timeout-ms'] ?? '180000',
      ],
      { allowFailure: true, timeoutMs: 200_000 },
    );
    const report = result.stdout ? JSON.parse(result.stdout) : null;
    observations.push({
      name,
      peer: values.peer,
      elapsed_ms: Date.now() - started,
      exit_code: result.code,
      status: report?.status ?? 'incomplete',
      report: report?.report ?? null,
      limitations: report?.limitations ?? ['no-report'],
      failures: report?.peers?.filter((peer) => peer.status === 'failed') ?? [],
    });
  }
  console.log(JSON.stringify({ fixture: 'subtraction-v1', observations }, null, 2));
  if (observations.some((item) => item.status !== 'complete')) process.exitCode = 2;
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
