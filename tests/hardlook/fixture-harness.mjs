#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { validateStrictSchema, validateSchemaValue } from './strict-schema.mjs';
import { checkOpenCodeContract } from './opencode-contract.mjs';

const harness = path.basename(process.argv[1]);
const args = process.argv.slice(2);
if (args.includes('--version')) {
  const versionPath = path.join(path.dirname(process.argv[1]), 'opencode-version.txt');
  console.log(
    harness === 'opencode'
      ? fs.existsSync(versionPath)
        ? fs.readFileSync(versionPath, 'utf8')
        : '2.2.5'
      : 'fixture 1.2.3',
  );
  process.exit(0);
}
if (harness === 'opencode') {
  const versionPath = path.join(path.dirname(process.argv[1]), 'opencode-version.txt');
  const version = fs.existsSync(versionPath) ? fs.readFileSync(versionPath, 'utf8') : '2.2.5';
  const generation = Number(version.match(/\d+/)[0]);
  fs.appendFileSync(path.join(path.dirname(process.argv[1]), 'opencode-invocations'), 'run\n');
  checkOpenCodeContract(JSON.parse(process.env.OPENCODE_CONFIG_CONTENT), args, generation);
  if (generation === 2 && process.env.PWD) process.chdir(process.env.PWD);
}
const outputSchema =
  harness === 'codex' ? JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema') + 1], 'utf8')) : null;
if (outputSchema) validateStrictSchema(outputSchema);
let input = '';
for await (const chunk of process.stdin) input += chunk;
if (harness === 'cursor') input = args.at(-1);
const modelIndex = Math.max(args.indexOf('--model'), args.indexOf('-m'));
const model = modelIndex < 0 ? 'valid' : args[modelIndex + 1];
// Emulate the native shared-state lock, not the runner's scheduling implementation.
let stateLock;
if (model.startsWith('shared-state-')) {
  stateLock = path.join(path.dirname(process.argv[1]), 'native-state.lock');
  fs.closeSync(fs.openSync(stateLock, 'wx'));
  await new Promise((resolve) => setTimeout(resolve, 200));
}
const start = input.indexOf('REVIEW_PACKET\n') + 'REVIEW_PACKET\n'.length;
const end = input.indexOf('\nEND_REVIEW_PACKET', start);
const packet = JSON.parse(input.slice(start, end));
if (process.env.HARDLOOK_TEST_TRACE)
  fs.writeFileSync(
    path.join(process.env.HARDLOOK_TEST_TRACE, `${process.pid}.json`),
    JSON.stringify({
      harness,
      args,
      context: createHash('sha256').update(JSON.stringify(packet)).digest('hex'),
      lead: input.includes('INDEPENDENT_REPORTS'),
      pid: process.pid,
      cwd: process.cwd(),
      pwd: process.env.PWD,
    }),
  );
if (model === 'timeout') await new Promise((resolve) => setTimeout(resolve, 60_000));
if (model === 'process-hold') {
  const descendant = spawn(process.execPath, [process.env.HARDLOOK_TEST_PROCESS_FIXTURE, 'descendant'], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  await new Promise((resolve) => descendant.on('message', resolve));
  fs.writeFileSync(
    process.env.HARDLOOK_TEST_PROCESS_RECORD,
    JSON.stringify({ leader: process.pid, descendant: descendant.pid }),
  );
  await new Promise(() => {});
}
if (model === 'exit') {
  console.error('credential-looking-private-error');
  process.exit(9);
}
if (model === 'invalid') {
  console.log('not a structured report');
  process.exit(0);
}
if (model === 'mutate') fs.appendFileSync('calc.js', '\n// unexpected mutation\n');
const report = {
  summary: 'Fixture review.',
  risk_level: 'low',
  risk_rationale: 'Controlled adapter fixture.',
  reviewed_paths: model === 'partial' ? [] : packet.changed_paths,
  findings: [],
};
if (model === 'valid#high') report.summary = 'Variant selector arrived unchanged.';
if (model === 'supporting-read') report.summary = fs.readFileSync('supporting.txt', 'utf8');
if (model === 'finding' || model === 'null-reproduction' || model.startsWith('repro-'))
  report.findings.push({
    file: packet.changed_paths[0],
    line: 1,
    severity: 'error',
    judgment: 'act-on',
    evidence: 'Input 0 produces an incorrect result.',
    consequence: 'The calculation fails.',
    suggestion: 'Correct the changed calculation.',
    action: 'auto-fix',
  });
if (model.startsWith('repro-')) {
  const notRun = model === 'repro-not-run';
  report.findings[0].reproduction = {
    status: notRun ? 'not-run' : 'reported-unverified',
    command: process.env.HARDLOOK_TEST_REPRO_COMMAND ?? 'node calc.js',
    expected: '1\n',
    observed: notRun ? null : '2\n',
  };
  if (model === 'repro-tampered' && input.includes('INDEPENDENT_REPORTS')) {
    report.findings[0].reproduction.observed = '3\n';
  }
  if (model === 'repro-tampered-command' && input.includes('INDEPENDENT_REPORTS')) {
    report.findings[0].reproduction.command = 'node different.js';
  }
  if (model === 'repro-tampered-expected' && input.includes('INDEPENDENT_REPORTS')) {
    report.findings[0].reproduction.expected = '0\n';
  }
  if (model === 'repro-tampered-file' && input.includes('INDEPENDENT_REPORTS')) {
    report.findings[0].file = 'other.js';
  }
  if (model === 'repro-peer-command') report.findings[0].reproduction.command = 'node different.js';
  if (model === 'repro-peer-expected') report.findings[0].reproduction.expected = '0\n';
  if (model === 'repro-verified') report.findings[0].reproduction.status = 'verified';
  if (model === 'repro-missing-output') report.findings[0].reproduction.observed = null;
  if (model === 'repro-inconsistent') report.findings[0].reproduction.status = 'not-run';
  if (model === 'repro-empty') report.findings[0].reproduction.observed = '';
}
if (model === 'null-reproduction') report.findings[0].reproduction = null;
if (outputSchema) {
  for (const finding of report.findings) {
    if (!Object.hasOwn(finding, 'reproduction')) finding.reproduction = null;
  }
  validateSchemaValue(report, outputSchema);
}
if (stateLock) fs.unlinkSync(stateLock);
if (harness === 'opencode') console.log(JSON.stringify({ type: 'text', part: { text: JSON.stringify(report) } }));
else if (harness === 'claude-code') console.log(JSON.stringify({ type: 'result', structured_output: report }));
else if (harness === 'codex')
  console.log(
    JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(report) } }),
  );
else if (harness === 'cursor') console.log(JSON.stringify({ type: 'result', result: JSON.stringify(report) }));
else if (harness === 'pi')
  console.log(
    JSON.stringify({
      type: 'agent_end',
      messages: [{ role: 'assistant', content: [{ type: 'text', text: JSON.stringify(report) }] }],
    }),
  );
