@echo off
title CarSwitch Quotations
cd /d "%~dp0"
set PORT=8090
set QUOTE_PIN=9292
set QUOTE_TUNNEL=1
set PYTHONIOENCODING=utf-8
chcp 65001 >nul
netsh advfirewall firewall add rule name="CarSwitch Quotations 8090" dir=in action=allow protocol=TCP localport=8090 profile=any >nul 2>&1
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
echo  Home / phone / data (PC eka on wenna one na):
echo    https://visual-research-study.vercel.app/desk
echo.
echo  Me window eka close karanna epa — office + home dekema meka running wenna one.
echo.
start http://localhost:8090/desk
python server.py
pause
