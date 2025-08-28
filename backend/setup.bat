@echo off
REM Wizard Tracker Backend Setup Script for Windows

echo 🧙‍♂️ Wizard Tracker Backend Setup
echo =================================

REM Check if .env exists
if not exist .env (
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ✅ .env file created! Please edit it with your MongoDB URI and JWT secret.
) else (
    echo ✅ .env file already exists
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install

echo.
echo 🚀 Setup complete! Next steps:
echo.
echo 1. Edit .env file with your configuration:
echo    - MONGO_URI: Your MongoDB connection string
echo    - JWT_SECRET: A secure random string
echo.
echo 2. Start development server:
echo    npm run dev
echo.
echo 3. Or start with Docker:
echo    docker-compose up --build
echo.
echo 4. Test the API:
echo    curl http://localhost:5000/api/health
