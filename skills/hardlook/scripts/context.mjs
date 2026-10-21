import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execute } from './process.mjs';

// eslint-disable-next-line no-control-regex -- Untrusted paths must reject literal C0 control bytes.
const invalidPathCharacters = /[\x00-\x1f]/;
// eslint-disable-next-line no-control-regex -- Git refs additionally reject the ASCII space character.
const invalidRefCharacters = /[\x00-\x20]/;

export function privatePath(file) {
  return (
    file
      .split(/[\\/]/)
      .some((part) =>
        /^(?:\.env(?:\..*)?|\.git|\.ssh|\.aws|\.git-credentials|\.netrc|\.npmrc|\.?credentials(?:\.(?:json|ya?ml|toml|ini))?|auth\.(?:json|ya?ml|toml)|tokens\.json|oauth_creds\.json)$/i.test(
          part,
        ),
      ) || /\.(?:pem|key|p12|pfx)$/i.test(file)
  );
}

export function repoPath(file) {
  if (
    typeof file !== 'string' ||
    !file ||
    path.isAbsolute(file) ||
    invalidPathCharacters.test(file) ||
    file.includes('\\') ||
    file.split('/').some((part) => ['..', '.', ''].includes(part))
  ) {
    throw new Error('invalid repository-relative path');
  }
  if (privatePath(file)) throw new Error('private path excluded from review');
  return file;
}

async function git(repo, args, allowFailure = false, maxBytes = 2 * 1024 * 1024) {
  return execute('git', ['--no-pager', '--literal-pathspecs', ...args], {
    cwd: repo,
    allowFailure,
    maxBytes,
    timeoutMs: 15_000,
  });
}

export async function packet({ repo, scope = 'branch', base, intent, include = [], maxBytes = 512 * 1024 }) {
  if (!['branch', 'staged', 'uncommitted'].includes(scope)) throw new Error('invalid scope');
  if (!intent?.trim()) throw new Error('intent is required');
  repo = (await git(path.resolve(repo), ['rev-parse', '--show-toplevel'])).stdout.trim();
  const head = (await git(repo, ['rev-parse', '--verify', 'HEAD^{commit}'])).stdout.trim();
  const status = (await git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])).stdout;
  if ((await git(repo, ['ls-files', '--unmerged', '-z'])).stdout) {
    throw new Error('unresolved index entries; resolve and stage conflicts before review');
  }
  let baseSHA = null;
  let revisions;
  if (scope === 'branch') {
    if (!base) {
      const remote = await git(repo, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'], true);
      if (remote.code === 0) base = remote.stdout.trim();
      else throw new Error('branch review requires --base when origin/HEAD is unavailable');
    }
    if (base.startsWith('-') || invalidRefCharacters.test(base)) throw new Error('invalid base ref');
    const ref = (await git(repo, ['rev-parse', '--verify', `${base}^{commit}`])).stdout.trim();
    baseSHA = (await git(repo, ['merge-base', ref, head])).stdout.trim();
    // Native peers inspect the checkout too; avoid mixing HEAD and dirty code.
    if (status.split('\0').some((record) => record && !record.startsWith('?? '))) {
      throw new Error('branch review requires a clean tracked worktree; use staged or uncommitted scope');
    }
    revisions = [`${baseSHA}..${head}`];
  } else revisions = scope === 'staged' ? ['--cached'] : [head];
  const rawPaths = (
    await git(repo, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', ...revisions])
  ).stdout;
  const allPaths = rawPaths.split('\0').filter(Boolean);
  const excluded = allPaths.filter(privatePath);
  const changedPaths = allPaths.filter((file) => !privatePath(file)).map(repoPath);
  if (changedPaths.some((file) => excluded.some((secret) => secret.startsWith(`${file}/`)))) {
    throw new Error('selected path has an excluded descendant; narrow the review scope');
  }
  const includePaths = [...new Set(include.map(repoPath))];
  const deletedPaths = new Set(
    (
      await git(repo, [
        'diff',
        '--no-ext-diff',
        '--no-textconv',
        '--no-renames',
        '--diff-filter=D',
        '--name-only',
        '-z',
        ...revisions,
      ])
    ).stdout
      .split('\0')
      .filter(Boolean),
  );
  const files = [];
  const diff = changedPaths.length
    ? (
        await git(
          repo,
          ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', ...revisions, '--', ...changedPaths],
          false,
          maxBytes,
        )
      ).stdout
    : '';
  for (const file of [...new Set([...changedPaths, ...includePaths])]) {
    let content = null;
    if (scope === 'uncommitted') {
      const absolute = path.join(repo, file);
      try {
        const stat = await fs.lstat(absolute);
        if (!stat.isFile() || stat.size > maxBytes) throw new Error('unsupported or oversized context file');
        // realpath protects a symlink in any parent directory.
        const real = await fs.realpath(absolute);
        if (!real.startsWith(`${await fs.realpath(repo)}${path.sep}`))
          throw new Error('context path escaped repository');
        if (privatePath(path.relative(repo, real))) throw new Error('private context target excluded');
        content = await fs.readFile(real, 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (!deletedPaths.has(file)) throw new Error('context file unavailable', { cause: error });
      }
    } else {
      const metadata = await git(
        repo,
        scope === 'staged' ? ['ls-files', '--stage', '-z', '--', file] : ['ls-tree', '-z', head, '--', file],
      );
      const entry = metadata.stdout.split('\0').find((record) => record.slice(record.indexOf('\t') + 1) === file);
      const mode = entry?.split(' ')[0];
      if (!entry || mode === '040000') {
        if (!deletedPaths.has(file)) throw new Error('context file unavailable');
        files.push({ path: file, content: null });
        continue;
      }
      if (!['100644', '100755', '120000'].includes(mode)) throw new Error('unsupported context entry');
      const revision = scope === 'staged' ? `:0:${file}` : `${head}:${file}`;
      content = (await git(repo, ['show', revision], false, maxBytes)).stdout;
    }
    files.push({ path: file, content });
  }
  const instructions = [];
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const blob = await git(repo, ['show', `${head}:${file}`], true, maxBytes);
    if (blob.code === 0) instructions.push({ path: file, content: blob.stdout });
  }
  const data = {
    scope,
    head,
    base: baseSHA,
    intent,
    changed_paths: changedPaths,
    excluded_paths: excluded,
    files,
    instructions,
    diff,
  };
  const encoded = JSON.stringify(data);
  if (Buffer.byteLength(encoded) > maxBytes)
    throw new Error('context limit exceeded; narrow the change or raise --max-bytes');
  const identity = createHash('sha256').update(encoded).update(status).digest('hex');
  return { repo, identity, ...data };
}
