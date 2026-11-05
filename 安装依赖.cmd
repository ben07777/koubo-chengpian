@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where ffmpeg >nul 2>&1
if errorlevel 1 (echo 请先安装 FFmpeg 并加入 PATH，见 安装与使用.md。& goto fail)
py -3.13 -m venv .venv
if errorlevel 1 (echo 请先安装 64 位 Python 3.13，并启用 py 启动器。& goto fail)
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto fail
".venv\Scripts\python.exe" -X utf8 app\assets.py --install
if errorlevel 1 goto fail
echo 安装完成。现在可以双击 剪一条.cmd。
pause
exit /b 0
:fail
pause
exit /b 1

