# ═══════════════════════════════════════════════════════════════
# 🚀 NEW COMPANY — FULL AUTO (VS Code se hi, console kholne ki zaroorat nahi)
#
# USE (har nayi company ke liye ek hi command):
#   cd C:\Users\Rahul\Fcoy
#   powershell -ExecutionPolicy Bypass -File deploy\New-CompanyApp.ps1 -Code bcoy
#
# Ye script KHUD kar degi:
#   1. Firebase project create          (gcloud)
#   2. Zaroori APIs ON                  (firebase/hosting/firestore/auth)
#   3. Firestore DB create (asia-south1)
#   4. Email/Password login ON          (REST API)
#   5. Web app register + config keys read
#   6. deploy\companies.json AUTO-UPDATE (keys apne aap bhar jayengi)
#   7. Build + Deploy (hosting + rules) → company app LIVE
#
# ONE-TIME SETUP (zindagi me ek baar):
#   winget install -e --id Google.CloudSDK
#   (terminal band karke naya kholna) phir:
#   gcloud auth login        → browser me apna Google login
#   firebase login           → wahi Google login
#
# Optional: -ProjectId fcoy-erp-bcoy-74603  (agar default ID taken ho)
#           -SkipDeploy                      (sirf project banao, deploy baad me)
# ═══════════════════════════════════════════════════════════════
param(
  [Parameter(Mandatory=$true)][string]$Code,
  [string]$ProjectId = "",
  [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Fail([string]$m) { throw "❌ $m" }

# ── Registry ──
$regPath = "deploy\companies.json"
$registry = Get-Content $regPath -Raw | ConvertFrom-Json
$company = $registry.$Code
if (-not $company) { Fail "companies.json me '$Code' nahi mila." }
if ($company.alreadyDeployed -eq $true) { Fail "'$Code' = MASTER APP hai — ye uske liye nahi." }

$projId = $ProjectId
if (-not $projId) { $projId = [string]$company.projectId }
if (-not $projId) { $projId = "fcoy-erp-$Code" }
$projId = $projId.Trim()

Write-Host ""
Write-Host "════════ 🚀 NEW COMPANY AUTO-SETUP ════════" -ForegroundColor Cyan
Write-Host "Company : $($company.name)"
Write-Host "Project : $projId"
Write-Host ""

# ── Prereqs ──
foreach ($cmd in 'node','npm','firebase','gcloud') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    if ($cmd -eq 'gcloud') { Fail "gcloud nahi mila. ONE-TIME install:  winget install -e --id Google.CloudSDK  → terminal band → naya terminal → gcloud auth login" }
    Fail "$cmd installed nahi hai."
  }
}

$token = $null
try { $token = ((& gcloud auth print-access-token 2>$null) | Select-Object -First 1).Trim() } catch { $token = $null }
if (-not $token) { Fail "gcloud login nahi hai. Pehle chalao:  gcloud auth login" }
$headers = @{ Authorization = "Bearer $token" }

# ── 1. Project create (idempotent) ──
Write-Host "▶ 1/7 Firebase project check/create..." -ForegroundColor Yellow
& gcloud projects describe $projId --format="value(projectId)" 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "  ✓ Project pehle se maujood hai — aage badh rahe" -ForegroundColor DarkGray
} else {
  & gcloud projects create $projId --name="$($company.name)" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "Project create fail — '$projId' shayad duniya me kisi aur ka hai (IDs globally unique hoti hain). Dobara try: -ProjectId fcoy-erp-$Code-74603" }
  Write-Host "  ✓ Project ban gaya" -ForegroundColor Green
}

# ── 2. APIs ──
Write-Host "▶ 2/7 APIs enable (firebase/hosting/firestore/auth)..." -ForegroundColor Yellow
& gcloud services enable firebase.googleapis.com firebasehosting.googleapis.com firestore.googleapis.com identitytoolkit.googleapis.com --project $projId --quiet 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "APIs enable fail — Google account me projects banane ki permission check karo" }
Write-Host "  ✓ APIs ON" -ForegroundColor Green

# ── 3. Firestore DB ──
Write-Host "▶ 3/7 Firestore database (asia-south1)..." -ForegroundColor Yellow
& gcloud firestore databases create --location=asia-south1 --project $projId --quiet 2>$null | Out-Null
Write-Host "  ✓ Firestore ready (ya pehle se tha)" -ForegroundColor Green
Start-Sleep -Seconds 8

# ── 4. Email/Password auth ──
Write-Host "▶ 4/7 Email/Password login ON..." -ForegroundColor Yellow
$authBody = @{ signIn = @{ email = @{ enabled = $true; passwordRequired = $true } } } | ConvertTo-Json -Depth 5
try {
  Invoke-RestMethod -Method Patch `
    -Uri "https://identitytoolkit.googleapis.com/admin/v2/projects/$projId/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired" `
    -Headers $headers -ContentType 'application/json' -Body $authBody | Out-Null
  Write-Host "  ✓ Email/Password ON" -ForegroundColor Green
} catch { Fail "Auth enable fail: $($_.Exception.Message)" }

# ── 5. Web app + keys ──
Write-Host "▶ 5/7 Web app register..." -ForegroundColor Yellow
$appId = $null
try {
  $out = (& firebase apps:create WEB "$Code-web" --project $projId --json 2>$null) | Out-String
  $appId = ($out | ConvertFrom-Json).result.appId
} catch { $appId = $null }

if (-not $appId) {
  # Shayad pehle se bani hai — list me se lo
  try {
    $listOut = (& firebase apps:list --project $projId --json 2>$null) | Out-String
    $apps = ($listOut | ConvertFrom-Json).result
    if ($apps -and $apps.Count -gt 0) { $appId = $apps[0].appId }
  } catch { }
}
if (-not $appId) { Fail "Web app create/find fail — 'firebase login --reauth' chala ke dobara try karo" }
Write-Host "  ✓ Web app: $appId" -ForegroundColor Green

Write-Host "▶ 6/7 Config keys read + companies.json update..." -ForegroundColor Yellow
$sdk = $null
try {
  $cfgOut = (& firebase apps:sdkconfig WEB $appId --project $projId --json 2>$null) | Out-String
  $sdk = ($cfgOut | ConvertFrom-Json).result.sdkConfig
} catch { $sdk = $null }
if (-not $sdk) { Fail "SDK config read fail — firebase CLI update: npm i -g firebase-tools" }

$company.projectId          = [string]$sdk.projectId
$company.apiKey             = [string]$sdk.apiKey
$company.authDomain         = [string]$sdk.authDomain
$company.storageBucket      = [string]$sdk.storageBucket
$company.messagingSenderId  = [string]$sdk.messagingSenderId
$company.appId              = [string]$sdk.appId
$registry | ConvertTo-Json -Depth 8 | Set-Content $regPath -Encoding utf8
Write-Host "  ✓ companies.json auto-update ho gaya (keys bhar gayi)" -ForegroundColor Green

# ── 7. Deploy ──
if (-not $SkipDeploy) {
  Write-Host "▶ 7/7 Build + Deploy..." -ForegroundColor Yellow
  & powershell -ExecutionPolicy Bypass -File "deploy\Deploy-Company.ps1" -Code $Code
  if ($LASTEXITCODE -ne 0) { Fail "Deploy step fail — upar error dekho" }
}

Write-Host ""
Write-Host "════════════════ ✅ COMPANY READY: $($company.name) ════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Ab sirf WIZARD baki hai (2 min):" -ForegroundColor Cyan
Write-Host "  1. Kholo → https://$projId.web.app/first-run"
Write-Host "  2. Form bharo (unit/CC/plan) → Setup Complete Karo"
Write-Host "  3. CC login company ko de do 🎉"
Write-Host "  4. Master app me 🌐 Remote customer record + plan assign (billing)"
Write-Host ""
