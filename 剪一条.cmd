@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (echo 请先运行 安装依赖.cmd。& pause & exit /b 1)
".venv\Scripts\python.exe" -B -X utf8 app\server.py %*
if errorlevel 1 (pause & exit /b 1)

