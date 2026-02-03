#!/usr/bin/env bash
set -euo pipefail

# Publish package to npm with version bump
# Usage: ./scripts/publish.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

cd "$PROJECT_DIR"

# Get current version
CURRENT_VERSION=$(grep -E '^version = ' pixi.toml | sed 's/version = "\(.*\)"/\1/')

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Publish to npm                            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Current version:${NC} $CURRENT_VERSION"
echo ""

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}Warning: You have uncommitted changes:${NC}"
    git status --short
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Aborted.${NC}"
        exit 1
    fi
fi

# Ask for version bump type
echo -e "${CYAN}Select version bump type:${NC}"
echo "  1) patch  (${CURRENT_VERSION} -> $(./scripts/bump-version.sh patch 2>/dev/null | grep "New version" | awk '{print $3}' || echo "x.x.x"))"
echo "  2) minor  (${CURRENT_VERSION} -> $(./scripts/bump-version.sh minor 2>/dev/null | grep "New version" | awk '{print $3}' || echo "x.x.x"))"
echo "  3) major  (${CURRENT_VERSION} -> $(./scripts/bump-version.sh major 2>/dev/null | grep "New version" | awk '{print $3}' || echo "x.x.x"))"
echo "  4) cancel"
echo ""

# Revert any changes from the preview
git checkout pixi.toml package.json 2>/dev/null || true

read -p "Enter choice [1-4]: " -n 1 -r CHOICE
echo ""

case $CHOICE in
    1)
        BUMP_TYPE="patch"
        ;;
    2)
        BUMP_TYPE="minor"
        ;;
    3)
        BUMP_TYPE="major"
        ;;
    4|*)
        echo -e "${YELLOW}Publish cancelled.${NC}"
        exit 0
        ;;
esac

echo ""
echo -e "${GREEN}▶ Bumping version (${BUMP_TYPE})...${NC}"
./scripts/bump-version.sh "$BUMP_TYPE"

# Get new version
NEW_VERSION=$(grep -E '^version = ' pixi.toml | sed 's/version = "\(.*\)"/\1/')

echo ""
echo -e "${GREEN}▶ Building package...${NC}"
pixi run build

echo ""
echo -e "${GREEN}▶ Running tests...${NC}"
pixi run test-unit

echo ""
echo -e "${GREEN}▶ Committing changes...${NC}"
git add pixi.toml package.json
git commit -m "Bump version to $NEW_VERSION"

echo ""
echo -e "${GREEN}▶ Creating git tag v${NEW_VERSION}...${NC}"
git tag "v${NEW_VERSION}"

echo ""
echo -e "${GREEN}▶ Pushing to remote...${NC}"
git push
git push --tags

echo ""
echo -e "${GREEN}▶ Publishing to npm...${NC}"
npm publish

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Published successfully!                   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Version:${NC} $NEW_VERSION"
echo -e "${GREEN}Tag:${NC}     v$NEW_VERSION"
echo -e "${GREEN}npm:${NC}     https://www.npmjs.com/package/tauri-driver-cli"
