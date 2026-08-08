# ===============================================================
# NEW COMPANY - FULL AUTO (VS Code se hi, console kholne ki zaroorat nahi)
#
# USE:
#   cd C:\Users\Rahul\Fcoy
#   powershell -ExecutionPolicy Bypass -File deploy\New-CompanyApp.ps1 -Code bcoy
#
# Ye script 7 kaam karti hai:
#   1. Firebase project create      (gcloud)
#   2. Jaroori APIs enable          (firebase/hosting/firestore/auth)
#   3. Firestore database create    (asia-south1)
#   4. Email/Password login ON      (Identity Toolkit REST API)
#   5. Web app register + config keys read
#   6. deploy\companies.json me keys AUTO-update
#   7. Build + Deploy (hosting + rules) -> company app LIVE
#
# ONE-TIME taiyaari (sirf pehli baar):
#   winget install -e --id Google.CloudSDK
#   -> VS Code / terminal band karke NAYA terminal kholo
#   gcloud auth login        (browser me apna Google login)
#   firebase login           (wahi Google login)
#
# NOTE: $ErrorActionPreference = 'Continue' RAKHA GAYA HAI (Stop nahi!).
# PS5.1 me native command (gcloud/npm) ka stderr output Stop preference ke
# saath NativeCommandError maar deta hai - isliye har step pe $LASTEXITCODE
# manually check hota hai.
# ===============================================================
param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9]+$')][string]$Code,
  [string]$ProjectId = '',
  [switch]$SkipDeploy
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Fail([string]$m) { throw "[X] $m" }

# -- Registry padho --
$registryPath = "deploy\companies.json"
$registry = Get-Content $registryPath -Raw -ErrorAction Stop | ConvertFrom-Json
$company = $registry.$Code
if (-not $company) {
  $names = $registry.PSObject.Properties.Name -join ', '
  Fail "companies.json me '$Code' nahi mila. Available: $names"
}
if ($company.alreadyDeployed -eq $true) { Fail "'$Code' = MASTER APP hai - ye uske liye nahi." }

# -- Project ID decide (command > registry > default) --
$projId = $ProjectId
if ([string]::IsNullOrWhiteSpace($projId)) { $projId = "$($company.projectId)".Trim() }
if ([string]::IsNullOrWhiteSpace($projId)) { $projId = "fcoy-erp-$Code" }

Write-Host ""
Write-Host "========  NEW COMPANY AUTO-SETUP  ========" -ForegroundColor Cyan
Write-Host "Company : $($company.name)"
Write-Host "Code    : $Code"
Write-Host "Project : $projId   (agar ye ID duniya me li hui hui to: -ProjectId fcoy-erp-$Code-74603)"
Write-Host ""

# -- Prereqs --
foreach ($cmd in 'gcloud','firebase') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    if ($cmd -eq 'gcloud') {
      Fail "gcloud nahi mila. ONE-TIME: winget install -e --id Google.CloudSDK -> terminal band -> naya terminal -> gcloud auth login -> script dobara chalao"
    }
    Fail "$cmd CLI nahi mila. npm i -g firebase-tools chala ke 'firebase login' karo"
  }
}

# -- 1. Project create (idempotent) --
Write-Host ">> 1/7 Firebase project check/create..." -ForegroundColor Yellow
# cmd /c wrapper: native stderr se script NAHI maregi
cmd /c "gcloud projects describe $projId --quiet >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  Write-Host "  Project nahi mila - bana rahe hain..." -ForegroundColor DarkGray
  # GCP rule: display name me sirf letters/numbers/space/hyphen/!/quote allowed, max 30 chars.
  # "B Coy (Bravo Company)" -> "B Coy Bravo Company"  (parentheses hatao)
  $dispName = ("$($company.name)" -replace "[^a-zA-Z0-9 \-!']", "").Trim()
  if ($dispName.Length -gt 30) { $dispName = $dispName.Substring(0, 30).Trim() }
  if ([string]::IsNullOrWhiteSpace($dispName)) { $dispName = $projId }
  gcloud projects create $projId --name $dispName --quiet
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  [!] Project '$projId' nahi ban saka. Upar ka ERROR padho:" -ForegroundColor Red
    Write-Host "      - Agar 'already in use'/'already exists' likha hai -> ye ID kisi aur ka hai:"
    Write-Host "        powershell -ExecutionPolicy Bypass -File deploy\New-CompanyApp.ps1 -Code $Code -ProjectId fcoy-erp-$Code-74603"
    Write-Host "      - Agar 'quota'/'permission' aaya hai -> Google account me kam se kam 1 naya project banane ki
        permission chahiye (naye Google accounts pe limit 5-30 projects hoti hai)"
    Fail "Project create fail - upar ka red ERROR screen copy karke paste karo"
  }
  Write-Host "  [OK] Project ban gaya" -ForegroundColor Green
} else {
  Write-Host "  [OK] Project pehle se maujood hai - aage badh rahe" -ForegroundColor DarkGray
}

# -- 2. APIs enable --
Write-Host ">> 2/7 APIs enable (firebase/hosting/firestore/auth)..." -ForegroundColor Yellow
gcloud services enable firebase.googleapis.com firebasehosting.googleapis.com firestore.googleapis.com identitytoolkit.googleapis.com --project $projId --quiet
if ($LASTEXITCODE -ne 0) { Fail "APIs enable fail - Google account me project banane ki permission check karo" }
Write-Host "  [OK] APIs ON" -ForegroundColor Green

# -- 3. Firestore database --
Write-Host ">> 3/7 Firestore database (asia-south1)..." -ForegroundColor Yellow
cmd /c "gcloud firestore databases create --location=asia-south1 --project $projId --quiet >nul 2>&1"
# pehle se bana ho to bhi OK
Write-Host "  [OK] Firestore ready (ya pehle se tha)" -ForegroundColor Green

# -- 4. Email/Password login ON --
Write-Host ">> 4/7 Email/Password login ON..." -ForegroundColor Yellow

# Google ka ASLI error message nikaaltta hai (PS5.1 ErrorDetails khaali hota hai)
function Get-ErrBody([System.Exception]$e) {
  try {
    $r = $null
    if ($e.Response) { $r = $e.Response }
    elseif ($e.InnerException -and $e.InnerException.Response) { $r = $e.InnerException.Response }
    if ($r) {
      $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
      $txt = $sr.ReadToEnd()
      return "$txt"
    }
  } catch {}
  return ""
}

$token = (gcloud auth print-access-token | Select-Object -First 1).Trim()
$headers = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $projId }

# 4a. Diagnosis: kya token se Firebase API chalti hai?
Write-Host "  (Diagnosis: Firebase API access test...)" -ForegroundColor DarkGray
try {
  $null = Invoke-RestMethod -Method Get -Uri "https://firebase.googleapis.com/v1beta1/projects/$projId" -Headers $headers -ErrorAction Stop
  Write-Host "  [OK] Firebase API access chal raha hai" -ForegroundColor Green
} catch {
  $d = Get-ErrBody $_.Exception
  Write-Host "  [!] Firebase API access fail. GOOGLE: $d" -ForegroundColor Red
}

# 4b. GCP project ko FIREBASE project me badlo (identitytoolkit config tabhi kaam karti hai)
Write-Host "  Project ko Firebase se jod rahe hain..." -ForegroundColor DarkGray
try {
  $null = Invoke-RestMethod -Method Post -Uri "https://firebase.googleapis.com/v1beta1/projects/${projId}:addFirebase" -Headers $headers -Body '{}' -ContentType 'application/json' -ErrorAction Stop
  Write-Host "  [OK] Project Firebase se jud gaya" -ForegroundColor Green
} catch {
  $linkBody = Get-ErrBody $_.Exception
  if ($linkBody -match 'already') {
    Write-Host "  [OK] Pehle se Firebase project hai" -ForegroundColor DarkGray
  } else {
    Write-Host "  (Link fail - aage retry karenge. GOOGLE KA JAWAB:)" -ForegroundColor DarkGray
    if ($linkBody) { Write-Host "  $linkBody" -ForegroundColor DarkGray }
  }
}
Start-Sleep -Seconds 10

# Auth config INITIALIZE karna pehli baar sirf console se hota hai
# (Google iska public API nahi deta - 404 CONFIGURATION_NOT_FOUND isliye aata hai)
$body = @{ signIn = @{ email = @{ enabled = $true; passwordRequired = $true } } } | ConvertTo-Json -Depth 5
$patchUrl = "https://identitytoolkit.googleapis.com/admin/v2/projects/$projId/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired"

$authOk = $false
$errBody = ""
for ($round = 1; $round -le 3 -and -not $authOk; $round++) {
  try {
    $null = Invoke-RestMethod -Method Patch -Uri $patchUrl -Headers $headers -Body $body -ContentType 'application/json' -ErrorAction Stop
    $authOk = $true
    break
  } catch {
    $errBody = Get-ErrBody $_.Exception
  }
  if ($errBody -match 'CONFIGURATION_NOT_FOUND') {
    if ($round -eq 1) {
      Write-Host ""
      Write-Host "  [MANUAL 30-SEC STEP] Auth-config initialize karna sirf console se hota hai" -ForegroundColor Yellow
      Write-Host "  (har company ke liye SIRF 1 baar - Google ka rule hai, hamari limitation nahi):" -ForegroundColor Yellow
      Write-Host ""
      Write-Host "    1. Kholo: https://console.firebase.google.com/project/$projId/authentication/providers" -ForegroundColor Cyan
      Write-Host "    2. Agar bada 'Get Started' button dikhe -> pehle USE dabao" -ForegroundColor Cyan
      Write-Host "    3. 'Sign-in method' list me 'Email/Password' -> pehla toggle ENABLE -> Save" -ForegroundColor Cyan
      Write-Host ""
    } else {
      Write-Host "  Abhi bhi CONFIGURATION_NOT_FOUND hai - shayad Save dabana rah gaya?" -ForegroundColor Yellow
    }
    $null = Read-Host "  => Console me kar liya? ENTER dabao (script khud verify karegi)"
  } else {
    Write-Host "  ...try $round/3 fail. GOOGLE KA JAWAB: $errBody" -ForegroundColor DarkGray
    if ($round -lt 3) { Start-Sleep -Seconds 10 }
  }
}
if (-not $authOk) {
  Write-Host ""
  Write-Host "  GOOGLE KA JAWAB (last): $errBody" -ForegroundColor Red
  Fail "Email/Password ON nahi hua. Console step karo: https://console.firebase.google.com/project/$projId/authentication/providers -> phir script dobara chalao (idempotent hai)."
}
Write-Host "  [OK] Email/Password ON" -ForegroundColor Green

# -- 5. Web app register --
Write-Host ">> 5/7 Web app register..." -ForegroundColor Yellow
$appName = "$Code-web"
$raw = firebase apps:create WEB $appName --project $projId --json 2>$null | Out-String
$appId = $null
if ($raw -and $raw.IndexOf('{') -ge 0) {
  try { $appId = (($raw.Substring($raw.IndexOf('{')) | ConvertFrom-Json).result.appId) } catch {}
}
if (-not $appId) {
  # Ho sakta hai app pehle se bani hai - list me se dhoondho
  Write-Host "  App create output me ID nahi mili - existing apps list karke dhoondhte hain..." -ForegroundColor DarkGray
  $raw = firebase apps:list --project $projId --json 2>$null | Out-String
  if ($raw -and $raw.IndexOf('{') -ge 0) {
    try {
      $apps = ($raw.Substring($raw.IndexOf('{')) | ConvertFrom-Json).result
      $web = $apps | Where-Object { $_.platform -eq 'WEB' } | Select-Object -First 1
      $appId = $web.appId
    } catch {}
  }
}
if (-not $appId) { Fail "Web app create/find fail - 'firebase login --reauth' chala ke dobara try karo" }
Write-Host "  [OK] Web app: $appId" -ForegroundColor Green

# -- 6. Config keys read + companies.json auto-update --
Write-Host ">> 6/7 Config keys read + companies.json update..." -ForegroundColor Yellow
$raw = firebase apps:sdkconfig WEB $appId --project $projId --json 2>$null | Out-String
$sdk = $null
if ($raw -and $raw.IndexOf('{') -ge 0) {
  try { $sdk = ($raw.Substring($raw.IndexOf('{')) | ConvertFrom-Json).result.sdkConfig } catch {}
}
if (-not $sdk) { Fail "SDK config read fail - firebase CLI update karo: npm i -g firebase-tools" }

$company.projectId = "$($sdk.projectId)"
$company.apiKey = "$($sdk.apiKey)"
$company.authDomain = "$($sdk.authDomain)"
$company.storageBucket = "$($sdk.storageBucket)"
$company.messagingSenderId = "$($sdk.messagingSenderId)"
$company.appId = "$($sdk.appId)"
$registry | ConvertTo-Json -Depth 8 | Set-Content $registryPath -Encoding UTF8 -ErrorAction Stop
Write-Host "  [OK] companies.json auto-update ho gaya (keys bhar gayi)" -ForegroundColor Green

# -- 7. Build + Deploy --
if (-not $SkipDeploy) {
  Write-Host ">> 7/7 Build + Deploy..." -ForegroundColor Yellow
  powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\Deploy-Company.ps1" -Code $Code
  if ($LASTEXITCODE -ne 0) { Fail "Deploy step fail - upar error dekho" }
} else {
  Write-Host "  (-SkipDeploy diya tha - baad me: powershell -ExecutionPolicy Bypass -File deploy\Deploy-Company.ps1 -Code $Code)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "========  COMPANY READY: $($company.name)  ========" -ForegroundColor Green
Write-Host ""
Write-Host "AB 3 KAAM BACHE (2 minute):" -ForegroundColor Cyan
Write-Host "  1. Kholo -> https://$projId.web.app/first-run"
Write-Host "  2. Form bharo (unit/CC/plan) -> Setup Complete Karo"
Write-Host "  3. Master app -> Owner Panel -> is customer ko SUBSCRIPTION assign karo (billing ledger)"
Write-Host ""
Write-Host "DONE. Company ko URL + CC email/password de do. Wo apna staff/data khud manage karegi." -ForegroundColor Green
Write-Host ""
