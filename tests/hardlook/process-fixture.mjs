import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { execute } from '../../skills/hardlook/scripts/process.mjs';

const self = fileURLToPath(import.meta.url);
const [role, record, hold] = process.argv.slice(2);
if (role === 'descendant') {
  process.on('SIGTERM', () => {});
  process.send?.('ready');
  setInterval(() => {}, 1000);
} else if (role === 'leader') {
  const descendant = spawn(process.execPath, [self, 'descendant'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  descendant.on('message', () => {
    fs.writeFileSync(record, JSON.stringify({ leader: process.pid, descendant: descendant.pid }));
    if (hold) setInterval(() => {}, 1000);
    else process.exit(0);
  });
} else {
  // Import dynamically: this executable also tests CLI-style cancellation.
  const module = await import('../../skills/hardlook/scripts/process.mjs');
  process.on('SIGTERM', () => module.cancelExecutions?.());
  try {
    await execute(process.execPath, [self, 'leader', record, ...(hold ? ['hold'] : [])], { timeoutMs: 30_000 });
  } catch (error) { console.error(error.kind); process.exitCode = 2; }
}
