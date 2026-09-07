@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-local-secure.ps1"
exit /b %ERRORLEVEL%
