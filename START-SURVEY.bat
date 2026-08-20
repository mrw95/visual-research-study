@echo off
title Visual Research Study — Start
cd /d "%~dp0"
echo.
echo  Starting survey on http://localhost:8080
echo.
start http://localhost:8080
python server.py
pause
