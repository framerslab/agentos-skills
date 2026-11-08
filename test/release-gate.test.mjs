// The daily release's gate (.github/scripts/release-gate.mjs): which paths ship, and the decision it makes on a
// real git history, built in a temporary repository. Run: node --test test/release-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { decide, ships } from '../.github/scripts/release-gate.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const config = createRequire(import.meta.url)('../release.config.cjs');

test('the files the package ships count, and the repository-only ones do not', () => {
  for (const path of ['package.json', 'README.md', 'LICENSE', 'CONTRIBUTING.md', 'index.mjs', 'types.d.ts', 'registry.json', 'registry/curated/github/SKILL.md', 'registry/curated/github/example.test.js', 'scripts/validate-skill.mjs']) {
    assert.equal(ships(path, pkg), true, path);
  }
  for (const path of ['.github/workflows/release.yml', '.github/scripts/release-gate.mjs', 'release.config.cjs', 'test/registry.test.mjs', 'logos/frame-logo-green-no-tagline.svg', '.gitignore', 'registryx.json']) {
    assert.equal(ships(path, pkg), false, path);
  }
});

function repository() {
  const cwd = mkdtempSync(join(tmpdir(), 'release-gate-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Gate Test', '-c', 'user.email=gate@example.com', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], { cwd, encoding: 'utf8' }).trim();
  const commit = (message, files) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(cwd, path)), { recursive: true });
      writeFileSync(join(cwd, path), text);
    }
    git('add', '-A');
    git('commit', '--allow-empty', '-q', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'master');
  commit('feat: first release', { 'package.json': JSON.stringify(pkg), 'registry.json': '{}' });
  return { cwd, git, commit, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

test('no commit since the tag: nothing to release', (t) => {
  const repo = repository();
  t.after(repo.cleanup);
  repo.git('tag', 'v0.10.4');
  const result = decide({ cwd: repo.cwd, pkg, config });
  assert.equal(result.releasable, false);
  assert.equal(result.lastTag, 'v0.10.4');
  assert.equal(result.commits, 0);
});

test('a releasing type that changes no shipped file, and a shipped file changed by a type that releases nothing, release nothing', (t) => {
  const repo = repository();
  t.after(repo.cleanup);
  repo.git('tag', 'v0.10.4');
  repo.commit('fix(ci): run the release daily', { '.github/workflows/release.yml': 'on: {}\n' });
  repo.commit('docs: name the release time', { 'README.md': '# readme\n' });
  repo.commit('chore(deps-dev): bump yaml', { 'package.json': JSON.stringify({ ...pkg, devDependencies: {} }) });
  const result = decide({ cwd: repo.cwd, pkg, config });
  assert.equal(result.releasable, false, result.reason);
  assert.equal(result.commits, 3);
});

test('a fix to a shipped skill releases, read from a branch a merge commit brings in', (t) => {
  const repo = repository();
  t.after(repo.cleanup);
  repo.git('tag', 'v0.10.4');
  repo.git('checkout', '-q', '-b', 'fix/skill');
  const fix = repo.commit('fix(registry): say what the skill does', { 'registry/curated/github/SKILL.md': '# github\n' });
  repo.git('checkout', '-q', 'master');
  repo.commit('ci: tidy the workflow', { '.github/workflows/ci.yml': 'on: {}\n' });
  repo.git('-c', 'core.editor=true', 'merge', '--no-ff', '-q', '-m', 'Merge pull request #18 from framerslab/fix/skill', 'fix/skill');
  const result = decide({ cwd: repo.cwd, pkg, config });
  assert.equal(result.releasable, true, result.reason);
  assert.deepEqual(result.releasing.map((c) => [c.sha, c.why, c.files]), [[fix, 'fix(registry)', ['registry/curated/github/SKILL.md']]]);
});

test('the newest release version tag on master is the base, and a tag of another form, a leading zero or a pre-release is not', (t) => {
  const repo = repository();
  t.after(repo.cleanup);
  repo.git('tag', 'v0.9.10');
  repo.commit('feat: add a skill', { 'registry/curated/new/SKILL.md': '# new\n' });
  repo.git('tag', 'v0.10.0');
  repo.commit('chore: tidy', { 'index.mjs': 'export {};\n' });
  repo.git('tag', 'nightly');
  repo.git('tag', 'v01.2.3');
  repo.git('tag', 'v0.11.0-beta.1');
  const result = decide({ cwd: repo.cwd, pkg, config });
  assert.equal(result.lastTag, 'v0.10.0');
  assert.equal(result.releasable, false, result.reason);
});

test('force skips the check, and a history with no release tag releases', (t) => {
  const repo = repository();
  t.after(repo.cleanup);
  assert.equal(decide({ cwd: repo.cwd, pkg, config }).releasable, true);
  repo.git('tag', 'v0.10.4');
  const forced = decide({ cwd: repo.cwd, pkg, config, force: true });
  assert.equal(forced.releasable, true);
  assert.match(forced.reason, /force/);
});
