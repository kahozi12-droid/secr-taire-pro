@echo off
REM Adds a shortcut in the Windows Startup folder so the agent launches at login.
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set TARGET=%~dp0start.bat

echo Creation du raccourci de demarrage automatique...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%STARTUP%\DigiCab Agent.lnk'); $s.TargetPath='%TARGET%'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()"

echo.
echo OK. L'agent demarrera automatiquement a la prochaine ouverture de session Windows.
pause
