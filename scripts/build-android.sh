#!/bin/bash
# Build Ceiba para Google Play Store
# Uso: ./scripts/build-android.sh
# Requiere: KEYSTORE_PATH, KEYSTORE_PASS, KEY_ALIAS, KEY_PASS en variables de entorno
set -e

echo "▶ 1/3 Build Next.js → www"
npm run build
npx cap copy android

echo "▶ 2/3 Sincronizar Capacitor"
npx cap sync android

echo "▶ 3/3 Build release AAB (Android App Bundle)"
cd android
./gradlew bundleRelease \
  -Pandroid.injected.signing.store.file="${KEYSTORE_PATH}" \
  -Pandroid.injected.signing.store.password="${KEYSTORE_PASS}" \
  -Pandroid.injected.signing.key.alias="${KEY_ALIAS}" \
  -Pandroid.injected.signing.key.password="${KEY_PASS}"
cd ..

AAB="android/app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "✅ AAB listo: $AAB"
echo "   Súbelo a Google Play Console → Producción → Crear nueva versión"
