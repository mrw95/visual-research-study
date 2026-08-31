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
echo  This PC tab:     http://localhost:8090/quotation
echo  Phone / Tab:     localhost eken open WENNE NA
echo                   START-QUOTATION window eke IP link eka copy karanna
echo                   or open http://localhost:8090/phone-link
echo  Saved list:      http://localhost:8090/quotations
echo  Folders:         \\Carswitch\CarSwitch Document\Related Documents\Genx Imp\Quotations
echo  Save format:     PDF
echo.
echo  Home / phone / data (PC eka on wenna one na):
echo    https://visual-research-study.vercel.app/quotation
echo    https://visual-research-study.vercel.app/quotations
echo.
echo  Me window eka close karanna epa — office + home dekema meka running wenna one.
echo.
start http://localhost:8090/quotation
python server.py
pause
