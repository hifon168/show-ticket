@echo off
REM ============================================================
REM  One-click start: MySQL -> Backend(3001, hosts frontend dist)
REM  Open browser: http://localhost:3001
REM ============================================================

set MYSQL_HOME=C:\Users\zfx\.workbuddy\binaries\mysql\mysql-8.0.36-winx64
set PROJECT_DIR=%~dp0
set MYSQL_DATA=%MYSQL_HOME%\data

echo [1/3] Starting MySQL ...
netstat -ano | findstr ":3306" | findstr "LISTENING" >nul
if errorlevel 1 (
  if not exist "%MYSQL_DATA%\auto.cnf" (
    echo Initializing data directory (first run) ...
    "%MYSQL_HOME%\bin\mysqld.exe" --initialize-insecure --datadir="%MYSQL_DATA%" --console
  )
  start "MySQL" /MIN "%MYSQL_HOME%\bin\mysqld.exe" --datadir="%MYSQL_DATA%" --port=3306
  echo Waiting for MySQL to be ready ...
  timeout /t 10 /nobreak >nul
) else (
  echo MySQL already running.
)

echo [2/3] Starting backend on :3001 ...
start "show-ticket-api" cmd /c "cd /d %PROJECT_DIR%server && npm start"
timeout /t 6 /nobreak >nul

echo [3/3] Opening browser ...
start http://localhost:3001

echo.
echo Done. If the page is blank, wait a few seconds and refresh.
echo Admin: 13800000000 / admin123
pause
