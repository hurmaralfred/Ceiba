#!/bin/bash
# ============================================================
# setup-fcm-secrets.sh
# Lee el Service Account JSON de Firebase y configura los
# secrets en Supabase para la Edge Function cron-birthdays-daily.
#
# Uso:
#   bash scripts/setup-fcm-secrets.sh ~/Downloads/ceiba-18f70-*.json
# ============================================================

set -e

JSON_FILE="${1}"

if [ -z "$JSON_FILE" ]; then
  echo "❌ Uso: bash scripts/setup-fcm-secrets.sh <ruta-al-json>"
  echo "   Ejemplo: bash scripts/setup-fcm-secrets.sh ~/Downloads/ceiba-18f70-firebase-adminsdk.json"
  exit 1
fi

if [ ! -f "$JSON_FILE" ]; then
  echo "❌ Archivo no encontrado: $JSON_FILE"
  exit 1
fi

echo "📦 Leyendo $JSON_FILE..."

PROJECT_ID=$(python3 -c "import json,sys; d=json.load(open('$JSON_FILE')); print(d['project_id'])")
CLIENT_EMAIL=$(python3 -c "import json,sys; d=json.load(open('$JSON_FILE')); print(d['client_email'])")
PRIVATE_KEY=$(python3 -c "import json,sys; d=json.load(open('$JSON_FILE')); print(d['private_key'], end='')")

echo "🔑 Project ID:    $PROJECT_ID"
echo "📧 Client Email:  $CLIENT_EMAIL"
echo "🔐 Private Key:   [${#PRIVATE_KEY} chars]"

echo ""
echo "⬆️  Subiendo secrets a Supabase..."

supabase secrets set \
  FCM_PROJECT_ID="$PROJECT_ID" \
  FCM_CLIENT_EMAIL="$CLIENT_EMAIL" \
  FCM_PRIVATE_KEY="$PRIVATE_KEY"

echo ""
echo "✅ Secrets configurados."
echo ""
echo "Siguiente paso — redesplegar la Edge Function:"
echo "  supabase functions deploy cron-birthdays-daily --no-verify-jwt"
