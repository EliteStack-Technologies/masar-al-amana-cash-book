#!/usr/bin/env bash
# Brings the droplet up to date with the `production` branch and restarts the
# app. Run by GitHub Actions on every push to production, or by hand:
#   APP_DIR=/var/www/cashbook WEB_PORT=3000 bash /var/www/cashbook/deploy/deploy.sh
#
# Stops at the first failing step, so a broken install or build never reloads
# the processes that are currently serving the site.
set -euo pipefail

export APP_DIR="${APP_DIR:-/var/www/cashbook}"
export BRANCH="${BRANCH:-production}"
export WEB_PORT="${WEB_PORT:-3000}"

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

if [ ! -f backend/.env ]; then
  echo "!! backend/.env is missing - create it from backend/.env.example first" >&2
  exit 1
fi
if [ ! -f frontend/.env.production.local ]; then
  echo "!! frontend/.env.production.local is missing - it must set NEXT_PUBLIC_API_URL" >&2
  exit 1
fi

echo "==> Installing backend dependencies"
npm --prefix backend ci --omit=dev

echo "==> Installing frontend dependencies"
npm --prefix frontend ci

echo "==> Building frontend"
npm --prefix frontend run build

echo "==> Starting / reloading apps (web on port $WEB_PORT)"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
pm2 status

echo "==> Deployed $(git rev-parse --short HEAD) from $BRANCH"
