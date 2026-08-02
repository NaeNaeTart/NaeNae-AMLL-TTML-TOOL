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

Releases are maintainer-only and use stable Semantic Versioning (`X.Y.Z`). Use
the bump type that describes compatibility and functionality, not how many
lines changed:

- **Patch** (`0.7.7` to `0.7.8`): bug fixes, performance fixes, and small
  refinements that do not add a new capability or break existing behavior.
  Several fixes may be grouped into one patch release.
- **Minor** (`0.7.8` to `0.8.0`): new backward-compatible features or
  substantial new capabilities.
- **Major** (`0.8.0` to `1.0.0`): breaking compatibility, or declaring the
  first stable `1.0.0` release.

Do not use letter suffixes such as `0.7.6a`; they are not valid SemVer. SemVer
prerelease forms such as `0.8.0-alpha.1`, `0.8.0-beta.1`, and `0.8.0-rc.1` are
reserved for a future prerelease channel and are not supported by the current
stable release workflow.

### Make a release

Use this exact order for every new version. For example, a fix after `0.7.7`
uses a patch bump to `0.7.8`; a new feature uses a minor bump to `0.8.0`.

1. Preview the bump, then update every version file together:

   ```bash
   pnpm version:bump patch --dry-run
   pnpm version:bump patch
   ```

   Replace `patch` with `minor` or `major` when appropriate. The command
   updates `package.json`, `src-tauri/tauri.conf.json`,
   `src-tauri/Cargo.toml`, and the app entry in `src-tauri/Cargo.lock`.
2. Add a `v0.7.8 Updates` section at the top of
   `src/components/Dialogs/changelog.tsx`. These entries become the GitHub
   Release notes.
3. Run the relevant tests, `pnpm exec biome check <changed files>`, and
   `pnpm run build`.
4. Commit and push the version and changelog changes.
5. Create and push exactly one matching tag:

   ```bash
   git tag -a v0.7.8 -m "Release v0.7.8"
   git push origin v0.7.8
   ```

6. Wait for the **Build desktop app** GitHub Action. It creates the permanent
   GitHub Release, updater manifest, installers, and Winget submission PR.
7. Check that the release has `latest.json` and the Windows x64 `.msi` before
   announcing it.

Never reuse, move, or overwrite an existing release tag. If a release fails,
fix the workflow or source in a new commit and ask a maintainer how to recover
the affected release.

Do not create release tags, change updater signing keys, change updater release
endpoints, or alter Winget publishing secrets/workflows without maintainer
approval. Tagged releases publish immutable GitHub assets; ordinary branch
builds are GitHub Actions artifacts only.

Winget manifests are generated from `winget/package.json` and submitted by CI.
Do not edit generated manifests in the Winget fork by hand.
