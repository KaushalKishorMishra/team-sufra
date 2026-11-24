// Builds the five live stages as Cloudflare Pages projects, one folder each:
//   build/stage-N/wrangler.toml   project name, its own database, STAGE=N
//   build/stage-N/public/         the site, plus _worker.js (the whole program in one file)
// Every stage runs the same code; only STAGE changes what is switched on (src/stage.js).
// Database ids come from deploy/databases.json, which scripts/deploy.sh writes.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const ids = existsSync(root + "deploy/databases.json") ? JSON.parse(readFileSync(root + "deploy/databases.json", "utf8")) : {};

rmSync(root + "build", { recursive: true, force: true });
// wrangler bundles the program exactly as it would for a Worker, without deploying anything
execFileSync("npx", ["wrangler", "deploy", "--dry-run", "--outdir", root + "build/bundle"], { cwd: root, stdio: "ignore" });
const worker = root + "build/bundle/worker.js";

for (let n = 0; n <= 4; n++) {
  const dir = `${root}build/stage-${n}`, name = `team-sufra-stage-${n}`;
  mkdirSync(dir + "/public", { recursive: true });
  cpSync(root + "site", dir + "/public", { recursive: true });
  cpSync(worker, dir + "/public/_worker.js");
  // wrangler reads the settings of the nearest package folder, so each stage is its own
  writeFileSync(dir + "/package.json", JSON.stringify({ name: name, private: true }) + "\n");
  // The program answers /api/* only; Pages serves the pages directly
  writeFileSync(dir + "/public/_routes.json", JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }));
  writeFileSync(dir + "/wrangler.toml", `name = "${name}"
pages_build_output_dir = "public"
compatibility_date = "2026-10-01"

[[d1_databases]]
binding = "DB"
database_name = "${name}"
database_id = "${ids[name] || "00000000-0000-0000-0000-000000000000"}"

[vars]
STAGE = "${n}"
MODEL = "claude-haiku-5-5"
EFFORT = "low"
DAILY_LIMIT = "200"
DAILY_BUDGET_USD = "5"
`);
}
rmSync(root + "build/bundle", { recursive: true });
console.log("Built build/stage-0 to build/stage-4" + (Object.keys(ids).length ? "" : " (no database ids yet: run scripts/deploy.sh to create them)"));
