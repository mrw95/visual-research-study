@echo off
title Deploy Survey — Step by step
cd /d "%~dp0"

echo.
echo  ============================================
echo   ANURADHAPURA SURVEY — VERCEL DEPLOY
echo  ============================================
echo.
echo  Me error eka = project eka deploy wela NE.
echo  Me steps follow karanna:
echo.
echo  STEP A — GitHub repo create
echo    Browser open wenne...
start https://github.com/new
echo    Name: anuradhapura-survey
echo    README add karanna EPAA — Create repository
echo.
pause
echo.
echo  STEP B — GitHub ekata push
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 git init -b main

git remote get-url origin >nul 2>&1
if errorlevel 1 git remote add origin https://github.com/mrw95/anuradhapura-survey.git

git add -A
set GIT_AUTHOR_NAME=Malki Widanagamage
set GIT_AUTHOR_EMAIL=mr1.widanagamage@gmail.com
set GIT_COMMITTER_NAME=Malki Widanagamage
set GIT_COMMITTER_EMAIL=mr1.widanagamage@gmail.com
git commit -m "Anuradhapura survey" 2>nul
git push -u origin main
if errorlevel 1 (
  echo.
  echo  Push failed — GitHub login karanna one.
  echo  Browser: https://github.com/login
  pause
  git push -u origin main
)

echo.
echo  STEP C — Vercel deploy
start https://vercel.com/new
echo    anuradhapura-survey repo import karanna
echo    Deploy click karanna
echo    Link: https://anuradhapura-survey.vercel.app/
echo.
pause
