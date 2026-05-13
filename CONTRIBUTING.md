# Contributing

This repository contains one JSSG codemod package per migration step under
`codemods/<slug>/`.

## Local Checks

```bash
pnpm install
pnpm run test
pnpm run check-types
pnpm run ci
```

## Package Shape

Each codemod package should include:

- `package.json`
- `codemod.yaml`
- `workflow.yaml`
- `tsconfig.json`
- `README.md`
- `scripts/codemod.ts`
- `tests/<case>/input.tsx`
- `tests/<case>/expected.tsx`
- `tests/<case>/metrics.json` when the transform records metrics

Keep transformations atomic. If a migration requires a human decision, Datadog
account changes, or Remote Configuration changes, add a detector or issue draft
instead of applying an unsafe rewrite.
