# @codemod/dd-trace-js-v6-rename-b3-style

## 0.3.0

### Minor Changes

- ece9d42: Publish all dd-trace-js 5→6 codemods under the **`@codemod`** scope using **`@codemod/dd-trace-js-v6-<slug>`** (SDK + **destination** major **v6** + codemod slug). Update docs, workflow sources, and workspace `pnpm` filters to match. Fix recipe metadata test to satisfy lint. Use **`dd-trace-js`** (not `dd-trace`) in `codemod.yaml` registry keywords for discoverability. Add **`apm`**, **`nodejs`**, and **`v6`** to each package's `codemod.yaml` `keywords` list.

## 0.2.0

### Minor Changes

- 22320b0: Bump all dd-trace-js 5→6 codemods to **0.2.0** so they can be republished to the Codemod Registry after prior versions were unpublished. Release automation will run `version-packages` on merge.

## 0.1.3

### Patch Changes

- c3d8421: Bump `@jssg/utils` dependency range to `^0.0.7`.
- c3d8421: Point `codemod.yaml` repository metadata at the monorepo root and align the migration recipe `package.json` with other codemod packages (public, matching dependency blocks).
