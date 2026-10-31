import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { execute } from '../../skills/hardlook/scripts/process.mjs';

// Opt-in real CLI acceptance, with a deterministic loopback model rather than a live LLM.
const { values } = parseArgs({ options: { 'v1-bin': { type: 'string' }, 'v2-bin': { type: 'string' } } });
if (!values['v1-bin'] && !values['v2-bin']) throw new Error('Provide an explicit --v1-bin or --v2-bin');
const cli = fileURLToPath(new URL('../../skills/hardlook/scripts/hardlook.mjs', import.meta.url));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'hardlook-opencode-native-'));
const report = {
  summary: 'Native transport fixture.',
  risk_level: 'low',
  risk_rationale: 'Disposable fixture.',
  reviewed_paths: ['calc.js'],
  findings: [],
};
const requests = [];
let generationUnderTest;
let phase = 0;
const privateMarker = 'NATIVE_FIXTURE_PRIVATE_CONTENT';
const skillMarker = 'NATIVE_FIXTURE_SKILL_CONTENT';
const server = http.createServer(async (req, res) => {
  let text = '';
  for await (const chunk of req) text += chunk;
  const body = JSON.parse(text);
  const tools = (body.tools ?? []).map((tool) => tool.function?.name ?? tool.name);
  const results = (body.messages ?? []).filter((message) => message.role === 'tool');
  const toolResults = JSON.stringify(results);
  const denied = (id) =>
    results.some(
      (message) =>
        message.tool_call_id === id &&
        /denied|reject|not permitted|rule which prevents/i.test(JSON.stringify(message.content)),
    );
  requests.push({
    model: body.model,
    tools,
    read_received: toolResults.includes('export const calc'),
    private_leaked: toolResults.includes(privateMarker),
    skill_loaded: toolResults.includes(skillMarker),
    private_denied: denied('call-2'),
    skill_denied: denied('call-3'),
  });
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const chunk = {
    id: 'local-fixture',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'fixture',
    choices: [{ index: 0, delta: { role: 'assistant', content: JSON.stringify(report) }, finish_reason: null }],
  };
  let call;
  if (tools.includes('read')) {
    if (phase < 2)
      call = {
        name: 'read',
        args:
          generationUnderTest === 1
            ? { filePath: phase === 0 ? 'calc.js' : 'credentials-fixture.json' }
            : { path: phase === 0 ? 'calc.js' : 'credentials-fixture.json' },
      };
    else if (phase === 2 && tools.includes('skill')) {
      const properties = body.tools.find((tool) => tool.function?.name === 'skill').function.parameters.properties;
      const key = ['id', 'name'].find((name) => Object.hasOwn(properties, name));
      assert.ok(key, 'Recognized skill argument required for native denial test');
      call = { name: 'skill', args: { [key]: 'forbidden-fixture' } };
    }
    phase++;
  }
  if (call)
    chunk.choices[0].delta = {
      role: 'assistant',
      tool_calls: [
        {
          index: 0,
          id: `call-${phase}`,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.args) },
        },
      ],
    };
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  chunk.choices = [{ index: 0, delta: {}, finish_reason: call ? 'tool_calls' : 'stop' }];
  res.end(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseURL = `http://127.0.0.1:${server.address().port}/v1`;
const observations = [];
try {
  const installed = path.join(temporary, 'installed/hardlook');
  await execute(process.execPath, [cli, 'install', '--dest', installed]);
  const relocated = path.join(temporary, 'relocated-hardlook');
  await fs.rename(installed, relocated);
  const installedCLI = path.join(relocated, 'scripts/hardlook.mjs');
  for (const generation of [1, 2]) {
    const binary = values[`v${generation}-bin`];
    if (!binary) continue;
    generationUnderTest = generation;
    phase = 0;
    const dir = path.join(temporary, `v${generation}`);
    const home = path.join(dir, 'home');
    const repo = path.join(dir, 'repo');
    const configDir = path.join(home, '.config/opencode');
    await fs.mkdir(repo, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    const env = {
      PATH: process.env.PATH,
      HOME: home,
      TMPDIR: temporary,
      XDG_CONFIG_HOME: path.join(home, '.config'),
      XDG_DATA_HOME: path.join(home, '.local/share'),
      XDG_STATE_HOME: path.join(home, '.local/state'),
      XDG_CACHE_HOME: path.join(home, '.cache'),
      OPENCODE_CONFIG_DIR: configDir,
      OPENCODE_DISABLE_AUTOUPDATE: '1',
      OPENCODE_DISABLE_MODELS_FETCH: '1',
    };
    const provider =
      generation === 1
        ? {
            enabled_providers: ['local-fixture'],
            provider: {
              'local-fixture': {
                npm: '@ai-sdk/openai-compatible',
                options: { baseURL, apiKey: 'local-fixture-not-a-secret' },
                models: { fixture: { name: 'Fixture', limit: { context: 128000, output: 4096 } } },
              },
            },
          }
        : {
            policies: [
              { action: 'provider.use', resource: '*', effect: 'deny' },
              { action: 'provider.use', resource: 'local-fixture', effect: 'allow' },
            ],
            providers: {
              'local-fixture': {
                package: '@opencode/ai/providers/openai-compatible',
                settings: { baseURL, apiKey: 'local-fixture-not-a-secret' },
                models: {
                  fixture: {
                    name: 'Fixture',
                    limit: { context: 128000, output: 4096 },
                    capabilities: { tools: true },
                    variants: [{ id: 'native' }],
                  },
                },
              },
            },
          };
    await fs.writeFile(path.join(configDir, 'opencode.json'), JSON.stringify(provider));
    const git = (...args) => execute('git', args, { cwd: repo, env });
    await git('init', '-b', 'main');
    await git('config', 'user.email', 'fixture@example.invalid');
    await git('config', 'user.name', 'Fixture');
    await fs.writeFile(path.join(repo, 'calc.js'), 'export const calc = n => n + 1;\n');
    await git('add', '.');
    await git('commit', '-m', 'base');
    await git('checkout', '-b', 'change');
    await fs.writeFile(path.join(repo, 'calc.js'), 'export const calc = n => 1 + n;\n');
    await git('commit', '-am', 'equivalent calculation');
    await fs.writeFile(path.join(repo, 'credentials-fixture.json'), privateMarker);
    await fs.mkdir(path.join(repo, '.opencode/skills/forbidden-fixture'), { recursive: true });
    await fs.writeFile(
      path.join(repo, '.opencode/skills/forbidden-fixture/SKILL.md'),
      `---\nname: forbidden-fixture\ndescription: Local native denial fixture.\n---\n${skillMarker}\n`,
    );
    await fs.writeFile(path.join(repo, '.git/info/exclude'), 'credentials-fixture.json\n.opencode/\n');
    const version = await execute(binary, ['--version'], { env });
    const first = requests.length;
    const result = await execute(
      process.execPath,
      [
        installedCLI,
        'review',
        '--repo',
        repo,
        '--base',
        'main',
        '--intent',
        'Preserve the calculation.',
        '--peer',
        generation === 2 ? 'opencode:local-fixture/fixture#native' : 'opencode:local-fixture/fixture',
        '--binary',
        `opencode=${path.resolve(binary)}`,
        '--timeout-ms',
        '60000',
      ],
      { cwd: repo, env, allowFailure: true, timeoutMs: 70000 },
    );
    const output = result.stdout ? JSON.parse(result.stdout) : null;
    observations.push({
      generation,
      version: version.stdout.trim(),
      exit_code: result.code,
      status: output?.status,
      report: output?.report,
      limitations: output?.limitations,
      failures: output?.peers?.filter((peer) => peer.status === 'failed'),
      requests: requests.slice(first),
    });
    assert.equal(result.code, 0, JSON.stringify(observations.at(-1)));
    assert.equal(output.status, 'complete');
    assert.equal(output.peers[0].harness_generation, generation);
    assert.equal(output.peers[0].harness_version, version.stdout.trim().replace(/^opencode v?/, ''));
    assert.deepEqual(output.report, report);
    assert.ok(requests.length > first, 'The actual CLI must reach the loopback model');
    for (const request of requests.slice(first)) {
      assert.ok(
        request.tools.every((tool) => ['read', 'glob', 'grep', 'list', 'skill'].includes(tool)),
        `Unexpected tool exposed: ${JSON.stringify(request.tools)}`,
      );
      assert.equal(request.private_leaked, false);
      assert.equal(request.skill_loaded, false);
    }
    assert.ok(
      requests.slice(first).some((request) => request.read_received),
      'The native read tool must actually run',
    );
    assert.ok(
      requests.slice(first).some((request) => request.private_denied),
      'The private read must be denied, not merely unavailable',
    );
    if (generation === 2)
      assert.ok(
        requests.slice(first).some((request) => request.skill_denied),
        'The V2 skill load must be denied',
      );
    assert.equal((await git('status', '--porcelain')).stdout, '');
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(temporary, { recursive: true, force: true });
  console.log(JSON.stringify({ fixture: 'opencode-native-loopback-v1', observations }, null, 2));
}
