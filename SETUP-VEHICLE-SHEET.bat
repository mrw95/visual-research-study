@echo off
title CarSwitch — Google Sheet data setup
cd /d "%~dp0"
color 0B
echo.
echo  ================================================
echo   CUSTOMER DATA - GOOGLE SHEET EKATA SAVE
echo  ================================================
echo.
echo  WhatsApp eken fill una inquiries Sheet eke Vehicle tab ekata yanawa.
echo.
echo  --- STEP 1 ---
echo  Google Sheet open karanna
echo  Survey eke use kara SAME sheet eka open karanna
start https://sheets.google.com
pause
echo.
echo  --- STEP 2 ---
echo  Extensions -^> Apps Script
echo  Old code FULLY delete karala, Notepad eke code eka paste karanna
echo  Save: Ctrl+S
start notepad "%~dp0scripts\google-sheet-code.gs"
pause
echo.
echo  --- STEP 3 ---
echo  Apps Script eke function: testVehicleSave
echo  Run click -^> Allow access
echo  Sheet eke Vehicle tab eke test row ekak enna one
pause
echo.
echo  --- STEP 4 ---
echo  Deploy -^> Manage deployments -^> Edit (pencil)
echo  Version: New version
echo  Deploy
echo  Who has access: Anyone
echo.
echo  Done. Customer form:
echo  https://visual-research-study.vercel.app/hotline
echo.
pause
