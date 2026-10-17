import fs from 'node:fs/promises';

export const schema = JSON.parse(await fs.readFile(new URL('../schemas/report.json', import.meta.url), 'utf8'));
const pipelineSchema = JSON.parse(await fs.readFile(new URL('../schemas/no-mistakes-v1.84.json', import.meta.url), 'utf8'));

function validate(value, rule, location = 'report') {
  const types = Array.isArray(rule.type) ? rule.type : [rule.type];
  const type = value === null ? 'null' : Array.isArray(value) ? 'array'
    : typeof value === 'number' && Number.isInteger(value) ? 'integer' : typeof value;
  if (!types.includes(type)) throw new Error(`${location}: invalid type`);
  if (rule.enum && !rule.enum.includes(value)) throw new Error(`${location}: invalid value`);
  if (type === 'string' && value.trim().length < (rule.minLength ?? 0)) throw new Error(`${location}: empty text`);
  if (type === 'integer' && value < (rule.minimum ?? -Infinity)) throw new Error(`${location}: below minimum`);
  if (type === 'array') value.forEach((item, i) => validate(item, rule.items, `${location}[${i}]`));
  if (type === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error(`${location}: invalid object`);
    for (const key of rule.required ?? []) {
      if (!Object.hasOwn(value, key)) throw new Error(`${location}: missing ${key}`);
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(rule.properties ?? {}, key)) {
        if (rule.additionalProperties === false) throw new Error(`${location}: unknown field`);
        continue;
      }
      validate(value[key], rule.properties[key], `${location}.${key}`);
    }
  }
}

export function validateReport(report, paths) {
  validate(report, schema);
  const allowed = new Set(paths);
  const reviewed = new Set(report.reviewed_paths);
  if (reviewed.size !== report.reviewed_paths.length) throw new Error('duplicate reviewed path');
  for (const path of [...reviewed, ...report.findings.map((item) => item.file)]) {
    if (!allowed.has(path)) throw new Error('finding or coverage outside changed scope');
  }
  return report;
}

export function covered(report, paths) {
  const reviewed = new Set(report.reviewed_paths);
  return paths.every((path) => reviewed.has(path));
}

function jsonText(text) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, ''));
}

// Only final assistant/result records are candidates, not reasoning/tool output.
export function decodeReport(output) {
  let direct;
  try { direct = JSON.parse(output); } catch {}
  if (direct?.findings) return direct;
  const records = direct ? [direct] : output.split(/\r?\n/).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  let candidate;
  for (const record of records) {
    if (record.is_error || record.type === 'error' || record.type === 'turn.failed') {
      throw new Error('harness reported an error');
    }
    if (record.structured_output) candidate = record.structured_output;
    else if (record.type === 'result' && typeof record.result === 'string') candidate = record.result;
    else if (record.type === 'result' && record.result?.findings) candidate = record.result;
    else if (record.type === 'text' && typeof record.part?.text === 'string') candidate = record.part.text;
    else if (record.type === 'item.completed' && record.item?.type === 'agent_message') candidate = record.item.text;
    else if (record.type === 'agent_end') {
      const last = record.messages?.filter((message) => message.role === 'assistant').at(-1);
      if (last) candidate = last.content?.filter((part) => part.type === 'text').map((part) => part.text).join('');
    }
  }
  if (candidate === undefined) throw new Error('no final structured report');
  return typeof candidate === 'string' ? jsonText(candidate) : candidate;
}

export function pipelineReport(result) {
  if (result.status !== 'complete') throw new Error('incomplete review cannot emit pipeline approval');
  const report = result.report;
  const output = {
    summary: report.summary,
    risk_level: report.risk_level,
    risk_rationale: report.risk_rationale,
    risk_scope: 'source-or-external',
    reviewed_paths: report.reviewed_paths,
    findings: report.findings.filter((item) => !['dismissed', 'noted'].includes(item.judgment)).map((item, i) => ({
      id: `H${i + 1}`, severity: item.severity, file: item.file,
      ...(item.line === null ? {} : { line: item.line }),
      action: item.action, source: 'hardlook', review_scope: 'source',
      description: `Evidence: ${item.evidence}\nConsequence: ${item.consequence}\nSuggested fix: ${item.suggestion}`,
    })),
  };
  validate(output, pipelineSchema, 'no-mistakes');
  return output;
}
