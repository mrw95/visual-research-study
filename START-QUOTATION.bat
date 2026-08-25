@echo off
title GENX Quotations
cd /d "%~dp0"
echo.
echo  Quotations: http://localhost:8080/quotation
echo  Saved list: http://localhost:8080/quotations
echo  Folders: \\Carswitch\CarSwitch Document\Related Documents\Genx Imp\Quotations
echo.
start http://localhost:8080/quotation
python server.py
pause
