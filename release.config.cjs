// semantic-release's own defaults (the branches, the v${version} tag format and these four plugins) with one
// rule added. A plugins list replaces the default list whole, so the four default plugins are named again.
// https://github.com/semantic-release/semantic-release/blob/v25.0.9/lib/get-config.js#L62-L84
//
// No preset is named, so the commit analyzer parses commits with the angular preset, as it did with no
// configuration. https://github.com/semantic-release/commit-analyzer/blob/v13.0.1/lib/load-parser-config.js#L22-L31
// It decides each commit with the rules below first; only a commit that none of them matches goes on to its
// default rules (feat a minor; fix, perf and a revert a patch; a BREAKING CHANGE note a major). A commit that
// matches a rule here never reaches the defaults, so the default breaking rule is repeated: without it, a
// chore(deps) commit with a BREAKING CHANGE note would release a patch.
// https://github.com/semantic-release/commit-analyzer/blob/v13.0.1/index.js#L57-L67
//
// chore(deps) releases a patch, because a dependency bump changes what the package installs.
// chore(deps-dev) and every other chore release nothing.
module.exports = {
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        releaseRules: [
          { breaking: true, release: 'major' },
          { type: 'chore', scope: 'deps', release: 'patch' },
        ],
      },
    ],
    '@semantic-release/release-notes-generator',
    '@semantic-release/npm',
    '@semantic-release/github',
  ],
};
