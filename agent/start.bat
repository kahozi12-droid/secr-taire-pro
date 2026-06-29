@echo off
title DigiCab Local Agent
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERREUR] Node.js n'est pas installe.
  echo Telecharge-le ici : https://nodejs.org/   ^(version LTS^)
  echo Puis relance ce fichier.
  echo.
  pause
  exit /b 1
)

echo Demarrage de l'agent DigiCab...
node server.cjs
pause
