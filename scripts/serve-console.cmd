@echo off
cd /d "%~dp0..\apps\web"
node "%~dp0..\node_modules\next\dist\bin\next" start -p 3112
