@echo off
setlocal EnableDelayedExpansion
title Backup Branch

cd /d "%~dp0"

set TODAY=
for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value 2^>nul') do set TODAY=%%i
if "!TODAY!"=="" set TODAY=20250101
set TODAY=!TODAY:~0,8!

set "BRANCH=backup/!TODAY!"

set "GIT=git"
where git >nul 2>nul
if errorlevel 1 (
    if exist "C:\Program Files\Git\bin\git.exe" (
        set "GIT=C:\Program Files\Git\bin\git.exe"
    ) else (
        echo [ERROR] Git not found.
        goto end
    )
)

echo.
echo === Backup branch: !BRANCH! ===
echo.

"%GIT%" checkout -b "!BRANCH!"
if errorlevel 1 (
    echo Branch !BRANCH! may already exist.
    goto end
)

"%GIT%" add -A
"%GIT%" diff --cached --quiet
if errorlevel 1 (
    "%GIT%" commit -m "backup: !TODAY!"
    echo Saved to branch: !BRANCH!
) else (
    "%GIT%" commit -m "backup: !TODAY! empty" --allow-empty
    echo Empty backup: !BRANCH!
)

"%GIT%" checkout main
echo.
echo Done. Close this window when ready.

:end
echo.
pause


