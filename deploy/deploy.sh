#!/usr/bin/env bash
# Brings the droplet up to date with the `production` branch and restarts the
# backend API. Run by GitHub Actions on every push to production, or by hand:
#   APP_DIR=/home/ubuntu/cashbook bash /home/ubuntu/cashbook/deploy/deploy.sh
#
# The droplet runs ONLY the backend. The Next.js frontend is hosted on Vercel
# and is never installed, built or started here.
#
# Stops at the first failing step, so a broken install never reloads the
# process that is currently serving the API.
set -euo pipefail

export APP_DIR="${APP_DIR:-/var/www/cashbook}"
export BRANCH="${BRANCH:-production}"

# Non-interactive SSH sessions skip ~/.bashrc, so node/npm/pm2 installed via
# nvm are not on PATH yet. Load nvm if it is there.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
fi

for bin in git node npm pm2; do
  command -v "$bin" >/dev/null || { echo "!! $bin not found on PATH" >&2; exit 1; }
done

cd "$APP_DIR"

echo "==> Fetching $BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# The reset above can replace this very script. Bash keeps running the copy
# it started with, so a fix to deploy.sh would only take effect one deploy
# late. Hand over to the freshly checked-out version, once.
if [ -z "${DEPLOY_SCRIPT_FRESH:-}" ]; then
  export DEPLOY_SCRIPT_FRESH=1
  exec bash "$APP_DIR/deploy/deploy.sh" "$@"
fi

if [ ! -f backend/.env ]; then
  echo "!! backend/.env is missing - create it from backend/.env.example first" >&2
  exit 1
fi

echo "==> Installing backend dependencies"
npm --prefix backend ci --omit=dev

# Older PM2 entries for this app: the API first started by hand as
# `cashbook-backend` (it would fight `cashbook-api` for the same port), and a
# `cashbook-web` left by an earlier attempt to run the frontend here. Only
# these two names are touched; other projects' processes are left alone.
for legacy in cashbook-backend cashbook-web; do
  if pm2 describe "$legacy" >/dev/null 2>&1; then
    echo "==> Removing old PM2 process $legacy"
    pm2 delete "$legacy"
  fi
done

echo "==> Starting / reloading the API"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
pm2 status

echo "==> Deployed $(git rev-parse --short HEAD) from $BRANCH"
