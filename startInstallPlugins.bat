@echo off
echo Starting PowerShell plugin installation script...

:: Navigate to the directory where this BAT file is located
CD /D "%~dp0"

:: Execute the PowerShell script from the current directory
:: -ExecutionPolicy Bypass allows the script to run even if restricted
powershell.exe -ExecutionPolicy Bypass -File "install_plugins.ps1"

echo Script execution finished.
pause
