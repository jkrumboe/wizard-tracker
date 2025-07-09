@echo off
REM test-online-mode.bat - A Windows script to test online/offline functionality

echo === KeepWiz Online Mode Test Script ===
echo.

if "%1"=="on" (
  echo Setting online mode to ON...
  docker exec -it -u root wizard-tracker-backend-1 node src/online-cli.js on "Script test - online"
) else if "%1"=="off" (
  echo Setting online mode to OFF...
  docker exec -it -u root wizard-tracker-backend-1 node src/online-cli.js off "Script test - offline"
) else if "%1"=="status" (
  echo Checking online status...
  docker exec -it wizard-tracker-backend-1 node src/online-cli.js status
) else (
  echo Usage: test-online-mode.bat [on^|off^|status]
  echo.
  echo   on     - Enable online features
  echo   off    - Disable online features
  echo   status - Show current status (default)
  echo.
  echo Checking current status...
  docker exec -it wizard-tracker-backend-1 node src/online-cli.js status
)

echo.
echo === Testing API access ===

echo.
echo Testing status API (should always work):
curl -s http://localhost:5055/api/online/status | findstr online

echo.
echo Testing multiplayer API (should fail in offline mode):
curl -s http://localhost:5055/api/rooms/active || echo Failed as expected in offline mode

echo.
echo Done testing!
