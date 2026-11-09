@echo off
title StrokeAegis AI — Unified Clinical Demo
echo ==============================================================
echo              StrokeAegis AI — Unified Demo
echo    AI-Powered Stroke Reporting & Integrated Solutions
echo ==============================================================
echo.
if not exist "frontend\dist\index.html" (
    echo Building the React frontend ^(first run only^) ...
    pushd frontend
    call npm install
    call npm run build
    popd
)
echo Starting StrokeAegis AI server on http://127.0.0.1:8000 ...
python start_demo.py
pause
