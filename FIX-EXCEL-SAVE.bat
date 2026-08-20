@echo off
title Fix Excel save — IMPORTANT
cd /d "%~dp0"
color 0C
echo.
echo  ================================================
echo   EXCEL SAVE FIX — me steps EXACT order eken
echo  ================================================
echo.
echo  PROBLEM: Web App URL eka work wenne na (400 error)
echo  SOLUTION: Apps Script re-deploy + URL update
echo.
echo  --- STEP 1: Google Sheet open karanna ---
start https://sheets.google.com
pause
echo.
echo  --- STEP 2: Apps Script code paste karanna ---
start notepad "%~dp0scripts\google-sheet-code.gs"
echo  Extensions -^> Apps Script
echo  Old code DELETE karala notepad code COPY+PASTE
echo  Save (Ctrl+S)
pause
echo.
echo  --- STEP 3: Test (Apps Script editor eke) ---
echo  Function: testSave  -^>  Run  -^>  Allow access
echo  Sheet eke new row ekak enna one
pause
echo.
echo  --- STEP 4: Deploy Web App ---
echo  Deploy -^> New deployment (or Manage -^> Edit -^> New version)
echo  Type: Web app
echo  Execute as: Me
echo  Who has access: Anyone
echo  Deploy -^> COPY the Web App URL
echo  URL must look like:
echo  https://script.google.com/macros/s/XXXX.../exec
pause
echo.
echo  --- STEP 5: URL config.js eke danna ---
start notepad "%~dp0static\config.js"
echo  SHEET_URL = 'paste your NEW web app URL here'
echo  Save notepad, then Enter here
pause
echo.
echo  --- STEP 6: GitHub push ---
call "%~dp0PUSH-TO-GITHUB.bat"
echo.
echo  --- STEP 7: Test in browser ---
echo  Paste Web App URL in browser + add:
echo  ?sid=test1^&s1=1^&s2=1^&s3=1^&note=browser-test
echo  Page eke "ok" penna one
echo.
echo  Survey: https://mrw95.github.io/visual-research-study/?v=12
pause
