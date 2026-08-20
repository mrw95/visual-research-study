@echo off
title Push Survey to GitHub
cd /d "%~dp0"

echo.
echo  GitHub repo: https://github.com/mrw95/visual-research-study
echo  (Create this repo on GitHub first if it does not exist — empty, no README)
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo  First time: git init...
  git init -b main
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/mrw95/visual-research-study.git
)

git add -A
git status --short
echo.

set GIT_AUTHOR_NAME=Malki Widanagamage
set GIT_AUTHOR_EMAIL=mr1.widanagamage@gmail.com
set GIT_COMMITTER_NAME=Malki Widanagamage
set GIT_COMMITTER_EMAIL=mr1.widanagamage@gmail.com

git commit -m "Anuradhapura experience survey"
if errorlevel 1 (
  echo  Nothing new to commit.
) else (
  echo  Pushed...
  git push -u origin main
)

echo.
echo  Next: Vercel.com → Import → visual-research-study → Deploy
echo  See DEPLOY-VERCEL.md
echo.
pause
