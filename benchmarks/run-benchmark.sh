#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$SCRIPT_DIR/results"
PROMPTS_DIR="$SCRIPT_DIR/prompts"

# Default model
MODEL="${MODEL:-sonnet}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 [OPTIONS] [TASK...]"
    echo ""
    echo "Run Claude Code benchmarks for tauri-driver-cli testing"
    echo ""
    echo "Options:"
    echo "  -m, --model MODEL    Model to use (default: sonnet)"
    echo "  -l, --list           List available tasks"
    echo "  -a, --all            Run all tasks"
    echo "  -v, --visualize      Show real-time visualization"
    echo "  -q, --quiet          Minimal output (just timing)"
    echo "  -h, --help           Show this help"
    echo ""
    echo "Available models: sonnet, opus, haiku"
    echo ""
    echo "Examples:"
    echo "  $0 --list                    # List all tasks"
    echo "  $0 --all                     # Run all benchmarks"
    echo "  $0 screenshot click          # Run specific tasks"
    echo "  $0 -m opus --all             # Run all with Opus"
    echo "  $0 -v screenshot             # Run with visualization"
}

list_tasks() {
    echo -e "${CYAN}Available benchmark tasks:${NC}"
    echo ""
    for prompt in "$PROMPTS_DIR"/*.md; do
        if [[ -f "$prompt" ]]; then
            name=$(basename "$prompt" .md)
            # Skip files starting with underscore (context files)
            if [[ "$name" == _* ]]; then
                continue
            fi
            # Extract first line as description
            desc=$(head -1 "$prompt" | sed 's/^# //')
            echo -e "  ${GREEN}$name${NC} - $desc"
        fi
    done
}

# Parse arguments
VISUALIZE=false
QUIET=false
RUN_ALL=false
TASKS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--model)
            MODEL="$2"
            shift 2
            ;;
        -l|--list)
            list_tasks
            exit 0
            ;;
        -a|--all)
            RUN_ALL=true
            shift
            ;;
        -v|--visualize)
            VISUALIZE=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            TASKS+=("$1")
            shift
            ;;
    esac
done

# If --all, get all tasks
if [[ "$RUN_ALL" == "true" ]]; then
    TASKS=()
    for prompt in "$PROMPTS_DIR"/*.md; do
        if [[ -f "$prompt" ]]; then
            name=$(basename "$prompt" .md)
            # Skip files starting with underscore (context files)
            if [[ "$name" != _* ]]; then
                TASKS+=("$name")
            fi
        fi
    done
fi

# Check if we have tasks to run
if [[ ${#TASKS[@]} -eq 0 ]]; then
    echo -e "${RED}Error: No tasks specified${NC}"
    echo ""
    usage
    exit 1
fi

# Create results directory
mkdir -p "$RESULTS_DIR"

# Timestamp for this run
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SUMMARY_FILE="$RESULTS_DIR/summary_${TIMESTAMP}.json"

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        Claude Code Benchmark - tauri-driver-cli             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Model:${NC} $MODEL"
echo -e "${BLUE}Tasks:${NC} ${TASKS[*]}"
echo -e "${BLUE}Time:${NC}  $(date)"
echo ""

# Initialize summary
echo '{"benchmarks": [], "model": "'$MODEL'", "timestamp": "'$TIMESTAMP'"}' > "$SUMMARY_FILE"

# Track overall stats
TOTAL_TASKS=0
PASSED_TASKS=0
TOTAL_TIME=0

run_task() {
    local task_name="$1"
    local prompt_file="$PROMPTS_DIR/${task_name}.md"
    local output_file="$RESULTS_DIR/${task_name}_${TIMESTAMP}.json"
    local log_file="$RESULTS_DIR/${task_name}_${TIMESTAMP}.log"

    if [[ ! -f "$prompt_file" ]]; then
        echo -e "${RED}Error: Task '$task_name' not found (no $prompt_file)${NC}"
        return 1
    fi

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}▶ Running task: ${NC}${CYAN}$task_name${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Record start time
    local start_time=$(date +%s.%N)
    local start_epoch=$(date +%s)

    # Run Claude Code
    local exit_code=0

    if [[ "$VISUALIZE" == "true" ]]; then
        # With visualization
        cat "$prompt_file" | claude -p \
            --dangerously-skip-permissions \
            --output-format=stream-json \
            --model "$MODEL" \
            --verbose \
            2>&1 | tee "$log_file" | bun "$SCRIPT_DIR/visualize.ts" || exit_code=$?
    elif [[ "$QUIET" == "true" ]]; then
        # Quiet mode - just capture output
        cat "$prompt_file" | claude -p \
            --dangerously-skip-permissions \
            --output-format=stream-json \
            --model "$MODEL" \
            --verbose \
            > "$log_file" 2>&1 || exit_code=$?
    else
        # Normal mode - show progress dots
        echo -n "  Progress: "
        cat "$prompt_file" | claude -p \
            --dangerously-skip-permissions \
            --output-format=stream-json \
            --model "$MODEL" \
            --verbose \
            2>&1 | tee "$log_file" | while IFS= read -r line; do
                echo -n "."
            done || exit_code=$?
        echo ""
    fi

    # Record end time
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)

    # Extract token usage from log (last usage entry)
    local input_tokens=0
    local output_tokens=0
    local cache_read=0
    local cache_create=0

    if [[ -f "$log_file" ]]; then
        # Try to extract usage from JSON lines
        local usage_line=$(grep -o '"usage":{[^}]*}' "$log_file" | tail -1 || true)
        if [[ -n "$usage_line" ]]; then
            input_tokens=$(echo "$usage_line" | grep -o '"input_tokens":[0-9]*' | grep -o '[0-9]*' || echo 0)
            output_tokens=$(echo "$usage_line" | grep -o '"output_tokens":[0-9]*' | grep -o '[0-9]*' || echo 0)
            cache_read=$(echo "$usage_line" | grep -o '"cache_read_input_tokens":[0-9]*' | grep -o '[0-9]*' || echo 0)
            cache_create=$(echo "$usage_line" | grep -o '"cache_creation_input_tokens":[0-9]*' | grep -o '[0-9]*' || echo 0)
        fi
    fi

    # Determine status
    local status="passed"
    local status_color="$GREEN"
    if [[ $exit_code -ne 0 ]]; then
        status="failed"
        status_color="$RED"
    fi

    # Print result
    echo ""
    echo -e "  ${status_color}Status:${NC} $status (exit code: $exit_code)"
    echo -e "  ${BLUE}Duration:${NC} ${duration}s"
    echo -e "  ${BLUE}Tokens:${NC} in=$input_tokens out=$output_tokens cache_read=$cache_read cache_create=$cache_create"
    echo -e "  ${BLUE}Log:${NC} $log_file"
    echo ""

    # Save result to JSON
    cat > "$output_file" << EOF
{
  "task": "$task_name",
  "model": "$MODEL",
  "status": "$status",
  "exit_code": $exit_code,
  "duration_seconds": $duration,
  "start_epoch": $start_epoch,
  "tokens": {
    "input": $input_tokens,
    "output": $output_tokens,
    "cache_read": $cache_read,
    "cache_create": $cache_create
  },
  "log_file": "$log_file"
}
EOF

    # Update summary
    local tmp_file=$(mktemp)
    jq --argjson result "$(cat "$output_file")" '.benchmarks += [$result]' "$SUMMARY_FILE" > "$tmp_file"
    mv "$tmp_file" "$SUMMARY_FILE"

    # Update stats
    TOTAL_TASKS=$((TOTAL_TASKS + 1))
    if [[ "$status" == "passed" ]]; then
        PASSED_TASKS=$((PASSED_TASKS + 1))
    fi
    TOTAL_TIME=$(echo "$TOTAL_TIME + $duration" | bc)

    return $exit_code
}

# Ensure test app is built
echo -e "${BLUE}Checking test app...${NC}"
if [[ ! -f "$PROJECT_DIR/apps/test-app/src-tauri/target/debug/test-app" ]]; then
    echo -e "${YELLOW}Building test app...${NC}"
    cd "$PROJECT_DIR"
    pixi run test-app-build
fi

# Ensure server is not running (clean state)
echo -e "${BLUE}Ensuring clean state...${NC}"
cd "$PROJECT_DIR"
pixi run stop 2>/dev/null || true
pixi run cleanup 2>/dev/null || true

# Run each task
FAILED_TASKS=()
for task in "${TASKS[@]}"; do
    if ! run_task "$task"; then
        FAILED_TASKS+=("$task")
    fi

    # Clean up between tasks
    pixi run stop 2>/dev/null || true
done

# Print summary
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                      BENCHMARK SUMMARY                       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Total tasks:${NC}  $TOTAL_TASKS"
echo -e "${GREEN}Passed:${NC}       $PASSED_TASKS"
echo -e "${RED}Failed:${NC}       $((TOTAL_TASKS - PASSED_TASKS))"
echo -e "${BLUE}Total time:${NC}   ${TOTAL_TIME}s"
echo -e "${BLUE}Avg time:${NC}     $(echo "scale=2; $TOTAL_TIME / $TOTAL_TASKS" | bc)s"
echo ""

if [[ ${#FAILED_TASKS[@]} -gt 0 ]]; then
    echo -e "${RED}Failed tasks:${NC} ${FAILED_TASKS[*]}"
fi

echo -e "${BLUE}Summary:${NC} $SUMMARY_FILE"
echo ""

# Exit with failure if any task failed
if [[ ${#FAILED_TASKS[@]} -gt 0 ]]; then
    exit 1
fi
