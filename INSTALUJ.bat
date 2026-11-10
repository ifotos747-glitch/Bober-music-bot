@echo off
cd /d "%~dp0"
npm install
if errorlevel 1 (echo Blad npm install & pause & exit /b 1)
if not exist .env copy .env.example .env
npm run install:ytdlp
pause
