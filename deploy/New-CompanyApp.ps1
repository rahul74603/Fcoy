# ===============================================================
# NEW COMPANY - FULL AUTO (VS Code se hi, console kholne ki zaroorat nahi)
#
# USE:
#   cd C:\Users\Rahul\Fcoy
#   powershell -ExecutionPolicy Bypass -File deploy\New-CompanyApp.ps1 -Code bcoy
#
# Ye script 8 kaam karti hai:
#   1. Firebase project create      (gcloud)
#   2. Jaroori APIs enable          (firebase/hosting/firestore/auth)
#   3. Firestore database create    (asia-south1)
#   4. Email/Password login ON      (Identity Toolkit REST API)
#   5. Web app register + config keys read
#   6. deploy\companies.json me keys AUTO-update
#   7. SYNC BRIDGE  - master ledger + is app ka LIVE link (sync user + creds)
#   8. Build + Deploy (hosting + rules) -> company app LIVE
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
  [string]$MasterProjectId = 'training-command-erp',
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

# -- 1. Project check (UPDATE mode) ya create --
Write-Host ">> 1/8 Firebase project check/create..." -ForegroundColor Yellow
$acct = (gcloud config get account 2>$null | Out-String).Trim()
Write-Host ("  Google account : " + $acct) -ForegroundColor DarkGray
# cmd /c wrapper: native stderr se script NAHI maregi
cmd /c "gcloud projects describe $projId --quiet >nul 2>&1"
$projExists = ($LASTEXITCODE -eq 0)
if (-not $projExists) {
  # fallback: kabhi kabhi direct describe token glitch se fail hota hai - list se confirm
  $plist = (gcloud projects list --filter="projectId=$projId" --format="value(projectId)" 2>$null | Out-String).Trim()
  if ($plist -eq $projId) { $projExists = $true }
}
if (-not $projExists) {
  Write-Host "  Project nahi mila - bana rahe hain..." -ForegroundColor DarkGray
  # GCP rule: display name me sirf letters/numbers/space/hyphen/!/quote allowed, max 30 chars.
  # "B Coy (Bravo Company)" -> "B Coy Bravo Company"  (parentheses hatao)
  $dispName = ("$($company.name)" -replace "[^a-zA-Z0-9 \-!']", "").Trim()
  if ($dispName.Length -gt 30) { $dispName = $dispName.Substring(0, 30).Trim() }
  if ([string]::IsNullOrWhiteSpace($dispName)) { $dispName = $projId }
  $createOut = (gcloud projects create $projId --name $dispName --quiet 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) {
    if ($createOut -match 'already in use|already exists|ALREADY_EXISTS') {
      Write-Host ""
      Write-Host "  [!] Ye project ID pehle se reserved hai - dobara describe karke dekhte hain..." -ForegroundColor DarkGray
      cmd /c "gcloud projects describe $projId --quiet >nul 2>&1"
      if ($LASTEXITCODE -eq 0) { $projExists = $true }
      else {
        Write-Host ""
        Write-Host "  [X] '$projId' is Google account ('$acct') ka NAHI lag raha." -ForegroundColor Red
        Write-Host "      Jis account se pehle ye project bana tha, usi me login karo:" -ForegroundColor Yellow
        Write-Host "        gcloud auth login        (browser me WOHI account chuno)" -ForegroundColor Yellow
        Write-Host "        firebase login --reauth  (wohi account)" -ForegroundColor Yellow
        Write-Host "      Phir script dobara chalao. Ya nayi ID lo: -ProjectId fcoy-erp-$Code-74603" -ForegroundColor Yellow
        Fail "Galat Google account - login theek karke wapas aao"
      }
    } else {
      Write-Host ""
      Write-Host "  [!] Project '$projId' nahi ban saka. GOOGLE KA JAWAB:" -ForegroundColor Red
      Write-Host $createOut -ForegroundColor Red
      Write-Host "      - Agar 'quota'/'permission' aaya hai -> Google account me kam se kam 1 naya project banane ki
          permission chahiye (naye Google accounts pe limit 5-30 projects hoti hai)"
      Fail "Project create fail - upar ka red ERROR screen copy karke paste karo"
    }
  } else {
    Write-Host "  [OK] Project ban gaya" -ForegroundColor Green
  }
}
if ($projExists) {
  Write-Host "  [OK] Project pehle se maujood hai - UPDATE mode (kuch naya nahi ban raha - sirf latest build deploy hoga)" -ForegroundColor Green
}

# -- 2. APIs enable --
Write-Host ">> 2/8 APIs enable (firebase/hosting/firestore/auth)..." -ForegroundColor Yellow
gcloud services enable firebase.googleapis.com firebasehosting.googleapis.com firestore.googleapis.com identitytoolkit.googleapis.com --project $projId --quiet
if ($LASTEXITCODE -ne 0) { Fail "APIs enable fail - Google account me project banane ki permission check karo" }
Write-Host "  [OK] APIs ON" -ForegroundColor Green

# -- 3. Firestore database --
Write-Host ">> 3/8 Firestore database (asia-south1)..." -ForegroundColor Yellow
cmd /c "gcloud firestore databases create --location=asia-south1 --project $projId --quiet >nul 2>&1"
# pehle se bana ho to bhi OK
Write-Host "  [OK] Firestore ready (ya pehle se tha)" -ForegroundColor Green

# -- 4. Email/Password login ON --
Write-Host ">> 4/8 Email/Password login ON..." -ForegroundColor Yellow

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
Write-Host ">> 5/8 Web app register..." -ForegroundColor Yellow
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
Write-Host ">> 6/8 Config keys read + companies.json update..." -ForegroundColor Yellow
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

# -- 7. SYNC BRIDGE (master ledger <-> company app LIVE link) --
Write-Host ">> 7/8 SYNC BRIDGE jod raha (master app <-> company app)..." -ForegroundColor Yellow
$bridgeOk = $false
try {
  $bridgeDir = Join-Path $PSScriptRoot 'bridges'
  if (-not (Test-Path $bridgeDir)) { New-Item -ItemType Directory -Path $bridgeDir | Out-Null }
  $saltPath = Join-Path $bridgeDir 'secret.key'
  if (-not (Test-Path $saltPath)) {
    $rnd = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $sbytes = New-Object byte[] 24
    $rnd.GetBytes($sbytes)
    ([BitConverter]::ToString($sbytes) -replace '-','') | Set-Content $saltPath -Encoding ASCII
    Write-Host "  [OK] Bridge master-key bani: deploy\bridges\secret.key (delete MAT karna - git me nahi jata)" -ForegroundColor DarkGray
  }
  $salt = (Get-Content $saltPath -Raw).Trim()
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $syncSecret = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes("$salt|$projId"))) -replace '-','').Substring(0, 28)
  $syncEmail = "owner-sync.$Code@fcoy-erp.internal"
  $apiKeyB = "$($company.apiKey)".Trim()
  $authDomB = "$($company.authDomain)".Trim()

  # 7a. Company app ke andar sync user banao/verify karo (pure REST - sirf apiKey chahiye)
  $bodyUp = @{ email = $syncEmail; password = $syncSecret; returnSecureToken = $false } | ConvertTo-Json
  try {
    $null = Invoke-RestMethod -Method Post -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$apiKeyB" -Body $bodyUp -ContentType 'application/json' -ErrorAction Stop
    Write-Host "  [OK] Sync user ban gaya: $syncEmail" -ForegroundColor Green
  } catch {
    $eb7 = Get-ErrBody $_.Exception
    if ($eb7 -match 'EMAIL_EXISTS') {
      $bodyIn = @{ email = $syncEmail; password = $syncSecret; returnSecureToken = $true } | ConvertTo-Json
      try {
        $null = Invoke-RestMethod -Method Post -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKeyB" -Body $bodyIn -ContentType 'application/json' -ErrorAction Stop
        Write-Host "  [OK] Sync user pehle se hai - verify OK" -ForegroundColor DarkGray
      } catch {
        throw "Sync user hai par password match nahi (secret.key purani?) - deploy\bridges\secret.key delete karke script dobara chalao"
      }
    } else { throw "Sync user nahi ban saka. GOOGLE: $eb7" }
  }

  # 7b. Master ledger ka customer record dhoondho + bridge creds likho (gcloud token -> master Firestore)
  $mtok = (gcloud auth print-access-token 2>$null | Select-Object -First 1).Trim()
  if (-not $mtok) { throw "gcloud token nahi mila - 'gcloud auth login' karke dobara chalao" }
  $mh = @{ Authorization = "Bearer $mtok" }
  $mBase = "https://firestore.googleapis.com/v1/projects/$MasterProjectId/databases/(default)/documents"
  $bridgeFields = @{
    projectId = @{ stringValue = $projId }
    apiKey = @{ stringValue = $apiKeyB }
    authDomain = @{ stringValue = $authDomB }
    appId = @{ stringValue = "$appId" }
    syncEmail = @{ stringValue = $syncEmail }
    syncSecret = @{ stringValue = $syncSecret }
  }
  $bridgeVal = @{ mapValue = @{ fields = $bridgeFields } }
  $list = Invoke-RestMethod -Method Get -Uri "$mBase/customers?pageSize=200" -Headers $mh -ErrorAction Stop
  $matchName = $null
  $maxNum = 0
  $nameHead = ("$($company.name)" -replace '\s*\(.*','').Trim().ToLower()
  foreach ($d in @($list.documents | Where-Object { $_ })) {
    $cid = ''
    if ($d.fields.customerId) { $cid = "$($d.fields.customerId.stringValue)" }
    $mn = [regex]::Match($cid, '-(\d+)$')
    if ($mn.Success) { $nv = [int]$mn.Groups[1].Value; if ($nv -gt $maxNum) { $maxNum = $nv } }
    $bpid = ''
    try { $bpid = "$($d.fields.bridge.mapValue.fields.projectId.stringValue)" } catch {}
    $ccode = ''
    try { $ccode = "$($d.fields.companyCode.stringValue)" } catch {}
    $uname = ''
    try { $uname = "$($d.fields.unitName.stringValue)".ToLower() } catch {}
    if ($bpid -eq $projId -or $ccode -eq $Code -or ($nameHead -and $uname.Contains($nameHead))) { $matchName = "$($d.name)" }
  }
  $nowIso = (Get-Date).ToUniversalTime().ToString('o')
  if ($matchName) {
    $pbody = @{ fields = @{ bridge = $bridgeVal; companyCode = @{ stringValue = $Code }; projectId = @{ stringValue = $projId } } } | ConvertTo-Json -Depth 12
    $null = Invoke-RestMethod -Method Patch -Uri ("https://firestore.googleapis.com/v1/" + $matchName + "?updateMask.fieldPaths=bridge&updateMask.fieldPaths=companyCode&updateMask.fieldPaths=projectId") -Headers $mh -Body $pbody -ContentType 'application/json' -ErrorAction Stop
    Write-Host "  [OK] Master ledger ka PURANA customer jod gaya (duplicate nahi bana)" -ForegroundColor Green
    $bridgeOk = $true
  } else {
    $year = (Get-Date).Year
    $newCid = ('FCOY-{0}-{1}' -f $year, ([string]($maxNum + 1)).PadLeft(3, '0'))
    $cbody = @{ fields = @{
      customerId = @{ stringValue = $newCid }
      unitName = @{ stringValue = "$($company.name)" }
      commanderName = @{ stringValue = '' }
      email = @{ stringValue = '' }
      phone = @{ stringValue = '' }
      location = @{ stringValue = '' }
      notes = @{ stringValue = 'Auto-registered by deploy script (sync bridge)' }
      status = @{ stringValue = 'active' }
      isLocalUnit = @{ booleanValue = $false }
      authUid = @{ stringValue = '' }
      createdAt = @{ stringValue = $nowIso }
      createdBy = @{ stringValue = 'deploy-script' }
      companyCode = @{ stringValue = $Code }
      projectId = @{ stringValue = $projId }
      bridge = $bridgeVal
    } } | ConvertTo-Json -Depth 12
    $null = Invoke-RestMethod -Method Post -Uri "$mBase/customers?documentId=cust_$Code" -Headers $mh -Body $cbody -ContentType 'application/json' -ErrorAction Stop
    Write-Host "  [OK] Master ledger me NAYA customer ban gaya: $newCid" -ForegroundColor Green
    $bridgeOk = $true
  }
} catch {
  Write-Host ""
  Write-Host "  [!] BRIDGE abhi nahi jud paaya: $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host "      Deploy normal chalega. Bridge baad me judta hai - SAME command dobara chala do." -ForegroundColor Yellow
}
if ($bridgeOk) {
  Write-Host "  [OK] BRIDGE LIVE! Ab master app se renew karoge to YE APP 2 second me khud update hogi." -ForegroundColor Green
}

# -- 8. Build + Deploy --
if (-not $SkipDeploy) {
  Write-Host ">> 8/8 Build + Deploy..." -ForegroundColor Yellow
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
