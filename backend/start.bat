@echo off
echo Starting AI Codebase Understanding Engine Backend...
if not exist .env (
    copy .env.example .env
    echo Created .env file - please add your GEMINI_API_KEY!
)
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt -q
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
