@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title AquaGuard 打包工具

echo ============================================================
echo   AquaGuard 青羽守护 — Windows 一键打包
echo ============================================================
echo.

cd /d "%~dp0.."

echo [1/4] 检查 Node.js ...
where node >nul 2>nul
if errorlevel 1 (
    echo   [错误] 没有检测到 Node.js，请先到 https://nodejs.org 安装 LTS 版本
    pause & exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo   Node %%v
echo.

echo [2/4] 安装依赖（首次较慢，会下载 Electron）...
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo   [错误] 依赖安装失败
    pause & exit /b 1
)
echo.

echo [3/4] 打包程序（electron-builder，生成 dist\win-unpacked）...
call npx electron-builder --win --dir
if errorlevel 1 (
    echo   [错误] 打包失败
    pause & exit /b 1
)
echo.

echo [4/4] 用 Inno Setup 生成安装包 ...
set "ISCC="
for %%p in (
    "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
    "%ProgramFiles%\Inno Setup 6\ISCC.exe"
    "%ProgramFiles(x86)%\Inno Setup 5\ISCC.exe"
) do (
    if exist %%p set "ISCC=%%~p"
)

if not defined ISCC (
    echo   [提示] 没有找到 Inno Setup。
    echo   请到 https://jrsoftware.org/isdl.php 下载安装 Inno Setup 6，
    echo   安装后重新运行本脚本，或直接用 Inno Setup 打开 build\installer.iss 手动编译。
    echo.
    echo   程序本体已打包完成：dist\win-unpacked\AquaGuard.exe
    pause & exit /b 0
)

echo   使用：!ISCC!
call "!ISCC!" "build\installer.iss"
if errorlevel 1 (
    echo   [错误] Inno Setup 编译失败
    pause & exit /b 1
)

echo.
echo ============================================================
echo   完成！安装包在 dist\AquaGuard-Setup-1.0.0.exe
echo ============================================================
pause