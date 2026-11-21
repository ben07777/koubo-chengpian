@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
rem 免安装包用包里自带的 Python（runtime\python）；源码包用 安装依赖.cmd 建的 .venv。
rem 用包里自带的 Python 时，顺手清掉几个会让出片浏览器的驱动改用别处程序、改行为的变量，只在这个窗口里生效。
set "PY=runtime\python\python.exe"
if exist "%PY%" for %%V in (PLAYWRIGHT_NODEJS_PATH PLAYWRIGHT_BROWSERS_PATH PWDEBUG DEBUG NODE_OPTIONS NODE_PATH NODE_EXTRA_CA_CERTS) do set "%%V="
if not exist "%PY%" set "PY=.venv\Scripts\python.exe"
if not exist "%PY%" (echo 找不到软件要用的 Python。免安装包要先解压，再到解出来的文件夹里双击；源码包请先双击 安装依赖.cmd。& echo 按任意键关掉这个窗口。& pause >nul & exit /b 1)
rem 11-13：包里不带预编文件，分词组件每次起来现编，会冒一串英文的语法提醒（不影响出片），这里只关这一类提醒。
rem 11-20：不留黑框。用同一个夹子里的 pythonw.exe（Python 自带的、不开窗口的那一个）在后台跑，这个窗口等它起来就自己关。
rem   原来黑框里打印的话，改写进 runtime\运行记录.txt；退出改成点首页右上角的「关掉软件」。没有 pythonw.exe 的，照老样子在这个窗口里跑。
for %%P in ("%PY%") do set "PYW=%%~dpPpythonw.exe"
if not exist "%PYW%" goto inwindow
if not exist runtime mkdir runtime
del /q runtime\ready.flag runtime\start_error.txt 2>nul
start "" "%PYW%" -B -W ignore::SyntaxWarning -X utf8 app\server.py %*
set /a N=0
:wait
if exist runtime\ready.flag exit /b 0
if exist runtime\start_error.txt goto failed
set /a N+=1
if %N% geq 60 goto slow
timeout /t 1 /nobreak >nul
goto wait
:failed
echo.
type runtime\start_error.txt
echo.
echo 按任意键关掉这个窗口。
pause >nul
exit /b 1
:slow
echo.
echo 软件等了一分钟还没起来。
echo 要是浏览器里已经打开了口播成片的首页，关掉这个窗口就行。
echo 要是没打开，请把这个文件发给我们：%cd%\runtime\运行记录.txt
echo.
echo 按任意键关掉这个窗口。
pause >nul
exit /b 1
:inwindow
"%PY%" -B -W ignore::SyntaxWarning -X utf8 app\server.py %*
if errorlevel 1 (echo 按任意键关掉这个窗口。& pause >nul & exit /b 1)
