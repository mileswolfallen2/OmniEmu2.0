#!/usr/bin/env bash
set -euo pipefail

# Build OmniEmu for macOS
# Usage: ./scripts/build-mac.sh [arch]
#   arch: x64 | arm64 (default: current arch)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

ARCH="${1:-$(uname -m)}"
case "$ARCH" in
  x86_64) ARCH_FLAG="x64" ;;
  arm64)  ARCH_FLAG="arm64" ;;
  *)      echo "Unknown arch: $ARCH"; exit 1 ;;
esac

echo "==> Installing dependencies..."
npm install

echo "==> Building for macOS ($ARCH_FLAG)..."
npm run build

echo "==> Packaging for macOS ($ARCH_FLAG)..."
npx electron-builder --mac --arm64="$([ "$ARCH_FLAG" = "arm64" ] && echo true || echo false)" --x64="$([ "$ARCH_FLAG" = "x64" ] && echo true || echo false)"

echo "==> Done! Artifacts in ./release/"
