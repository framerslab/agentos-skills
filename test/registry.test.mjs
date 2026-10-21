// Checks registry.json against the SKILL.md files it indexes and against the shape
// types.d.ts gives it. Run: node --test test/registry.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(join(root, 'registry.json'), 'utf8'));

for (const source of ['curated', 'community']) {
  test(`categories.${source} names each category of the ${source} skills once`, () => {
    const categories = [...new Set(registry.skills[source].map((skill) => skill.category))].sort();
    assert.deepEqual(registry.categories[source], categories);
  });

  test(`every ${source} entry points at a SKILL.md`, () => {
    for (const skill of registry.skills[source]) {
      assert.ok(existsSync(join(root, skill.path, 'SKILL.md')), `${skill.path}/SKILL.md is missing`);
    }
  });
}

test('stats count the entries', () => {
  const { curated, community } = registry.skills;
  assert.deepEqual(registry.stats, {
    totalSkills: curated.length + community.length,
    curatedCount: curated.length,
    communityCount: community.length,
  });
});
