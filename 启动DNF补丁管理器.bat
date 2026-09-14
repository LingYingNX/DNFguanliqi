@echo off
setlocal

cd /d "%~dp0"
set "DNF_PROJECT_ROOT=%CD%"
set "ELECTRON_EXE=%CD%\node_modules\electron\dist\electron.exe"
set "LAUNCHER_LOG=%CD%\data\launcher.log"
set "PNPM_CMD="

if not exist "%CD%\data" mkdir "%CD%\data" >nul 2>nul
>>"%LAUNCHER_LOG%" echo [%date% %time%] Launcher starting from %CD%

where pnpm >nul 2>nul
if not errorlevel 1 set "PNPM_CMD=pnpm"
if not defined PNPM_CMD if exist "%ProgramFiles%\nodejs\corepack.cmd" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  set "PNPM_CMD=corepack pnpm"
)

if not exist "%ELECTRON_EXE%" (
  if not defined PNPM_CMD (
    echo Electron is missing, and pnpm/Corepack is unavailable.
    >>"%LAUNCHER_LOG%" echo [%date% %time%] ERROR: Electron is missing and pnpm/Corepack are unavailable.
    pause
    exit /b 1
  )
  echo Electron runtime is missing. Installing project dependencies...
  call %PNPM_CMD% install --frozen-lockfile
  if errorlevel 1 exit /b %errorlevel%
)

if not exist "%ELECTRON_EXE%" (
  echo Electron binary is missing. Downloading the runtime...
  call %PNPM_CMD% exec electron --version >nul 2>nul
  if errorlevel 1 (
    echo Electron runtime could not be prepared.
    exit /b 1
  )
)

if not exist "%ELECTRON_EXE%" (
  echo Electron runtime is still missing after installation.
  >>"%LAUNCHER_LOG%" echo [%date% %time%] ERROR: Electron runtime is still missing after installation.
  pause
  exit /b 1
)

set "BUILD_OUTPUT_STALE="
if not exist "out\main\main.js" set "BUILD_OUTPUT_STALE=1"
if exist "out\main\main.js" if defined PNPM_CMD (
  for /f "delims=" %%I in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:DNF_PROJECT_ROOT; $out=(Get-Item -LiteralPath (Join-Path $root 'out\main\main.js')).LastWriteTimeUtc; $source=(Get-ChildItem -LiteralPath (Join-Path $root 'src') -Recurse -File -Include *.ts,*.tsx,*.css | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1).LastWriteTimeUtc; [int]($source -gt $out)"') do if "%%I"=="1" set "BUILD_OUTPUT_STALE=1"
)

if defined BUILD_OUTPUT_STALE (
  if not defined PNPM_CMD (
    echo Build output is missing or stale, and pnpm/Corepack is unavailable.
    >>"%LAUNCHER_LOG%" echo [%date% %time%] ERROR: Build output is missing or stale and pnpm/Corepack are unavailable.
    pause
    exit /b 1
  )
  echo Build output is missing or stale. Building the application...
  call %PNPM_CMD% build
  if errorlevel 1 exit /b %errorlevel%
)

if /i "%~1"=="--check" (
  echo Launcher check passed.
  echo Project: %CD%
  echo Electron: %ELECTRON_EXE%
  exit /b 0
)

echo Starting application. Log: %LAUNCHER_LOG%
>>"%LAUNCHER_LOG%" echo [%date% %time%] Starting Electron: %ELECTRON_EXE%
"%ELECTRON_EXE%" "%CD%" >>"%LAUNCHER_LOG%" 2>&1
set "EXIT_CODE=%errorlevel%"
if not "%EXIT_CODE%"=="0" (
  echo Application exited with code %EXIT_CODE%.
  echo See %LAUNCHER_LOG% for details.
  >>"%LAUNCHER_LOG%" echo [%date% %time%] ERROR: Electron exited with code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%
