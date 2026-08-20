@echo off
title Excel ekata save — Setup
cd /d "%~dp0"
color 0B
echo.
echo  ================================================
echo   SURVEY RESULTS - EXCEL EKATA SAVE
echo  ================================================
echo.
echo  Submit unama automatic Excel sheet ekata save wenne.
echo  Me setup eka EKA DAWASAK witharai karanna.
echo.
echo  --- STEP 1 ---
echo  Google Sheet ekak hadanna (blank)
start https://sheets.google.com/create
echo  Sheet name: Anuradhapura Survey
pause
echo.
echo  --- STEP 2 ---
echo  Extensions -^> Apps Script open wenne
echo  Code eka paste karanna (Notepad open wenne)
start notepad "%~dp0scripts\google-sheet-code.gs"
pause
echo.
echo  --- STEP 3 ---
echo  Apps Script eke:
echo    Deploy -^> New deployment -^> Web app
echo    Execute as: Me
echo    Who has access: Anyone
echo    Deploy click -^> URL copy karanna
echo.
pause
echo.
echo  --- STEP 4 ---
echo  config.js open wenne — URL 2 danna:
start notepad "%~dp0static\config.js"
echo.
echo  SHEET_URL = 'copy kara web app URL'
echo  RESULTS_SHEET = 'sheet open link (sheets.google.com/...)'
echo.
echo  Save karala Notepad close karanna, passey Enter press karanna
pause
echo.
echo  --- STEP 5 — GitHub ekata upload ---
call "%~dp0PUSH-TO-GITHUB.bat"
echo.
echo  Done! Results balanna: OPEN-EXCEL.bat run karanna
pause
