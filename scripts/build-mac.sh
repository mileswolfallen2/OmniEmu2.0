#!/usr/bin/env bash
set -euo pipefail

# Build OmniEmu for macOS
# Usage: ./scripts/build-mac.sh [arch]
#   arch: x64 | arm64 | universal (default: universal)
# Requires: Node.js 20+, npm

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

ARCH="${1:-universal}"

echo "==> Installing dependencies..."
npm install

echo "==> Building..."
npm run build

echo "==> Packaging for macOS ($ARCH)..."
case "$ARCH" in
  universal)
    npx electron-builder --mac --universal
    ;;
  x64)
    npx electron-builder --mac --x64
    ;;
  arm64)
    npx electron-builder --mac --arm64
    ;;
  *)
    echo "Unknown arch: $ARCH (use: x64, arm64, universal)"
    exit 1
    ;;
esac

echo ""
echo "==> Done! Artifacts in ./release/"
ls -lh release/*.dmg release/*.zip 2>/dev/null || true
