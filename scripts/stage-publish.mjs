#!/usr/bin/env node
/**
 * Stage every workspace whose current version is not yet on the registry.
 *
 * Why this exists instead of `changeset publish`: changesets shells out to
 * `npm publish`, which a staging-only trusted publisher refuses (npm gates the
 * two separately via `npm trust --allow-publish` / `--allow-stage-publish`).
 * `npm stage publish` puts the tarball in the registry in a state that is NOT
 * publicly installable until a human approves it with 2FA.
 *
 * Deliberate choices:
 *  - Topological order. There is no atomic multi-package publish, so a
 *    dependency must reach the registry before its dependents.
 *  - Only HTTP 404 counts as "not published". Any other registry error aborts,
 *    so an outage cannot be misread as a pending release.
 *  - Runs `npm stage publish` with cwd set to the package directory. npm's own
 *    docs say the `stage` command "is unaware of workspaces", so we do not rely
 *    on `-w`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "packages");

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: "pipe", ...opts });

// ---- discover workspaces ---------------------------------------------------
const workspaces = readdirSync(pkgDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => {
    const dir = join(pkgDir, d.name);
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    return { dir, name: manifest.name, version: manifest.version, manifest };
  })
  .filter((w) => w.manifest.private !== true);

const names = new Set(workspaces.map((w) => w.name));

// ---- topological sort over intra-monorepo dependencies ---------------------
const deps = (w) =>
  Object.keys({ ...w.manifest.dependencies, ...w.manifest.peerDependencies })
    .filter((d) => names.has(d));

const ordered = [];
const state = new Map();
const visit = (w) => {
  const s = state.get(w.name);
  if (s === "done") return;
  if (s === "visiting") throw new Error(`dependency cycle at ${w.name}`);
  state.set(w.name, "visiting");
  for (const d of deps(w)) visit(workspaces.find((x) => x.name === d));
  state.set(w.name, "done");
  ordered.push(w);
};
workspaces.forEach(visit);

console.log("publish order:", ordered.map((w) => w.name).join(" -> "));

// ---- which versions are missing from the registry? -------------------------
const isPublished = ({ name, version }) => {
  try {
    run("npm", ["view", `${name}@${version}`, "version"]);
    return true;
  } catch (err) {
    const text = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    if (/E404|404 Not Found|code E404/.test(text)) return false;
    throw new Error(
      `cannot determine publish state of ${name}@${version} — refusing to ` +
        `guess. Registry said:\n${text}`,
    );
  }
};

const pending = ordered.filter((w) => {
  const published = isPublished(w);
  console.log(`  ${w.name}@${w.version}: ${published ? "already published" : "NEEDS STAGING"}`);
  return !published;
});

if (pending.length === 0) {
  console.log("nothing to stage.");
  process.exit(0);
}

// ---- stage, in order -------------------------------------------------------
for (const w of pending) {
  console.log(`\n=== npm stage publish ${w.name}@${w.version} ===`);
  try {
    // access comes from each package's publishConfig.access; stream npm's
    // output so a failure is readable in the job log instead of swallowed.
    execFileSync("npm", ["stage", "publish", "--tag", "latest"], {
      cwd: w.dir,
      stdio: "inherit",
    });
  } catch {
    console.error(
      `\nstaging failed for ${w.name}@${w.version}. Earlier packages in the ` +
        `order may already be staged — inspect with \`npm stage list\` and ` +
        `\`npm stage reject <stage-id>\` before re-running, since a version ` +
        `that exists as a stage cannot be re-staged or published.`,
    );
    process.exit(1);
  }
}

// ---- surface the stage ids for the human -----------------------------------
// `npm stage publish` has no --json; `npm stage list` does.
let staged = [];
try {
  const listed = JSON.parse(run("npm", ["stage", "list", "--json"]));
  staged = Array.isArray(listed) ? listed : (listed.staged ?? listed.versions ?? []);
} catch (err) {
  console.error("could not parse `npm stage list --json`:", err.message);
}

const lines = [
  "## Staged — awaiting human approval",
  "",
  "These versions are in the registry but **not installable** until approved.",
  "`npm stage approve` requires interactive 2FA and cannot be run by CI:",
  'npm docs — *"Shortlived tokens cannot run `npm stage` subcommands."*',
  "",
  "Approve in this order (dependencies first):",
  "",
  "```bash",
  ...pending.map((w) => `# ${w.name}@${w.version}`),
  "npm stage list            # get the stage ids",
  "npm stage view <stage-id> # inspect before approving",
  "npm stage approve <stage-id>",
  "```",
  "",
];

if (staged.length) {
  lines.push("<details><summary>npm stage list --json</summary>", "", "```json", JSON.stringify(staged, null, 2), "```", "</details>");
}

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) appendFileSync(summary, lines.join("\n") + "\n");
console.log("\n" + lines.join("\n"));
