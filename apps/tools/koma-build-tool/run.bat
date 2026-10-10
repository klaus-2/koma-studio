@echo off
REM KOMA Build Tool Launcher
REM Prevents WebView2 stale process conflicts

set "APP_DIR=%~dp0"
set "WV_DATA=%TEMP%\koma-build-tool-webview2"
if not exist "%WV_DATA%" mkdir "%WV_DATA%"

set "WEBVIEW2_USER_DATA_FOLDER=%WV_DATA%"
start "" "%APP_DIR%koma-build-tool.exe"
