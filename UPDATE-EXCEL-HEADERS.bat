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

echo  5. Function dropdown eken "fixBudgetColumn" select karanna

echo  6. Run button click karanna (first time: Allow access)

echo  7. "Done!" message ekak enna one

echo.

echo  IMPORTANT: Sheet eke bottom tabs balanna:

echo    - "Responses" tab ekak thiyenawada?

echo    - "Sheet1" tab eke data thiyenawada?

echo  Data thiyena tab eke row 1 balanna (F1 = Budget Price Cafe)

echo.

echo  8. Deploy -^> Manage deployments -^> Edit -^> New version -^> Deploy

echo     (survey submit wenna meka karanna oni)

pause

