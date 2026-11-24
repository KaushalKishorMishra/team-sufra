#!/usr/bin/env bash
# Puts the five stages online as Cloudflare Pages projects: team-sufra-stage-0 ... team-sufra-stage-4.
# Each stage gets its own database, so resetting one never touches another.
#
#   npx wrangler login                          once, in a browser
#   ANTHROPIC_API_KEY=... scripts/deploy.sh     first time: creates everything and sets the secrets
#   scripts/deploy.sh                           later: rebuilds and redeploys; databases and secrets stay
#
# Without ANTHROPIC_API_KEY the stages run with sample model answers (mock mode).
# The caterer login codes are made on the first run and kept in deploy/logins.txt (not in git).
set -euo pipefail
cd "$(dirname "$0")/.."
W="$PWD/node_modules/.bin/wrangler"   # this folder's wrangler, also from inside build/
mkdir -p deploy

$W whoami >/dev/null 2>&1 || { echo "Run 'npx wrangler login' first."; exit 1; }

# 1. One database per stage, with the tables
for n in 0 1 2 3 4; do
  name="team-sufra-stage-$n"
  $W d1 list --json | grep -q "\"$name\"" || $W d1 create "$name" >/dev/null
done
$W d1 list --json | node -e '
  const all = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const ids = Object.fromEntries(all.filter(d => /^team-sufra-stage-\d$/.test(d.name)).map(d => [d.name, d.uuid || d.id]));
  require("fs").writeFileSync("deploy/databases.json", JSON.stringify(ids, null, 2) + "\n");'
node scripts/build.mjs   # writes each stage's settings with its database id
for n in 0 1 2 3 4; do
  $W d1 execute "team-sufra-stage-$n" -c "build/stage-$n/wrangler.toml" --remote --file=schema.sql --yes >/dev/null
done

# 2. Login codes for the three caterers, made once
if [ ! -f deploy/logins.txt ]; then
  code() { node -e 'console.log(require("crypto").randomBytes(4).toString("hex"))'; }
  echo "huda=$(code),caterer-b=$(code),caterer-c=$(code)" > deploy/logins.txt
  echo "Made deploy/logins.txt with the caterer login codes. Share them only with the presenters."
fi

# 3. For each stage: the project, its secrets, the deploy
for n in 0 1 2 3 4; do
  name="team-sufra-stage-$n"
  $W pages project create "$name" --production-branch main >/dev/null 2>&1 || true
  if [ ! -f "deploy/.secrets-$n" ] || [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    tr -d '\n' < deploy/logins.txt | $W pages secret put CATERER_LOGINS --project-name "$name" >/dev/null
    [ -n "${ANTHROPIC_API_KEY:-}" ] && printf %s "$ANTHROPIC_API_KEY" | $W pages secret put ANTHROPIC_API_KEY --project-name "$name" >/dev/null
    touch "deploy/.secrets-$n"
  fi
  (cd "build/stage-$n" && $W pages deploy --project-name "$name" --branch main --commit-dirty=true)
  echo "Stage $n: https://$name.pages.dev"
done
