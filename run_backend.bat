@echo off
setlocal

cd /d "%~dp0"
set PYTHONPATH=%CD%

if exist ".venv\Scripts\python.exe" (
    set "PYTHON_CMD=.venv\Scripts\python.exe"
) else (
    set "PYTHON_CMD=python"
)

echo Starting CompanyAI 2.0 Backend Server on http://127.0.0.1:8000
%PYTHON_CMD% -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
