@echo off
cd /d "%~dp0"
python test_paymongo_sandbox.py > sand.log 2>&1
echo EXIT=%ERRORLEVEL%
type sand.log