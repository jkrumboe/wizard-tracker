#!/usr/bin/env bash
# online-toggle.sh - A script to toggle online/offline mode in the Wizard Tracker app

# Ensure this script is only run inside the container
if [ ! -f /.dockerenv ]; then
  echo "ERROR: This script must be run inside the Docker container."
  echo "Use: docker exec -it wizard-tracker-backend-1 ./online-toggle.sh [on|off|status]"
  exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NODE_SCRIPT="${SCRIPT_DIR}/online-cli.js"

# Check if the script exists
if [ ! -f "$NODE_SCRIPT" ]; then
  echo "ERROR: online-cli.js not found at $NODE_SCRIPT"
  exit 1
fi

# Process command line arguments
case "$1" in
  on|online|true)
    echo "Enabling online mode..."
    node "$NODE_SCRIPT" on "$2"
    ;;
  off|offline|false)
    echo "Disabling online mode..."
    node "$NODE_SCRIPT" off "$2"
    ;;
  status|"")
    echo "Checking online status..."
    node "$NODE_SCRIPT" status
    ;;
  *)
    echo "Usage: $0 [on|off|status] [reason]"
    echo "  on     - Enable online features"
    echo "  off    - Disable online features"
    echo "  status - Show current status (default)"
    echo ""
    echo "Example: $0 off \"Server maintenance\""
    ;;
esac

exit 0
