@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title AquaGuard 青羽守护 - 一键打包安装包

cd /d "%~dp0"

echo ============================================================
echo   AquaGuard 青羽守护 - 一键打包
echo   双击本文件，自动生成安装包 exe，全程无需手动操作
echo ============================================================
echo.

set "NODE_VER=20.18.0"
set "WORK=%LOCALAPPDATA%\aquaguard_build"
set "NODE_DIR=%WORK%\node-v%NODE_VER%-win-x64"
set "MIRROR_NODE=https://npmmirror.com/mirrors/node/v%NODE_VER%/node-v%NODE_VER%-win-x64.zip"
set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"

REM ------------------------------------------------------------
REM 1. Node.js
REM ------------------------------------------------------------
echo [1/4] 检查 Node.js ...
where node >nul 2>nul
if not errorlevel 1 (
    for /f "delims=" %%v in ('node -v') do echo    已安装 Node %%v，跳过下载
    goto :node_ready
)

if exist "%NODE_DIR%\node.exe" (
    echo    使用上次下载的 Node 运行时
    goto :node_ready
)

echo    未检测到 Node.js，正在自动下载（约 30MB，只需一次）...
if not exist "%WORK%" mkdir "%WORK%" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%MIRROR_NODE%' -OutFile '%WORK%\node.zip' -UseBasicParsing"
if not exist "%WORK%\node.zip" (
    echo    [错误] Node.js 下载失败，请检查网络后重试
    pause & exit /b 1
)
echo    正在解压 ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%WORK%\node.zip' -DestinationPath '%WORK%' -Force"
if not exist "%NODE_DIR%\node.exe" (
    echo    [错误] Node.js 解压失败
    pause & exit /b 1
)
echo    完成

:node_ready
if exist "%NODE_DIR%\node.exe" set "PATH=%NODE_DIR%;%PATH%"
set "NPM_CMD=npm"
if exist "%NODE_DIR%\npm.cmd" set "NPM_CMD=%NODE_DIR%\npm.cmd"

echo.

REM ------------------------------------------------------------
REM 2. 安装依赖
REM ------------------------------------------------------------
echo [2/4] 安装依赖（首次约需 3-5 分钟，会下载 Electron）...
call "%NPM_CMD%" config set registry https://registry.npmmirror.com >nul 2>nul
call "%NPM_CMD%" install --no-audit --no-fund
if errorlevel 1 (
    echo    [错误] 依赖安装失败，请检查网络后重试
    pause & exit /b 1
)
echo    完成
echo.

REM ------------------------------------------------------------
REM 3. 打包程序
REM ------------------------------------------------------------
echo [3/4] 打包程序 ...
if exist "dist" rmdir /s /q "dist" >nul 2>nul
call npx --no-install electron-builder --win --x64
if errorlevel 1 (
    echo    [错误] 打包失败
    pause & exit /b 1
)
echo    完成
echo.

REM ------------------------------------------------------------
REM 4. 检查产物
REM ------------------------------------------------------------
echo [4/4] 检查安装包 ...
set "SETUP="
for %%f in ("dist\AquaGuard-Setup-*.exe") do set "SETUP=%%~ff"

if not defined SETUP (
    echo    [提示] 没有生成安装包，但绿色版已就绪：
    echo          %CD%\dist\win-unpacked\AquaGuard.exe
    echo          可直接双击运行，或把整个 win-unpacked 文件夹拷给别人用。
    pause & exit /b 0
)

echo.
echo ============================================================
echo   打包完成！
echo.
echo   安装包：!SETUP!
echo.
echo   双击这个 exe 就能安装到任何一台 Windows 电脑。
echo ============================================================
echo.
start "" explorer /select,"!SETUP!"
pause
