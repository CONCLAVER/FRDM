$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "[1/5] Checking Node.js..." -ForegroundColor Cyan
node --version
npm --version

Write-Host "[2/5] Installing web dependencies..." -ForegroundColor Cyan
npm install

Write-Host "[3/5] Building React app..." -ForegroundColor Cyan
npm run build

if (-not (Test-Path "android")) {
  Write-Host "[4/5] Creating Android project..." -ForegroundColor Cyan
  npx cap add android
} else {
  Write-Host "[4/5] Android project already exists; syncing..." -ForegroundColor Cyan
}

npx cap sync android

Write-Host "[5/5] Building APK..." -ForegroundColor Cyan
Push-Location android
try {
  if (Test-Path ".\gradlew.bat") {
    .\gradlew.bat assembleDebug --no-daemon
  } else {
    throw "Gradle wrapper was not generated. Run 'npx cap add android' again."
  }
} finally { Pop-Location }

$apk = Join-Path $PSScriptRoot "..\android\app\build\outputs\apk\debug\app-debug.apk"
$apk = [IO.Path]::GetFullPath($apk)
Write-Host ""
Write-Host "APK READY:" -ForegroundColor Green
Write-Host $apk -ForegroundColor Green
