#!/usr/bin/env bash
set -euo pipefail

# Bump version in pixi.toml and package.json
# Usage: ./scripts/bump-version.sh [major|minor|patch|<version>]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

PIXI_TOML="$PROJECT_DIR/pixi.toml"
PACKAGE_JSON="$PROJECT_DIR/package.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    echo "Usage: $0 [major|minor|patch|<version>]"
    echo ""
    echo "Bump version in pixi.toml and package.json"
    echo ""
    echo "Arguments:"
    echo "  major     Bump major version (1.0.0 -> 2.0.0)"
    echo "  minor     Bump minor version (1.0.0 -> 1.1.0)"
    echo "  patch     Bump patch version (1.0.0 -> 1.0.1)"
    echo "  <version> Set specific version (e.g., 1.2.3)"
    echo ""
    echo "Examples:"
    echo "  $0 patch      # 0.1.0 -> 0.1.1"
    echo "  $0 minor      # 0.1.0 -> 0.2.0"
    echo "  $0 major      # 0.1.0 -> 1.0.0"
    echo "  $0 2.0.0      # Set to 2.0.0"
}

get_current_version() {
    grep -E '^version = ' "$PIXI_TOML" | sed 's/version = "\(.*\)"/\1/'
}

bump_version() {
    local current="$1"
    local bump_type="$2"

    IFS='.' read -r major minor patch <<< "$current"

    case "$bump_type" in
        major)
            echo "$((major + 1)).0.0"
            ;;
        minor)
            echo "${major}.$((minor + 1)).0"
            ;;
        patch)
            echo "${major}.${minor}.$((patch + 1))"
            ;;
        *)
            # Assume it's a specific version
            if [[ "$bump_type" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                echo "$bump_type"
            else
                echo ""
            fi
            ;;
    esac
}

update_pixi_toml() {
    local new_version="$1"
    sed -i "s/^version = \".*\"/version = \"$new_version\"/" "$PIXI_TOML"
}

update_package_json() {
    local new_version="$1"
    sed -i "s/\"version\": \".*\"/\"version\": \"$new_version\"/" "$PACKAGE_JSON"
}

# Main
if [[ $# -lt 1 ]]; then
    usage
    exit 1
fi

BUMP_TYPE="$1"

if [[ "$BUMP_TYPE" == "-h" || "$BUMP_TYPE" == "--help" ]]; then
    usage
    exit 0
fi

# Get current version
CURRENT_VERSION=$(get_current_version)
echo -e "${CYAN}Current version:${NC} $CURRENT_VERSION"

# Calculate new version
NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$BUMP_TYPE")

if [[ -z "$NEW_VERSION" ]]; then
    echo -e "${RED}Error: Invalid version or bump type: $BUMP_TYPE${NC}"
    usage
    exit 1
fi

echo -e "${YELLOW}New version:${NC}     $NEW_VERSION"
echo ""

# Update files
echo -e "${GREEN}Updating pixi.toml...${NC}"
update_pixi_toml "$NEW_VERSION"

echo -e "${GREEN}Updating package.json...${NC}"
update_package_json "$NEW_VERSION"

# Verify
echo ""
echo -e "${CYAN}Verification:${NC}"
echo -n "  pixi.toml:    "
grep -E '^version = ' "$PIXI_TOML"
echo -n "  package.json: "
grep '"version"' "$PACKAGE_JSON" | sed 's/^[[:space:]]*//'

echo ""
echo -e "${GREEN}Done!${NC} Version bumped to $NEW_VERSION"
echo ""
echo "Next steps:"
echo "  git add pixi.toml package.json"
echo "  git commit -m \"Bump version to $NEW_VERSION\""
echo "  git tag v$NEW_VERSION"
