# Contributing

Thanks for helping improve Datadog codemods.

Using an AI coding agent (Codex, Cursor, Claude Code, Aider, etc.)? See [`AGENTS.md`](./AGENTS.md) — it is a short pointer back to this file and the common mistakes to avoid.

## Development setup

This repository uses **pnpm** (see `packageManager` in the root `package.json`), **Changesets** for releases, and **oxfmt + oxlint** (not Prettier/ESLint) for formatting and linting.

```bash
# Install dependencies (also wires the Husky pre-commit hook)
pnpm install

# Format all files
pnpm run format

# Check formatting without writing
pnpm run format:check

# Lint all files (includes type checking for discovered TS projects)
pnpm run lint

# Lint and auto-fix
pnpm run lint:fix

# Run all codemod package tests (dd-trace-* workspace packages)
pnpm run test

# Typecheck all codemod packages
pnpm run check-types

# Same checks as the push job on main (tests + typecheck)
pnpm run ci
```

Run one workspace package (the `pnpm --filter` value is the `name` field in that package’s `package.json`):

```bash
pnpm --filter <package-name> test
pnpm --filter <package-name> check-types
```

Use Node **20** locally (see [`.nvmrc`](./.nvmrc)) to match CI.

## Pre-commit hook

After `pnpm install`, Husky runs **lint-staged** before each commit: oxfmt and oxlint on staged files, plus targeted `pnpm test` when you touch `codemods/**/scripts/*.ts`. If something fails, fix or stage the updates and try again.

The hook only inspects **staged** files. Files you did not touch can still fail a full-repo `pnpm run format:check` / `pnpm run lint` — CI focuses on **changed** paths for pull requests.

## CI

- **Pull requests to `main`:** `.github/workflows/ci.yml` installs with `pnpm install --frozen-lockfile`, runs **oxfmt** / **oxlint** on changed files, runs **test** and **check-types** only for codemod packages touched by the diff, and enforces **changesets** (see below).
- **Pushes to `main`:** the same workflow runs full-workspace `pnpm run ci` (all `dd-trace-*` tests and typechecks).

Match that locally before you push.

## Making changes

1. Create a branch from `main`.
2. Make your changes and add or update JSSG fixtures under `tests/<case>/`.
3. Run `pnpm run format`, `pnpm run lint`, and `pnpm run ci` to verify everything passes.
4. Add a changeset when you change a codemod package (see below).
5. Open a pull request.

## Adding a changeset

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning and releases. **Every PR that changes a codemod package under `codemods/` should include a changeset**, unless you use the `skip-changeset` label (see CI). Details live in [`.changeset/README.md`](./.changeset/README.md).

```bash
pnpm changeset
```

Follow the prompts:

1. Select the affected codemod(s).
2. Choose the semver bump — **patch** for fixes, **minor** for new features, **major** for breaking changes.
3. Write a short summary.

Commit the new markdown file under `.changeset/` with your PR.

`pnpm run version-packages` (run by automation on `main`, not usually by hand) runs `changeset version` and then [`scripts/sync-codemod-versions.sh`](./scripts/sync-codemod-versions.sh) so **`codemod.yaml` `version` stays aligned with `package.json`.** Do not edit `version` in `codemod.yaml` by hand to cut a release.

## Release workflow

1. Merge a PR that includes one or more changesets into `main`.
2. [`.github/workflows/release.yml`](./.github/workflows/release.yml) consumes changesets, commits **Version Packages** to `main`, syncs `codemod.yaml` versions, creates **`name@vversion`** git tags for newly versioned packages, and publishes those packages with [`codemod/publish-action`](https://github.com/codemod-com/publish-action).

Do not hand-edit the `version` field in package `package.json` or `codemod.yaml` to “simulate” a release — automation owns bumps. The **Publish Codemod (Manual)** workflow ([`.github/workflows/publish.yml`](./.github/workflows/publish.yml)) is for emergencies: supply the path **under** `codemods/`, e.g. `apm/nodejs/dd-trace-js/v6/add-link-object-argument`.

## Adding a new codemod

New packages live under the layout in [README.md](./README.md#repository-layout), for example:

```
codemods/<product>/<stack>/<library>/<migration>/<slug>/
  scripts/codemod.ts   # JSSG transform
  tests/               # input / expected fixtures (and metrics.json when needed)
  codemod.yaml         # manifest (version is synced from package.json on release)
  workflow.yaml
  package.json
  tsconfig.json
  README.md
```

Conventions:

- Prefer the existing naming pattern for dd-trace-js 5→6 packages: `dd-trace-5-to-6-<slug>` in `package.json` / `codemod.yaml`.
- Keep rewrites conservative. If a step needs a human decision, Datadog account work, or Remote Configuration, prefer a detector, recipe parameter, or issue draft instead of an unsafe transform.

Use an existing sibling codemod in the same migration folder as a template.

## Package shape

Each codemod package should include:

- `package.json` with at least `test` and `check-types`.
- `codemod.yaml`, `workflow.yaml`, `tsconfig.json`, `README.md`
- `scripts/codemod.ts`
- `tests/<case>/input.*` and `tests/<case>/expected.*`
- `tests/<case>/metrics.json` when the transform records metrics

Keep transformations atomic and verifiable with fixtures.
