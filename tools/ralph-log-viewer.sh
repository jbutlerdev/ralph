#!/bin/bash
# Ralph Log Viewer - Follow and display Ralph session logs in a readable format

if [ $# -lt 1 ]; then
  echo "Usage: ralph-log-viewer.sh <log-file> [tail-lines]"
  echo ""
  echo "Examples:"
  echo "  ralph-log-viewer.sh .ralph/logs/session-session-123-task-001.log"
  echo "  ralph-log-viewer.sh .ralph/logs/session-session-123-task-001.log 50"
  echo ""
  echo "If tail-lines is provided, shows that many existing lines before following."
  exit 1
fi

LOG_FILE="$1"
TAIL_LINES="${2:-0}"

# Color codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Check if file exists
if [ ! -f "$LOG_FILE" ]; then
  echo "Error: Log file not found: $LOG_FILE"
  exit 1
fi

echo -e "${BLUE}Following Ralph log: ${LOG_FILE}${NC}"
echo -e "${GRAY}Press Ctrl+C to stop${NC}"
echo ""

# Function to format a log entry
format_entry() {
  local entry="$1"
  local timestamp
  local type
  local subtype
  local content

  # Extract fields using jq
  timestamp=$(echo "$entry" | jq -r '.timestamp // empty' 2>/dev/null)
  type=$(echo "$entry" | jq -r '.type // empty' 2>/dev/null)
  subtype=$(echo "$entry" | jq -r '.subtype // empty' 2>/dev/null)
  content=$(echo "$entry" | jq -r '.content // empty' 2>/dev/null)

  # Format timestamp
  local time_str=""
  if [ -n "$timestamp" ]; then
    time_str="${GRAY}[$(date -d "$timestamp" '+%H:%M:%S' 2>/dev/null || echo "$timestamp")]${NC} "
  fi

  # Format based on type
  case "$type" in
    system)
      if [ "$subtype" = "init" ]; then
        echo -e "${time_str}${CYAN}⚙ SYSTEM${NC} Session initialized"
      else
        echo -e "${time_str}${CYAN}⚙ SYSTEM${NC} $subtype"
      fi
      ;;
    assistant)
      echo -e "${time_str}${GREEN}▶ ASSISTANT${NC}"
      # Extract and format assistant content
      if echo "$entry" | jq -e '.metadata.rawMessage.message.content[] | select(.type == "text") | .text' > /dev/null 2>&1; then
        echo "$entry" | jq -r '.metadata.rawMessage.message.content[] | select(.type == "text") | .text' 2>/dev/null | while IFS= read -r line; do
          echo -e "  ${GRAY}$line${NC}"
        done
      fi
      # Show tool calls
      if echo "$entry" | jq -e '.metadata.rawMessage.message.content[] | select(.type == "tool_use")' > /dev/null 2>&1; then
        echo "$entry" | jq -r '.metadata.rawMessage.message.content[] | select(.type == "tool_use") | "  🔧 \(.name) // empty"' 2>/dev/null
      fi
      ;;
    user)
      echo -e "${time_str}${BLUE}◀ USER / TOOL RESULT${NC}"
      # Check if there's an error
      if echo "$entry" | jq -e '.metadata.rawMessage.message.content[] | select(.is_error == true)' > /dev/null 2>&1; then
        echo "$entry" | jq -r '.metadata.rawMessage.message.content[] | select(.is_error == true) | .content // empty' 2>/dev/null | while IFS= read -r line; do
          echo -e "  ${RED}✗ $line${NC}"
        done
      else
        # Extract tool calls from the content array
        if echo "$entry" | jq -e '.metadata.rawMessage.message.content[] | select(.type == "tool_use")' > /dev/null 2>&1; then
          echo "$entry" | jq -r '.metadata.rawMessage.message.content[] | select(.type == "tool_use") | "  🔧 \(.name) // empty"' 2>/dev/null
        # Extract tool results
        elif echo "$entry" | jq -e '.metadata.rawMessage.message.content[] | select(.type == "tool_result")' > /dev/null 2>&1; then
          # Show first few lines of tool result
          echo "$entry" | jq -r '.metadata.rawMessage.message.content[] | select(.type == "tool_result") | .content // empty' 2>/dev/null | head -5 | sed 's/^/  /'
        # Extract text content
        elif echo "$entry" | jq -e '.metadata.rawMessage.message.content[] | select(.type == "text")' > /dev/null 2>&1; then
          echo "$entry" | jq -r '.metadata.rawMessage.message.content[] | select(.type == "text") | .text // empty' 2>/dev/null | head -3 | sed 's/^/  /'
        else
          # Show raw content (truncated)
          echo "$entry" | jq -r '.content // empty' 2>/dev/null | head -3 | sed 's/^/  /'
        fi
      fi
      ;;
    result)
      if [ "$subtype" = "success" ]; then
        echo -e "${time_str}${GREEN}✓ RESULT${NC} Task completed successfully"
        echo "$entry" | jq -r '.content // empty' 2>/dev/null | head -3 | sed 's/^/  /'
      else
        echo -e "${time_str}${RED}✗ RESULT${NC} $subtype"
      fi
      ;;
    log)
      local level
      level=$(echo "$entry" | jq -r '.content // empty' | sed 's/^\[\(INFO\|DEBUG\|WARN\|ERROR\)\].*/\1/' 2>/dev/null)
      case "$level" in
        *ERROR*)
          echo -e "${time_str}${RED}LOG${NC} $(echo "$entry" | jq -r '.content // empty' 2>/dev/null)"
          ;;
        *WARN*)
          echo -e "${time_str}${YELLOW}LOG${NC} $(echo "$entry" | jq -r '.content // empty' 2>/dev/null)"
          ;;
        *INFO*)
          echo -e "${time_str}${GREEN}LOG${NC} $(echo "$entry" | jq -r '.content // empty' 2>/dev/null)"
          ;;
        *)
          echo -e "${time_str}${GRAY}LOG${NC} $(echo "$entry" | jq -r '.content // empty' 2>/dev/null)"
          ;;
      esac
      ;;
    *)
      echo -e "${time_str}${MAGENTA}$type${NC} $(echo "$entry" | jq -r '.content // empty' 2>/dev/null)"
      ;;
  esac

  echo ""
}

# Tail the file and process new lines
if [ "$TAIL_LINES" -gt 0 ]; then
  tail -n "$TAIL_LINES" "$LOG_FILE" | while IFS= read -r line; do
    if [ -n "$line" ]; then
      format_entry "$line"
    fi
  done
fi

tail -f "$LOG_FILE" | while IFS= read -r line; do
  if [ -n "$line" ]; then
    format_entry "$line"
  fi
done
