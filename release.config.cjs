// semantic-release's own defaults (the branches, the v${version} tag format and these four plugins) with two
// rules added and the parser taught the `!` marker. A plugins list replaces the default list whole, so the four
// default plugins are named again.
// https://github.com/semantic-release/semantic-release/blob/v25.0.9/lib/get-config.js#L62-L84
//
// No preset is named, so the commit analyzer and the notes generator parse commits with the angular preset,
// as they did with no configuration, and merge parserOpts over its parser options.
// https://github.com/semantic-release/commit-analyzer/blob/v13.0.1/lib/load-parser-config.js#L22-L33
// https://github.com/semantic-release/release-notes-generator/blob/v14.1.1/lib/load-changelog-config.js#L35-L39
// The angular header pattern has no place for a `!` before the colon, so a `feat!:` commit parsed with no type
// and released nothing, though the title check passes the title. parserOpts takes the conventionalcommits
// preset's two patterns: a header pattern that allows the `!`, and a breaking-header pattern that turns a
// `!` header into a BREAKING CHANGE note.
const parserOpts = {
  headerPattern: /^(\w*)(?:\((.*)\))?!?: (.*)$/,
  breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
};

// The commit analyzer decides each commit with the rules below first; only a commit that none of them matches
// goes on to its default rules (feat a minor; fix, perf and a revert a patch; a BREAKING CHANGE note a
// major). A commit that matches a rule here never reaches the defaults, so the default breaking rule is
// repeated: without it, a breaking chore(deps) or revert commit would release a patch.
// https://github.com/semantic-release/commit-analyzer/blob/v13.0.1/index.js#L57-L67
//
// chore(deps) releases a patch, because a dependency bump changes what the package installs.
// chore(deps-dev) and every other chore release nothing.
// revert releases a patch, so a revert written as revert: <what it undoes> publishes as one made by
// git revert does; the default revert rule reads only git revert's "This reverts commit" line.
module.exports = {
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        parserOpts,
        releaseRules: [
          { breaking: true, release: 'major' },
          { type: 'chore', scope: 'deps', release: 'patch' },
          { type: 'revert', release: 'patch' },
        ],
      },
    ],
    ['@semantic-release/release-notes-generator', { parserOpts }],
    '@semantic-release/npm',
    '@semantic-release/github',
  ],
};
