# Contributing to AMLL TTML Tool

Thanks for helping. Keep changes focused, tested, and easy to review.

## Setup

Use Node.js LTS, pnpm, and Rust/Cargo for desktop work. pnpm is mandatory;
do not use npm or Yarn.

```bash
pnpm install
pnpm dev          # web app
pnpm tauri dev    # desktop app
```

Run a production build before opening a PR that changes UI, dependencies,
configuration, or Tauri code:

```bash
pnpm run build
```

## Project layout

- `src/components` contains shared UI.
- `src/modules` contains feature-specific UI and logic.
- `src/states` contains shared Jotai atoms.
- `src-tauri` contains the Rust/Tauri desktop app.
- `locales` contains Crowdin-managed translations.

Keep feature-local state in its module. Put state shared by unrelated features
in `src/states`.

## Code, tests, and translations

- Add or update focused Vitest coverage for non-trivial behavior changes.
- Check only the files you changed before committing:

  ```bash
  pnpm exec biome check <changed files>
  ```

- Do not run a broad formatter over unrelated files. Do not hand-edit
  `pnpm-lock.yaml`.
- Use the existing i18next pattern for new user-facing strings when practical.
  Translation updates are managed through Crowdin; do not make bulk locale
  rewrites unless the change requires them.

## Pull requests

Use a focused branch and explain what changed, why, and how you tested it.
Include screenshots for visual changes and clear reproduction steps for bug
fixes. Do not mix refactors with unrelated feature work.

Every user-visible feature or fix needs an entry in
`src/components/Dialogs/changelog.tsx`. Keep entries ordered by user impact:
features first, then fixes. A release tag should have a matching heading such
as `v0.7.4 Updates`; GitHub Release notes are generated from that section.

## Releases and distribution

Releases are maintainer-only. A stable release starts by updating the version
in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`, then
creating a matching tag such as `v0.7.4`.

Do not create release tags, change updater signing keys, change updater release
endpoints, or alter Winget publishing secrets/workflows without maintainer
approval. Tagged releases publish immutable GitHub assets; ordinary branch
builds are GitHub Actions artifacts only.

Winget manifests are generated from `winget/package.json` and submitted by CI.
Do not edit generated manifests in the Winget fork by hand.
