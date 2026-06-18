#!/bin/bash
# ─────────────────────────────────────────────────────────────────
#  ExpoUz — Production Deploy Script
#  Usage: ./scripts/deploy.sh [--skip-build]
# ─────────────────────────────────────────────────────────────────
set -e

DOMAIN_API="api.expouz.uz"
DOMAIN_ADMIN="admin.expouz.uz"
DOMAIN_APP="app.expouz.uz"

echo "🚀 ExpoUz Deploy"
echo "─────────────────────"

# ── 1. Check .env exists ─────────────────────────────────────────
if [ ! -f ".env.production" ]; then
  echo "❌  .env.production not found. Copy .env.production.example and fill in secrets."
  exit 1
fi

# ── 2. Pull latest code ──────────────────────────────────────────
echo "📥  Pulling latest code..."
git pull origin main

# ── 3. Build Expo web (Telegram Mini App) ────────────────────────
if [ "$1" != "--skip-build" ]; then
  echo "📦  Building Expo web bundle..."
  cd apps/mobile
  npx expo export --platform web --output-dir ../../dist/app
  cd ../..
  echo "✅  Web bundle built → dist/app/"
fi

# ── 4. Issue / renew SSL certificates ────────────────────────────
echo "🔒  Checking SSL certificates..."
mkdir -p nginx/ssl

for DOMAIN in $DOMAIN_API $DOMAIN_ADMIN $DOMAIN_APP; do
  CERT_PATH="nginx/ssl/live/$DOMAIN/fullchain.pem"
  if [ ! -f "$CERT_PATH" ]; then
    echo "   Issuing cert for $DOMAIN..."
    docker run --rm \
      -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
      -v "$(pwd)/nginx/certbot-webroot:/var/www/certbot" \
      certbot/certbot certonly \
        --webroot -w /var/www/certbot \
        -d "$DOMAIN" \
        --email admin@expouz.uz \
        --agree-tos --non-interactive
  else
    echo "   ✓ Cert exists for $DOMAIN"
  fi
done

# ── 5. Copy Expo build to nginx static dir ────────────────────────
if [ -d "dist/app" ]; then
  echo "📂  Copying web app to nginx static directory..."
  mkdir -p nginx/app
  cp -r dist/app/. nginx/app/
fi

# ── 6. Build and start Docker containers ─────────────────────────
echo "🐳  Building Docker images..."
docker compose -f docker-compose.prod.yml --env-file .env.production build

echo "🟢  Starting services..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# ── 7. Run database migrations ────────────────────────────────────
echo "🗄   Running database migrations..."
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# ── 8. Health check ───────────────────────────────────────────────
echo "🏥  Checking health..."
sleep 5
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN_API/v1/health" || echo "000")
if [ "$HTTP" = "200" ]; then
  echo "✅  API is healthy"
else
  echo "⚠️  API health check returned $HTTP — check logs with: docker compose -f docker-compose.prod.yml logs api"
fi

echo ""
echo "─────────────────────────────────────────────"
echo "✅  Deploy complete!"
echo "   API:       https://$DOMAIN_API"
echo "   Admin:     https://$DOMAIN_ADMIN"
echo "   Mini App:  https://$DOMAIN_APP"
echo ""
echo "📱  To set up the Telegram Mini App:"
echo "   1. Message @BotFather on Telegram"
echo "   2. /newapp → set Web App URL to: https://$DOMAIN_APP"
echo "   3. Add TELEGRAM_BOT_TOKEN to .env.production"
echo "─────────────────────────────────────────────"
