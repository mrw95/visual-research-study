@echo off
title CarSwitch Quotations
cd /d "%~dp0"
set PORT=8090
set QUOTE_PIN=9292
set QUOTE_TUNNEL=1
echo.
echo  This PC tab:     http://localhost:8090/quotation
echo  Office laptop:   http://CarSwitch:8090/quotation
echo                   http://192.168.1.15:8090/quotation
echo  Saved list:      http://localhost:8090/quotations
echo  Folders:         \\Carswitch\CarSwitch Document\Related Documents\Genx Imp\Quotations
echo  Save format:     PDF
echo.
echo  Home / any laptop (PC eka on unath nathath):
echo    https://visual-research-study.vercel.app/quotation
echo.
echo  Me window eka close karanna epa — office + home dekema meka running wenna one.
echo.
start http://localhost:8090/quotation
python server.py
pause
