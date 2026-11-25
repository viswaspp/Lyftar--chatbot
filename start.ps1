# Lyftr — Start Script
# Usage: Right-click in Explorer -> "Run with PowerShell", OR paste into a PowerShell terminal

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Lyftr — Local Startup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Prompt for API keys if not already set ─────────────────────────
if (-not $env:LLM_API_KEYS) {
    Write-Host "No LLM_API_KEYS found in environment." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You need at least 2 API keys (comma-separated)." -ForegroundColor Yellow
    Write-Host "Supported providers:" -ForegroundColor Yellow
    Write-Host "  Gemini  → get a free key at https://aistudio.google.com/apikey" -ForegroundColor Green
    Write-Host "  OpenAI  → https://platform.openai.com/api-keys" -ForegroundColor Green
    Write-Host "  Groq    → https://console.groq.com/keys (free tier)" -ForegroundColor Green
    Write-Host ""
    $keys = Read-Host "Paste your two keys separated by a comma (e.g. key1,key2)"
    $env:LLM_API_KEYS = $keys.Trim()
}

if (-not $env:LLM_API_KEYS) {
    Write-Host "No keys provided. Exiting." -ForegroundColor Red
    exit 1
}

# ── 2. Set all required env vars ───────────────────────────────────────
$env:DATABASE_URL              = "sqlite:///./data/app.db"
$env:ALLOWED_ORIGINS           = "http://localhost:3000"
$env:ENABLE_FAILURE_SIMULATION = "true"
$env:LLM_MODEL                 = "gemini/gemini-3.5-flash-lite"
$env:LITELLM_LOCAL_MODEL_COST_MAP = "True"
$env:VITE_API_BASE_URL         = "http://localhost:8000"

Write-Host "Keys configured. Starting services..." -ForegroundColor Green
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── 3. Start backend in a new terminal window ──────────────────────────
$beArgs = "-NoExit -Command `"" +
    "cd '$root\backend'; " +
    "`$env:LLM_API_KEYS='$env:LLM_API_KEYS'; " +
    "`$env:DATABASE_URL='sqlite:///./data/app.db'; " +
    "`$env:ALLOWED_ORIGINS='http://localhost:3000'; " +
    "`$env:ENABLE_FAILURE_SIMULATION='true'; " +
    "`$env:LLM_MODEL='gemini/gemini-3.5-flash-lite'; " +
    "`$env:LITELLM_LOCAL_MODEL_COST_MAP='True'; " +
    "Write-Host 'Backend starting on http://localhost:8000' -ForegroundColor Cyan; " +
    ".\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`""
Start-Process powershell.exe -ArgumentList $beArgs

# ── 4. Start frontend in a new terminal window ─────────────────────────
$feArgs = "-NoExit -Command `"" +
    "cd '$root\frontend'; " +
    "`$env:VITE_API_BASE_URL='http://localhost:8000'; " +
    "Write-Host 'Frontend starting on http://localhost:3000' -ForegroundColor Cyan; " +
    "npm.cmd run dev`""
Start-Process powershell.exe -ArgumentList $feArgs

Write-Host ""
Write-Host "Two terminal windows have been opened:" -ForegroundColor Green
Write-Host "  Backend  -> http://localhost:8000" -ForegroundColor White
Write-Host "  Frontend -> http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Wait ~5-15 seconds for the backend to load, then open:" -ForegroundColor Yellow
Write-Host "  http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "To run tests (no API keys needed):" -ForegroundColor Yellow
Write-Host "  cd backend; .\.venv\Scripts\python.exe -m pytest -v" -ForegroundColor White
Write-Host ""
