import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

const activeExecutions = new Set();
let cancelling = false;

export function cancelExecutions() {
  cancelling = true;
  for (const stop of activeExecutions) stop('cancelled');
}

export class ProcessFailure extends Error {
  constructor(kind, code = null, diagnosis = null) {
    super(kind);
    this.kind = kind;
    this.code = code;
    this.diagnosis = diagnosis;
  }
}

// Diagnostics intentionally do not include prompts, argv, stdout, or stderr.
export function execute(
  binary,
  args,
  { cwd, env = process.env, input = '', timeoutMs = 300_000, maxBytes = 4 * 1024 * 1024, allowFailure = false } = {},
) {
  return new Promise((resolve, reject) => {
    if (cancelling) {
      reject(new ProcessFailure('cancelled'));
      return;
    }
    const child = spawn(binary, args, {
      cwd,
      env,
      shell: false,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let bytes = 0;
    let finished = false;
    let settling = false;
    let failure;
    const decoder = new StringDecoder('utf8');
    const kill = (signal) => {
      try {
        if (process.platform === 'win32') child.kill(signal);
        else if (child.pid) process.kill(-child.pid, signal);
        else return false;
        return true;
      } catch {
        return false;
      }
    };
    let cleanupPromise;
    const cleanup = () => {
      if (cleanupPromise) return cleanupPromise;
      cleanupPromise = kill('SIGTERM')
        ? new Promise((done) => {
            // Referenced and awaited: the caller cannot exit before escalation.
            setTimeout(() => {
              kill('SIGKILL');
              done();
            }, 200);
          })
        : Promise.resolve();
      return cleanupPromise;
    };
    const settle = async (code) => {
      if (finished || settling) return;
      settling = true;
      clearTimeout(deadline);
      clearTimeout(backstop);
      await cleanup();
      finished = true;
      activeExecutions.delete(stop);
      if (failure) reject(failure);
      else if (code !== 0 && !allowFailure) reject(new ProcessFailure('process-exit', code, diagnose(stdout + stderr)));
      else resolve({ stdout: stdout + decoder.end(), code });
    };
    let backstop;
    const stop = (reason) => {
      if (failure || finished) return;
      failure = new ProcessFailure(reason);
      cleanup();
      if (!settling)
        backstop = setTimeout(() => {
          kill('SIGKILL');
          child.stdout.destroy();
          child.stderr.destroy();
          child.stdin.destroy();
          settle(null);
        }, 300);
    };
    const deadline = setTimeout(() => stop('timeout'), timeoutMs);
    activeExecutions.add(stop);
    for (const [stream, capture] of [
      [child.stdout, true],
      [child.stderr, false],
    ]) {
      stream.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > maxBytes) stop('output-limit');
        else if (capture && !failure) stdout += decoder.write(chunk);
        else if (!capture && !failure) stderr += chunk.toString('utf8');
      });
    }
    child.stdin.on('error', () => {});
    child.on('error', (error) => {
      failure = new ProcessFailure(error.code === 'ENOENT' ? 'missing-cli' : 'process-start');
      settle(null);
    });
    child.on('close', settle);
    child.on('exit', cleanup);
    child.stdin.end(input);
  });
}

function diagnose(text) {
  if (/invalid api key|not logged in|authentication failed|login required/i.test(text))
    return 'harness-reported-credential-rejection';
  if (/unknown option|unrecognized (?:option|argument)|unexpected argument/i.test(text))
    return 'unsupported-cli-interface';
  if (/model.*(?:not found|not available)|unknown model/i.test(text)) return 'model-unavailable';
  if (/rate.limit|throttl|\b429\b/i.test(text)) return 'throttled';
  if (/ECONNREFUSED|ENOTFOUND|connection refused/i.test(text)) return 'connection-failed';
  return null;
}
