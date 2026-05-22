#!/usr/bin/env bash
set -euo pipefail

# Gellop Tables — deploy.sh
# Single command to bootstrap or update the app on any Linux VPS / Raspberry Pi.
# Requires: docker, docker compose plugin.
# Tested on: Ubuntu 22.04+, Raspberry Pi OS (Bookworm), Debian 12.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Colour helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
err()   { echo -e "${RED}[✗]${NC} $*" >&2; }

# ── Pre-flight checks ────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  err "Docker not found. Install it first, e.g.:"
  err "  curl -fsSL https://get.docker.com | sh"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  err "docker compose plugin not found (install docker-compose-plugin)."
  exit 1
fi

# ── Generate secrets if missing ──────────────────────────────────────────────
if [ ! -f backend/.env ]; then
  warn "backend/.env not found — generating from template…"
  JWT_SECRET="$(openssl rand -hex 32)"
  DB_PASS="$(openssl rand -base64 18 | tr '+/' '-_')"
  sed -e "s/change…tion/$JWT_SECRET/g" \
      -e "s/clayite_pass/$DB_PASS/g" \
      -e "s/localhost:5432/db:5432/g" \
      -e "s/localhost:6379/redis:6379/g" \
      -e "s/localhost:5173/frontend:5173/g" \
      backend/.env.example > backend/.env
  info "backend/.env created"

  # Update docker-compose.yml with the generated DB password
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/POSTGRES_PASSWORD: .*/POSTGRES_PASSWORD: $DB_PASS/" docker-compose.yml
  else
    sed -i "s/POSTGRES_PASSWORD: .*/POSTGRES_PASSWORD: $DB_PASS/" docker-compose.yml
  fi
  info "docker-compose.yml updated with DB password"
else
  info "backend/.env already exists — keeping it"
fi

# ── Pull latest images ──────────────────────────────────────────────────────
echo ""
info "Building images (this may take a few minutes on first run)…"
docker compose build 2>&1 | tail -3

# ── Start services ──────────────────────────────────────────────────────────
echo ""
info "Starting services…"
docker compose up -d 2>&1

echo ""
info "Waiting for database to be healthy…"
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U clayite &>/dev/null; then
    info "Database is ready"
    break
  fi
  sleep 1
done

echo ""
info "Waiting for backend to start…"
for i in $(seq 1 15); do
  if docker compose exec -T app curl -sf http://localhost:3000/health &>/dev/null; then
    info "Backend is healthy"
    break
  fi
  sleep 1
done

# ── Print summary ──────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
info "Gellop Tables is running!"
echo ""
echo "  Frontend:  http://$(hostname -I | awk '{print $1}'):5173"
echo "  Backend:   http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "  Quick commands:"
echo "    docker compose logs -f app    # follow backend logs"
echo "    docker compose logs -f frontend  # follow frontend logs"
echo "    make logs                     # shortcut"
echo "══════════════════════════════════════════════════════"

# ── Optional: create first admin user ──────────────────────────────────────
if ! docker compose exec -T app curl -sf http://localhost:3000/api/auth/me &>/dev/null; then
  echo ""
  warn "No admin user found. Register one at:"
  echo "  http://$(hostname -I | awk '{print $1}'):5173/register"
fi
