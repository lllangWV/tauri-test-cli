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

# ============================================================================
# STEP 1: Run tests and build BEFORE bumping version
# ============================================================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}▶ Step 1: Running pre-publish checks...${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}Running unit tests...${NC}"
if ! pixi run test-unit; then
    echo -e "${RED}Tests failed! Aborting publish.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tests passed${NC}"
echo ""

echo -e "${BLUE}Building package...${NC}"
if ! pixi run build; then
    echo -e "${RED}Build failed! Aborting publish.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# ============================================================================
# STEP 2: Ask for version bump type
# ============================================================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}▶ Step 2: Select version bump...${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Calculate preview versions
IFS='.' read -r major minor patch <<< "$CURRENT_VERSION"
PATCH_VERSION="${major}.${minor}.$((patch + 1))"
MINOR_VERSION="${major}.$((minor + 1)).0"
MAJOR_VERSION="$((major + 1)).0.0"

echo -e "${CYAN}Select version bump type:${NC}"
echo "  1) patch  (${CURRENT_VERSION} -> ${PATCH_VERSION})"
echo "  2) minor  (${CURRENT_VERSION} -> ${MINOR_VERSION})"
echo "  3) major  (${CURRENT_VERSION} -> ${MAJOR_VERSION})"
echo "  4) cancel"
echo ""

read -p "Enter choice [1-4]: " -n 1 -r CHOICE
echo ""

case $CHOICE in
    1)
        BUMP_TYPE="patch"
        NEW_VERSION="$PATCH_VERSION"
        ;;
    2)
        BUMP_TYPE="minor"
        NEW_VERSION="$MINOR_VERSION"
        ;;
    3)
        BUMP_TYPE="major"
        NEW_VERSION="$MAJOR_VERSION"
        ;;
    4|*)
        echo -e "${YELLOW}Publish cancelled.${NC}"
        exit 0
        ;;
esac

echo ""

# ============================================================================
# STEP 3: Bump version
# ============================================================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}▶ Step 3: Bumping version to ${NEW_VERSION}...${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

./scripts/bump-version.sh "$BUMP_TYPE"

# ============================================================================
# STEP 4: Commit, tag, and push to GitHub
# ============================================================================

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}▶ Step 4: Pushing to GitHub...${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}Committing changes...${NC}"
git add pixi.toml package.json .claude-plugin/plugin.json
git commit -m "Bump version to $NEW_VERSION"

echo -e "${BLUE}Creating git tag v${NEW_VERSION}...${NC}"
git tag "v${NEW_VERSION}"

echo -e "${BLUE}Pushing to remote...${NC}"
git push
git push --tags

echo -e "${GREEN}✓ Pushed to GitHub${NC}"

# ============================================================================
# STEP 5: Final build for publish
# ============================================================================

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}▶ Step 5: Final build...${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}Building package for publish...${NC}"
if ! pixi run build; then
    echo -e "${RED}Final build failed! Version is bumped but not published.${NC}"
    echo -e "${YELLOW}You may need to run 'pixi run build && npm publish' manually.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build successful${NC}"

# ============================================================================
# STEP 6: Publish to npm
# ============================================================================

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}▶ Step 6: Publishing to npm...${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if logged in to npm, login if needed
if ! npm whoami &>/dev/null; then
    echo -e "${YELLOW}Not logged in to npm. Please login:${NC}"
    npm login
fi

npm publish

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Published successfully!                   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Version:${NC} $NEW_VERSION"
echo -e "${GREEN}Tag:${NC}     v$NEW_VERSION"
echo -e "${GREEN}npm:${NC}     https://www.npmjs.com/package/tauri-test-cli"
