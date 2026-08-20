@echo off
title Excel column names update
cd /d "%~dp0"
color 0E
echo.
echo  ================================================
echo   EXCEL COLUMN NAME UPDATE
echo   Budget Price Cafe
echo  ================================================
echo.
echo  Me steps follow karanna:
echo.
echo  1. Google Sheet open karanna
echo  2. Extensions -^> Apps Script
echo  3. Notepad eke code eka copy karala paste karanna
start notepad "%~dp0scripts\google-sheet-code.gs"
pause
echo.
echo  4. Apps Script eke Save (Ctrl+S)
echo  5. Function dropdown eken "syncHeaders" select karanna
echo  6. Run button click karanna (first time: Allow access)
echo  7. Sheet eke F1 column eka "Budget Price Cafe" wela balanna
echo.
echo  8. Deploy -^> Manage deployments -^> Edit -^> New version -^> Deploy
echo     (survey submit wenna meka karanna oni)
pause
