import { execFileSync, execSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/verify-baseline.py');
const TRACKED_INVENTORY = join(
  process.cwd(),
  'openspec/changes/stabilize-project-foundations/baseline-inventory.jsonl',
);
const childEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(GIT|LEFTHOOK)/.test(key)) delete env[key];
  }
  return env;
};
const runGit = (repo: string, ...args: string[]): string =>
  execSync(
    ['git', '-c', 'core.hooksPath=/dev/null', ...args]
      .map((arg) => JSON.stringify(arg))
      .join(' '),
    { cwd: repo, env: childEnv(), encoding: 'utf8' },
  ).toString();
const realGitStatus = (): string =>
  execSync('git status --porcelain', { cwd: process.cwd(), encoding: 'utf8' });
describe('verify-baseline', () => {
  let repos: string[] = [];
  let statusBefore: string;
  beforeAll(() => {
    statusBefore = realGitStatus();
  });
  afterAll(() => {
    expect(realGitStatus()).toBe(statusBefore);
  });
  afterEach(() => {
    for (const repo of repos) rmSync(repo, { recursive: true, force: true });
    repos = [];
  });
  const run = (args: string[], cwd: string) =>
    execFileSync('python3', [SCRIPT, ...args], {
      cwd,
      env: childEnv(),
      encoding: 'utf8',
      stdio: 'pipe',
    });
  const parse = (path: string) =>
    readFileSync(path, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  function createRepo(name = 'minuto') {
    const parent = mkdtempSync(join(tmpdir(), 'baseline-test-'));
    const dir = join(parent, name);
    mkdirSync(dir);
    [
      ['init'],
      ['config', 'user.email', 'test@example.com'],
      ['config', 'user.name', 'Test'],
      ['config', 'core.excludesfile', ''],
    ].forEach((args) => runGit(dir, ...args));
    repos.push(parent);
    return dir;
  }
  function commit(repo: string, path: string, content: string) {
    writeFileSync(join(repo, path), content);
    runGit(repo, 'add', '.');
    runGit(repo, 'commit', '-m', 'commit');
  }
  describe('0.1 verifier rejects invalid states', () => {
    it('rejects running outside a git repository', () => {
      const cwd = mkdtempSync(join(tmpdir(), 'no-repo-'));
      repos.push(cwd);
      expect(() => run([], cwd)).toThrow();
    });
    it('rejects duplicate (path, layer) entries', () => {
      const repo = createRepo();
      commit(repo, 'a.txt', 'hello');
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      const dup = parse(inv).find((r) => r.path === 'a.txt');
      writeFileSync(
        inv,
        `${readFileSync(inv, 'utf8').trim()}\n${JSON.stringify(dup)}\n`,
      );
      expect(() => run(['--gate', '--inventory', inv], repo)).toThrow();
    });
    it('rejects drift between inventory and current state', () => {
      const repo = createRepo();
      commit(repo, 'a.txt', 'hello');
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      writeFileSync(join(repo, 'a.txt'), 'world');
      expect(() => run(['--gate', '--inventory', inv], repo)).toThrow();
    });
    it('distinguishes staged and unstaged changes on the same path', () => {
      const repo = createRepo();
      commit(repo, 'a.txt', 'committed');
      writeFileSync(join(repo, 'a.txt'), 'staged');
      runGit(repo, 'add', 'a.txt');
      writeFileSync(join(repo, 'a.txt'), 'unstaged');
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      const records = parse(inv).filter((r) => r.path === 'a.txt');
      expect(records.length).toBe(2);
      expect(records.map((r) => r.status)).toEqual(
        expect.arrayContaining(['M.', '.M']),
      );
    });
    it('records a deletion as a deletion marker', () => {
      const repo = createRepo();
      commit(repo, 'a.txt', 'hello');
      runGit(repo, 'rm', 'a.txt');
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      const record = parse(inv).find((r) => r.path === 'a.txt');
      expect(record).toBeDefined();
      expect(record.status).toContain('D');
      expect(record.sha256).toBeNull();
    });
    it('records untracked files', () => {
      const repo = createRepo();
      commit(repo, 'a.txt', 'hello');
      writeFileSync(join(repo, 'b.txt'), 'untracked');
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      const record = parse(inv).find((r) => r.path === 'b.txt');
      expect(record).toBeDefined();
      expect(record.layer).toBe('untracked');
    });
  });
  describe('0.2 inventory emission', () => {
    it('emits HEAD commit and tree', () => {
      const repo = createRepo();
      commit(repo, 'initial.txt', 'init');
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      const head = parse(inv).find((r) => r.type === 'head');
      expect(head).toBeDefined();
      expect(head.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(head.tree).toMatch(/^[0-9a-f]{40}$/);
    });
    it('emits SHA-256 for tracked files', () => {
      const repo = createRepo();
      commit(repo, 'a.txt', 'hello');
      writeFileSync(join(repo, 'a.txt'), 'modified');
      runGit(repo, 'add', 'a.txt');
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      const record = parse(inv).find((r) => r.path === 'a.txt');
      expect(record).toBeDefined();
      expect(record.sha256).toMatch(/^[0-9a-f]{64}$/);
    });
    it('emits metadata-only records for .env files without content hash', () => {
      const repo = createRepo();
      commit(repo, 'initial.txt', 'init');
      writeFileSync(join(repo, '.env'), 'SECRET=value');
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      const record = parse(inv).find((r) => r.path === '.env');
      expect(record).toBeDefined();
      expect(record.metadata_only).toBe(true);
      expect(record.sha256).toBeNull();
    });
    it('excludes OpenSpec metadata from inventory entirely', () => {
      const repo = createRepo();
      commit(repo, 'initial.txt', 'init');
      mkdirSync(join(repo, 'openspec/changes/test'), { recursive: true });
      writeFileSync(join(repo, 'openspec/changes/test/spec.md'), '# spec');
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      const records = parse(inv).filter(
        (r) => r.path && r.path.startsWith('openspec/'),
      );
      expect(records.length).toBe(0);
    });
    it('excludes the inventory output path from itself', () => {
      const repo = createRepo();
      commit(repo, 'initial.txt', 'init');
      writeFileSync(join(repo, 'baseline-inventory.jsonl'), '');
      const inv = join(repo, 'baseline-inventory.jsonl');
      run(['--output', inv], repo);
      const records = parse(inv).filter(
        (r) => r.path === 'baseline-inventory.jsonl',
      );
      expect(records.length).toBe(0);
    });
    it('emits chunk hashes for large lockfile-like files', () => {
      const repo = createRepo();
      commit(repo, 'initial.txt', 'init');
      const lines = Array.from({ length: 1000 }, (_, i) => `pkg-${i}:`);
      writeFileSync(join(repo, 'pnpm-lock.yaml'), lines.join('\n'));
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      const record = parse(inv).find((r) => r.path === 'pnpm-lock.yaml');
      expect(record).toBeDefined();
      expect(Array.isArray(record.chunks)).toBe(true);
      expect(record.chunks.length).toBeGreaterThan(1);
    });
    it('captures a deliberately touched lockfile-like file', () => {
      const repo = createRepo();
      commit(repo, 'initial.txt', 'init');
      commit(repo, 'pnpm-lock.yaml', 'lockfileVersion: "6.0"\n');
      writeFileSync(
        join(repo, 'pnpm-lock.yaml'),
        'lockfileVersion: "6.0"\npackages:\n',
      );
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      const record = parse(inv).find((r) => r.path === 'pnpm-lock.yaml');
      expect(record).toBeDefined();
      expect(record.status).toBe('.M');
      expect(record.sha256).toMatch(/^[0-9a-f]{64}$/);
    });
  });
  describe('0.3 hermetic operation', () => {
    it('verifies a clean temp repository without drift', () => {
      const repo = createRepo();
      commit(repo, 'a.txt', 'hello');
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      expect(() => run(['--gate', '--inventory', inv], repo)).not.toThrow();
    });
    it('never mutates the real repository', () => {
      const before = realGitStatus();
      const beforeInventory = readFileSync(TRACKED_INVENTORY);
      const repo = createRepo();
      commit(repo, 'a.txt', 'hello');
      const inv = join(repo, 'inventory.jsonl');
      run(['--output', inv], repo);
      run(['--gate', '--inventory', inv], repo);
      expect(readFileSync(TRACKED_INVENTORY)).toEqual(beforeInventory);
      expect(realGitStatus()).toBe(before);
    });
  });
});
