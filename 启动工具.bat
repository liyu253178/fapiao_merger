@echo off
chcp 65001 >nul
title 发票合并排版工具
cd /d "%~dp0"

echo ========================================
echo   发票合并排版工具
echo ========================================
echo.
echo 正在启动服务...
echo.

start "" http://localhost:9988
node.exe server-entry.js

echo.
echo 服务已停止
pause