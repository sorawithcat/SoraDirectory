@echo off
chcp 65001 >nul
title SoraDirectory 本地服务器

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Python，请先安装 Python
    echo 下载地址: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo [提示] 正在启动本地服务器...
echo [提示] 服务器启动后会自动打开浏览器
echo.
echo [提示] 按 Ctrl+C 可以停止服务器
echo ========================================
echo.

start "" cmd /c "timeout /t 1 /nobreak >nul && start http://127.0.0.1:8080/SoraDirectory.html"

python -m http.server 8080

pause

