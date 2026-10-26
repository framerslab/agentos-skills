// Runs the commit analyzer on release.config.cjs, one commit since the last release per case, and checks the
// release it decides. release.yml runs semantic-release 25.0.9, whose range for the analyzer (^13.0.1) is the
// devDependency here. Run: node --test test/release-rules.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { analyzeCommits } from '@semantic-release/commit-analyzer';

const releaseConfig = createRequire(import.meta.url)('../release.config.cjs');
const [, analyzerConfig] = releaseConfig.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === '@semantic-release/commit-analyzer'
);
const cwd = fileURLToPath(new URL('..', import.meta.url));

const cases = [
  ['feat: add my-skill community skill', 'minor'],
  ['fix(registry): categories names the skills\' categories', 'patch'],
  ['perf: read registry.json once', 'patch'],
  ['chore(deps): bump yaml from 2.8.1 to 2.8.2', 'patch'],
  ['chore(deps-dev): bump vitest from 1.6.0 to 1.6.1', null],
  ['chore: tidy the skill index', null],
  ['ci: refuse a pull request title outside the Conventional Commits form', null],
  ['docs: name the title check in CONTRIBUTING.md', null],
  ['revert: drop the 1human motion-reference skill', 'patch'],
  ['Revert "feat: add my-skill community skill"\n\nThis reverts commit 0123456789abcdef0123456789abcdef01234567.', 'patch'],
  // The title check passes `!` before the colon, so the release reads it as a breaking change.
  ['feat!: rename the registry.json skill fields', 'major'],
  ['feat(registry)!: drop the stats block', 'major'],
  ['chore(deps)!: require Node 22', 'major'],
  ['chore(deps): bump @framers/agentos to 0.16.0\n\nBREAKING CHANGE: hosts on @framers/agentos 0.15 must upgrade.', 'major'],
  // A merge commit's subject has no type, and its body's line is not read as one: the branch's own commits
  // decide the release.
  ['Merge pull request #15 from framerslab/fix/registry-categories\n\nfix(registry): categories names the skills\' categories', null],
  ['Land two idle pull requests in one batch', null],
];

for (const [message, release] of cases) {
  test(`${message.split('\n')[0]} releases ${release}`, async () => {
    const decided = await analyzeCommits(analyzerConfig, {
      cwd,
      commits: [{ hash: 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0', message }],
      logger: { log() {} },
    });
    assert.equal(decided, release);
  });
}
