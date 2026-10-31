// Checks what the skills tell a model it may write at each content tier, against the hard bans that hold at
// every tier. Run: node --test test/skill-content.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every SKILL.md under registry/curated and registry/community, indexed or not, with its lines. */
function readSkills() {
  const skills = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const folder = join(dir, entry.name);
      const file = join(folder, 'SKILL.md');
      if (existsSync(file)) {
        skills.push({ path: relative(root, file), lines: readFileSync(file, 'utf8').split('\n') });
      } else {
        walk(folder);
      }
    }
  };
  for (const source of ['curated', 'community']) {
    const dir = join(root, 'registry', source);
    if (existsSync(dir)) walk(dir);
  }
  return skills;
}

const skills = readSkills();

/** The lines of every skill that match `pattern`, each with its file and line number. */
const linesMatching = (pattern) =>
  skills.flatMap((skill) =>
    skill.lines.flatMap((line, i) => (pattern.test(line) ? [{ where: `${skill.path}:${i + 1}`, line }] : [])),
  );

// A list item that defines a content tier, as in "- **private-adult:** ...".
const TIER_LINE = /^\s*[-*]\s*\*\*(safe|standard|mature|private-adult)(\*\*)?\s*:/i;
const PRIVATE_ADULT_LINE = /^\s*[-*]\s*\*\*private-adult(\*\*)?\s*:/i;
// The list item that names the hard bans, as in "- **Hard bans (ALL tiers):** ...".
const HARD_BANS_LINE = /^\s*[-*]\s*\*\*hard bans?\b/i;

// The categories banned at every tier, in the order the acceptable use policy lists them. The sixth category
// is checked in its three parts.
const BANNED_CATEGORIES = [
  ['sexual content involving minors or characters presented as minors', /\bminors\b[^;]*\bpresented as minors\b/i],
  ['non-consensual sexual content', /\bnon-consensual sexual\b/i],
  ['incest', /\bincest\b/i],
  ['bestiality', /\bbestiality\b/i],
  ['trafficking', /\btrafficking\b/i],
  ['sexual violence', /\bsexual violence\b/i],
  ['necrophilia', /\bnecrophilia\b/i],
  ['non-consensual mutilation', /\bnon-consensual mutilation\b/i],
  ['sexual content about real, identifiable people', /\breal, identifiable people\b/i],
  [
    'actionable instructions for real-world violence, terrorism, weapons or other serious crime',
    /\bactionable instructions\b[^;]*\bviolence\b[^;]*\bterrorism\b[^;]*\bweapons\b[^;]*\bserious crime\b/i,
  ],
  ['other illegal content', /\bother illegal content\b/i],
];

// Words that put a tier past the hard bans. Banned content is named on the hard-bans line alone, so a tier
// line never mentions taboo or non-consensual content, not even to rule it out.
const LIFTS_THE_LIMITS = /\bno limits\b|\bwithout limits\b|\bunrestricted\b|\banything goes\b|\btaboo\b|\bnon-?consen/i;

test('every hard-bans line names the nine categories banned at every tier', () => {
  const lines = linesMatching(HARD_BANS_LINE);
  assert.ok(lines.length > 0, 'no skill names its hard bans');
  for (const { where, line } of lines) {
    for (const [category, pattern] of BANNED_CATEGORIES) {
      assert.match(line, pattern, `${where} leaves out ${category}`);
    }
  }
});

test('no tier line lifts the limits past the hard bans', () => {
  const lines = linesMatching(TIER_LINE);
  assert.ok(lines.length > 0, 'no skill defines its content tiers');
  for (const { where, line } of lines) {
    assert.doesNotMatch(line, LIFTS_THE_LIMITS, `${where} lifts the limits: ${line.trim()}`);
  }
});

test('private-adult is sexual content between consenting adults, under the hard bans', () => {
  const lines = linesMatching(PRIVATE_ADULT_LINE);
  assert.ok(lines.length > 0, 'no skill defines the private-adult tier');
  for (const { where, line } of lines) {
    assert.match(line, /\bbetween consenting adults\b/i, `${where} does not limit private-adult to consenting adults`);
    assert.match(line, /\bhard bans\b/i, `${where} does not say the hard bans apply`);
  }
});
