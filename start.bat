@echo off
title CodeMind - AI Codebase Understanding Engine

echo ============================================
echo   CodeMind - AI Codebase Understanding Engine
echo ============================================
echo.

:: Check for .env file
if not exist "backend\.env" (
    echo [Setup] Creating .env from template...
    copy backend\.env.example backend\.env
    echo.
    echo !! IMPORTANT: Add your GEMINI_API_KEY to backend\.env !!
    echo    Get a free key at: https://aistudio.google.com
    echo.
    pause
)

:: Setup Python venv if needed
if not exist "backend\venv" (
    echo [Setup] Creating Python virtual environment...
    cd backend
    python -m venv venv
    cd ..
)

:: Install Python dependencies
echo [Backend] Installing Python dependencies...
cd backend
call venv\Scripts\activate
pip install -r requirements.txt -q
cd ..

:: Install Node dependencies
if not exist "frontend\node_modules" (
    echo [Frontend] Installing Node.js dependencies...
    cd frontend
    npm install --silent
    cd ..
)

echo.
echo [Starting] Launching backend on http://localhost:8000
echo [Starting] Launching frontend on http://localhost:3000
echo.

:: Start backend in a new window
start "CodeMind Backend" cmd /c "cd backend && call venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend
start "CodeMind Frontend" cmd /c "cd frontend && npm run dev"

:: Wait for frontend
timeout /t 3 /nobreak >nul

:: Open browser
echo [Browser] Opening http://localhost:3000 ...
start http://localhost:3000

echo.
echo ============================================
echo   CodeMind is running!
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo ============================================
echo.
echo Press any key to exit this window (servers will keep running)
pause >nul
