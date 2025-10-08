#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

if [ ! -d "node_modules" ]; then
  npm install
else
  npm install --no-audit --no-fund
fi

if [ "${RUN_DB_MIGRATIONS:-false}" = "true" ]; then
  npm run db:migrate
fi

npm run lint
npm run test
npm run test:e2e
npm run build

echo "Setup complete. Build artifacts available in dist/"
