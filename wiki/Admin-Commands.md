# Admin Commands

## Online/Offline Mode

Wizard Tracker supports an "offline mode" where all online features (multiplayer, leaderboards, etc.) are disabled. This is useful for maintenance periods or for users who want to use the application in a completely offline environment.

> **Note:** The application starts in offline mode by default for security reasons.

### Toggle Online/Offline Mode

To toggle online/offline mode, use the following commands from your host system:

```bash
# Enter the backend container as root to avoid permission issues
docker exec -it -u root wizard-tracker-backend-1 sh

# Check current status
node src/online-cli.js status

# Turn off online features
node src/online-cli.js off "Maintenance mode"

# Turn on online features
node src/online-cli.js on "Maintenance complete"
```

You can also use the direct commands without entering the container:

```bash
# Check current status
docker exec -it wizard-tracker-backend-1 node src/online-cli.js status

# Turn off online features (using root user to avoid permission issues)
docker exec -it -u root wizard-tracker-backend-1 node src/online-cli.js off "Maintenance mode"

# Turn on online features (using root user to avoid permission issues)
docker exec -it -u root wizard-tracker-backend-1 node src/online-cli.js on "Maintenance complete"
```

### Effects of Offline Mode

When the system is in offline mode:

- Multiplayer game functionality is disabled
- Leaderboard pages are not accessible
- Online player statistics are not available
- The UI automatically adjusts to show only local game options

The application will continue to work for local games, including saving and loading local game data.
