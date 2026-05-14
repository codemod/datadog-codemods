# Datadog Codemods

Official codemods for Datadog SDKs, built by the community and approved by the Datadog team.

First set of codemods: [`dd-trace-js`](https://github.com/DataDog/dd-trace-js) 5.x → 6.x per the [migration guide](https://github.com/DataDog/dd-trace-js/blob/master/MIGRATING.md#50-to-60-unreleased).

Datadog ships across runtimes and major versions; breaking API and config moves
can be tedious and risky at scale. This repo hosts Codemod packages that handle
the mechanical parts of those upgrades while staying conservative where humans,
Datadog accounts, or Remote Configuration must decide.

See the [Codemod docs](https://docs.codemod.com) for more on building and
running codemods.

Every codemod is a standalone Codemod package under `codemods/` (see [Repository
layout](#repository-layout)). Each package owns its metadata, workflow,
implementation, README, and fixtures.

## Repository layout

Directories are grouped **by product**, then **stack / language**, then the
**library or tracer**, then the **destination major** you are migrating toward
(for example `v6`). Everything under that folder targets the same major line.
Under that leaf, each folder is one Codemod package.

Conceptually:

```
codemods/
  apm/
    nodejs/
      dd-trace-js/
        v6/                         # see v6 README for packages and CLI names
          ...
```

## Usage

Run codemods with the [Codemod CLI](https://docs.codemod.com/cli):

```bash
npx codemod <codemod-name> --target <path>
```

Browse published names and migration specifics in the README next to each
destination-major folder—for example [dd-trace-js 5.x → 6.x](./codemods/apm/nodejs/dd-trace-js/v6/README.md).

Quick start for the orchestrated dd-trace-js 5→6 workflow:

```bash
npx codemod @codemod/dd-trace-js-v6-migration-recipe --target <path>
```

Packages are listed in the [Codemod Registry](https://app.codemod.com/registry).

## Development

Codemods here are written as [JSSG](https://docs.codemod.com/jssg) TypeScript
transforms over ast-grep ASTs. See the JSSG docs for the full API surface.

```bash
pnpm install
pnpm run format
pnpm run lint
pnpm run test
pnpm run check-types
pnpm run ci
```

Run one workspace package (the `pnpm --filter` value is the `name` field in that
package's `package.json`):

```bash
pnpm --filter <package-name> test
pnpm --filter <package-name> check-types
```

Run a JSSG transform directly while developing (paths depend on the package):

```bash
pnpm dlx codemod@latest jssg run --language tsx --allow-dirty \
  --target samples/dd-trace-v5-app/src/tracing.ts \
  codemods/apm/nodejs/dd-trace-js/v6/add-link-object-argument/scripts/codemod.ts
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). If you are using an AI coding agent, start with [AGENTS.md](./AGENTS.md).
