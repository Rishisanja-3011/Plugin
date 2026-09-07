$ErrorActionPreference = 'Continue'
Set-Location 'C:\Users\sarth\OneDrive\Desktop\antiplugin\plugin-frontend'
$env:VITE_API_BASE_URL = 'https://api.example.com/api'
$env:VITE_GOOGLE_CLIENT_ID = 'verify-only.apps.googleusercontent.com'

npm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$preview = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','preview','--','--port','4173','--strictPort' -PassThru -WindowStyle Hidden -RedirectStandardOutput 'preview.log' -RedirectStandardError 'preview.err.log'
Start-Sleep -Seconds 6
try {
  node dial-shot.mjs http://127.0.0.1:4173/ ./dial-shots
} finally {
  if ($preview -and -not $preview.HasExited) { Stop-Process -Id $preview.Id -Force }
  Start-Sleep -Seconds 1
  Remove-Item -LiteralPath 'preview.log','preview.err.log' -Force -ErrorAction SilentlyContinue
}
