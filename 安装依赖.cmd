@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where ffmpeg >nul 2>&1
if errorlevel 1 (echo 请先安装 FFmpeg 并加入 PATH，见 安装与使用.md。& goto fail)
py -3.13 -m venv .venv
if errorlevel 1 (echo 请先安装 64 位 Python 3.13，并启用 py 启动器。& goto fail)
echo 正在下载软件要用的组件，大约十几分钟，窗口里还在滚字就别关。
".venv\Scripts\python.exe" -m pip install --default-timeout=60 -r requirements.txt
if not errorlevel 1 goto pipok
echo.
echo 下载没成功，换国内下载源再试一次……
".venv\Scripts\python.exe" -m pip install --default-timeout=60 -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
if errorlevel 1 (echo 还是没下下来，多半是网速慢。换个时间再双击一次 安装依赖.cmd。& goto fail)
:pipok
".venv\Scripts\python.exe" -X utf8 app\assets.py --install
if errorlevel 1 goto fail
echo 安装完成。现在可以双击 剪一条.cmd。
pause
exit /b 0
:fail
pause
exit /b 1
