#!/bin/bash
# Build Ceiba para iOS App Store
# Uso: ./scripts/build-ios.sh
set -e

echo "▶ 1/4 Build Next.js → www"
npm run build
npx cap copy ios

echo "▶ 2/4 Sincronizar Capacitor"
npx cap sync ios

echo "▶ 3/4 Abrir Xcode para archivar"
echo ""
echo "  En Xcode:"
echo "  1. Product → Archive"
echo "  2. Organizer → Distribute App → App Store Connect"
echo "  3. Upload"
echo ""
open -a Xcode ios/App/App.xcworkspace
