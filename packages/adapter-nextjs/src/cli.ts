#!/usr/bin/env node
/**
 * Present so the POC exercises a package with a `bin` — the shape a customer
 * invokes as `npx @scope/poc-adapter-nextjs`. Verifies that the published
 * tarball keeps the bin wired and the shebang intact.
 */
import { build } from "./index.js";

const manifest = build();
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
