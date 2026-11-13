@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
rem 免安装包用包里自带的 Python（runtime\python）；源码包用 安装依赖.cmd 建的 .venv。
rem 用包里自带的 Python 时，顺手清掉几个会让出片浏览器的驱动改用别处程序、改行为的变量，只在这个窗口里生效。
set "PY=runtime\python\python.exe"
if exist "%PY%" for %%V in (PLAYWRIGHT_NODEJS_PATH PLAYWRIGHT_BROWSERS_PATH PWDEBUG DEBUG NODE_OPTIONS NODE_PATH NODE_EXTRA_CA_CERTS) do set "%%V="
if not exist "%PY%" set "PY=.venv\Scripts\python.exe"
if not exist "%PY%" (echo 找不到软件要用的 Python。免安装包要先解压，再到解出来的文件夹里双击；源码包请先双击 安装依赖.cmd。& pause & exit /b 1)
rem 11-13：包里不带预编文件，分词组件每次起来现编，会冒一串英文的语法提醒（不影响出片），这里只关这一类提醒。
"%PY%" -B -W ignore::SyntaxWarning -X utf8 app\server.py %*
if errorlevel 1 (pause & exit /b 1)
