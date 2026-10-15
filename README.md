# adapter-release-poc

Throwaway fixture for proving out a GitHub → npm release pipeline before wiring
a real one. **Nothing here is a working adapter** — the packages exist only to
give the release machinery something realistic to move.

An npm-workspaces monorepo with publishable scoped packages and a real
intra-monorepo dependency edge, so the release has to respect topological
publish order.

| Workspace | Published as | Why it's here |
| --- | --- | --- |
| `packages/deployment-spec` | `@viraldam/poc-deployment-spec` | Shared types. The dependency everything else needs first. |
| `packages/adapter-astro` | `@viraldam/poc-adapter-astro` | Default + named export, two export subpaths. |
| `packages/adapter-nextjs` | `@viraldam/poc-adapter-nextjs` | Has a `bin`, for the `npx @scope/pkg` shape. |

## Release model

CI stages, a human approves. There is no npm token anywhere in this repo —
`.github/workflows/release.yml` authenticates by exchanging the GitHub Actions
OIDC token for a short-lived, package-scoped credential (npm "trusted
publishing"), which also attaches provenance automatically.

```
changeset  ->  version PR  ->  merge  ->  npm stage publish  ->  npm stage approve
  (human)       (bot)         (human)         (CI, no 2FA)          (human, 2FA)
```

Approval is a human step by construction, not by convention: npm's shortlived
OIDC tokens cannot run `npm stage` subcommands at all.

```bash
npm run changeset        # describe a change
npm run build            # build all workspaces in dependency order
./verify.sh <pkg> <before-version> <after-version>   # prove a publish came from CI
```

This README is deliberately thin because the repo is disposable.
