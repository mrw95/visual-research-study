@echo off
title CarSwitch Quotations
cd /d "%~dp0"
set PORT=8090
set QUOTE_PIN=9292
set QUOTE_TUNNEL=0
set PYTHONIOENCODING=utf-8
chcp 65001 >nul
netsh advfirewall firewall add rule name="CarSwitch Quotations 8090" dir=in action=allow protocol=TCP localport=8090 profile=any >nul 2>&1
echo Stopping old server on port 8090...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8090" ^| findstr LISTENING') do taskkill /F /PID %%P >nul 2>&1
echo.
echo  This PC tab:     http://localhost:8090/desk
echo  Quotation:       http://localhost:8090/quotation
echo  Sales agreement: http://localhost:8090/agreement
echo  Pre-order:       http://localhost:8090/preorder
echo  Invoice:         http://localhost:8090/invoice
echo  Phone / Tab:     localhost eken open WENNE NA
echo                   START-QUOTATION window eke IP link eka copy karanna
echo                   or open http://localhost:8090/phone-link
echo  Saved list:      http://localhost:8090/quotations
echo  Agreements:      http://localhost:8090/agreements
echo  Quote folders:   \\Carswitch\CarSwitch Document\Related Documents\Genx Imp\Quotations
echo  Agreement folders: \\Carswitch\CarSwitch Document\Related Documents\CarSwitch\Invoice ^& Agreement
echo  Save format:     PDF
echo.
echo  Share this forever (PC on / off / home — same link):
echo    https://visual-research-study.vercel.app/desk
echo.
start http://localhost:8090/desk
python server.py
pause
