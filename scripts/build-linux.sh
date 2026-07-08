#!/usr/bin/env bash
set -euo pipefail

# Build OmniEmu for Linux
# Usage: ./scripts/build-linux.sh [arch]
#   arch: x64 | arm64 (default: current arch)
# Targets: AppImage, deb

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

ARCH="${1:-$(uname -m)}"
case "$ARCH" in
  x86_64|amd64) ARCH_FLAG="x64" ;;
  aarch64)      ARCH_FLAG="arm64" ;;
  *)            echo "Unknown arch: $ARCH"; exit 1 ;;
esac

echo "==> Installing dependencies..."
npm install

echo "==> Building for Linux ($ARCH_FLAG)..."
npm run build

echo "==> Packaging for Linux ($ARCH_FLAG)..."
# Build AppImage and deb
npx electron-builder --linux --${ARCH_FLAG}

echo "==> Done! Artifacts in ./release/"
