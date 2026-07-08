#!/usr/bin/env bash
set -euo pipefail

# Cross-platform install script for OmniEmu
# Detects OS/arch and downloads the appropriate artifact from GitHub releases

REPO="mileswolfallen2/OmniEmu2.0"
VERSION="${1:-latest}"

die() {
  echo "Error: $*" >&2
  exit 1
}

detect_platform() {
  local os arch

  case "$(uname -s)" in
    Darwin) os="mac" ;;
    Linux)  os="linux" ;;
    *)      die "Unsupported OS: $(uname -s)" ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)            die "Unsupported arch: $(uname -m)" ;;
  esac

  echo "${os}-${arch}"
}

main() {
  local platform
  platform=$(detect_platform)
  echo "==> Detected platform: $platform"

  echo "==> Downloading OmniEmu for $platform..."
  
  local url
  if [ "$VERSION" = "latest" ]; then
    url="https://github.com/$REPO/releases/latest/download/OmniEmu-${platform}.AppImage"
  else
    url="https://github.com/$REPO/releases/download/v${VERSION}/OmniEmu-${platform}.AppImage"
  fi

  local dest="/tmp/OmniEmu.AppImage"
  curl -fsSL "$url" -o "$dest" || die "Download failed"
  chmod +x "$dest"

  local install_dir="${HOME}/Applications"
  mkdir -p "$install_dir"
  mv "$dest" "${install_dir}/OmniEmu.AppImage"

  echo "==> Installed to ${install_dir}/OmniEmu.AppImage"
  echo "==> Run it with: ${install_dir}/OmniEmu.AppImage"
}

main
