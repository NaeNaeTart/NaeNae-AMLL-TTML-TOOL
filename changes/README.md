# Change notes
Add one `changes/<short-slug>.md` per user-visible PR.
Start with these three frontmatter fields between `---` lines:
`type: feature` or `type: fix`
`impact: 1` through `impact: 5` (5 is biggest)
`highlight: true` or `highlight: false` (true also appears in What's New)
After the closing `---`, write a short user-facing title on one line.
Optional: a blank line, then one or two sentences using **bold**, `code`, or [links](https://example.com).
Release: `pnpm changelog:compile --version X.Y.Z --summary "Short summary"` (preview with `--dry-run`).
Compilation sorts features then fixes by descending impact, rotates colors, and deletes compiled notes; then bump, release commit, and tag.
