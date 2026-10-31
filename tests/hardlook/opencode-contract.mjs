import assert from 'node:assert/strict';

// Independent oracle: V1 permission maps and V2 last-match ordered rules from
// https://opencode.ai/docs/permissions/ and https://opencode.ai/v2/docs/permissions.
const matches = (pattern, value) =>
  new RegExp(
    `^${pattern
      .split('*')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`,
  ).test(value);

export function checkOpenCodeContract(config, args, generation) {
  assert.equal(args.includes('--standalone'), generation === 2);
  for (const flag of ['--auto', '--session', '--continue', '--fork', '--attach', '--server']) {
    assert.equal(args.includes(flag), false);
  }
  assert.equal(config.formatter, false);
  const agent = (generation === 1 ? config.agent : config.agents)['hardlook-peer'];
  assert.equal(agent.mode, 'primary');
  if (generation === 1) assert.equal(config.snapshot, false);
  else {
    assert.equal(config.snapshots, false);
    for (const key of ['agent', 'snapshot']) assert.equal(Object.hasOwn(config, key), false);
    for (const key of ['permission', 'prompt', 'tools']) assert.equal(Object.hasOwn(agent, key), false);
  }
  const effect = (action, resource) => {
    if (generation === 1) {
      const rule = agent.permission[action] ?? agent.permission['*'];
      if (typeof rule === 'string') return rule;
      return Object.entries(rule)
        .filter(([pattern]) => matches(pattern, resource))
        .at(-1)?.[1];
    }
    return agent.permissions.filter((rule) => matches(rule.action, action) && matches(rule.resource, resource)).at(-1)
      ?.effect;
  };
  for (const action of ['read', 'glob', 'grep']) assert.equal(effect(action, 'src/calc.js'), 'allow');
  for (const action of [
    'edit',
    'write',
    'patch',
    'bash',
    'shell',
    'task',
    'subagent',
    'execute',
    'question',
    'skill',
    'webfetch',
    'websearch',
    'arbitrary_mcp_tool',
    'external_directory',
  ]) {
    assert.equal(effect(action, '*'), 'deny', action);
  }
  for (const file of [
    '.env',
    '.env.secret',
    'config/.env.production',
    'auth.json',
    'credentials.json',
    '.netrc',
    '.npmrc',
    'home/.aws/config',
    'tokens.json',
    'key.pem',
    'key.key',
  ]) {
    assert.equal(effect('read', file), 'deny', file);
  }
}
