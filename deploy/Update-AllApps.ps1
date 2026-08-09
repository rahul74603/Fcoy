# ===============================================================
# UPDATE ALL APPS  -  EK COMMAND ME GLOBAL UPDATE  (VS Code terminal)
#
# USE:
#   cd C:\Users\Rahul\Fcoy
#   git pull
#   powershell -ExecutionPolicy Bypass -File deploy\Update-AllApps.ps1
#
# Ye ek hi command me sab kuch update karti hai:
#   1/3 MASTER app build + deploy   (training-command-erp)
#   2/3 companies.json scan         (jinki keys bhari hain = deployed)
#   3/3 har company app build + deploy  (Deploy-Company.ps1 use hoti hai)
#
# Flags (optional):
#   -Yes            -> confirmation mat poocho
#   -SkipMaster     -> master deploy skip (sirf companies)
#   -Only master    -> SIRF master update
#   -Only bcoy,ccoy -> sirf ye companies update
#
# Log file: deploy\logs\update-all-<date>-<time>.log
# NOTE: $ErrorActionPreference = 'Continue' (Stop NAHI - PS5.1 stderr se script marti hai)
# ===============================================================
param(
  [string]$Only = '',
  [switch]$SkipMaster,
  [switch]$Yes
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$logDir = Join-Path $PSScriptRoot 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logPath = Join-Path $logDir ('update-all-{0:yyyyMMdd-HHmmss}.log' -f (Get-Date))

function Log([string]$m, [string]$c = 'Gray') {
  Write-Host $m -ForegroundColor $c
  Add-Content $logPath $m -Encoding UTF8
}

function Section([string]$m) { Log ''; Log $m 'Yellow' }

Log ''
Log '================  UPDATE ALL APPS (global update)  ================' 'Cyan'
Log ('Start : ' + (Get-Date))
Log ('Log   : ' + $logPath) 'DarkGray'

# -- Registry scan (pehle hi - confirm ke liye) --
$registry = Get-Content 'deploy\companies.json' -Raw -ErrorAction Stop | ConvertFrom-Json
$onlyList = @()
if ($Only -ne '' -and $Only -ne 'master') {
  $onlyList = @($Only.Split(',') | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ })
}
$doMaster = (-not $SkipMaster) -and ($Only -eq '' -or $Only -eq 'master')

$targets = @()
foreach ($pr in $registry.PSObject.Properties) {
  $n = $pr.Name
  if ($n.StartsWith('_')) { continue }
  $c = $pr.Value
  if ($c.alreadyDeployed -eq $true) { continue }
  if ([string]::IsNullOrWhiteSpace("$($c.apiKey)")) { continue }
  if ($onlyList.Count -gt 0 -and $onlyList -notcontains $n) { continue }
  $targets += $n
}

Log ''
Log ('MASTER  : ' + $(if ($doMaster) { 'UPDATE hoga' } else { 'skip' }))
if ($targets.Count -gt 0) { Log ('COMPANIES: ' + ($targets -join ', ')) } else { Log 'COMPANIES: koi nahi (keys bhari company nahi mili)' }

if (-not $Yes) {
  $ans = Read-Host "`nItni apps UPDATE hongi. Continue? (Y/n)"
  if ($ans -match '^[nN]') { Log 'Cancelled by user.' 'Yellow'; exit 0 }
}

$results = @{}
$results['MASTER'] = 'SKIP'
foreach ($tn in $targets) { $results[$tn] = 'PENDING' }

# -- 1/3 MASTER --
if ($doMaster) {
  Section '>> 1/3 MASTER app (training-command-erp) build + deploy...'
  cmd /c 'npm run build 2>&1'
  if ($LASTEXITCODE -ne 0) { $results['MASTER'] = 'FAIL'; Log '  [X] MASTER build FAIL - upar error dekho' 'Red' }
  else {
    cmd /c 'firebase deploy --only hosting 2>&1'
    if ($LASTEXITCODE -ne 0) { $results['MASTER'] = 'FAIL'; Log '  [X] MASTER deploy FAIL - upar error dekho' 'Red' }
    else { $results['MASTER'] = 'OK'; Log '  [OK] MASTER deployed -> https://training-command-erp.web.app' 'Green' }
  }
} else {
  Log ''; Log '>> 1/3 MASTER skip' 'DarkGray'
}

# -- 2/3 + 3/3 Companies --
Section '>> 2/3 + 3/3 Company apps build + deploy...'
if ($targets.Count -eq 0) {
  Log '  (kuch nahi karna - koi company ready nahi)' 'DarkGray'
}
foreach ($tn in $targets) {
  Log ''
  Log ("  --- " + $tn + " ---") 'Cyan'
  powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\Deploy-Company.ps1" -Code $tn
  if ($LASTEXITCODE -ne 0) { $results[$tn] = 'FAIL'; Log ("  [X] " + $tn + " FAIL (detail upar scroll karo)") 'Red' }
  else { $results[$tn] = 'OK'; Log ("  [OK] " + $tn + " deployed") 'Green' }
}

# -- REPORT CARD --
Log ''
Log '================  REPORT CARD  ================' 'Cyan'
foreach ($k in $results.Keys) {
  $v = $results[$k]
  $col = 'Gray'
  if ($v -eq 'OK') { $col = 'Green' }
  if ($v -eq 'FAIL') { $col = 'Red' }
  Log ("  " + $k.PadRight(12) + " : " + $v) $col
}
$failCount = @($results.Values | Where-Object { $_ -eq 'FAIL' }).Count
Log ''
if ($failCount -gt 0) {
  Log "KUCH DEPLOYS FAIL HUE - upar 'deploying to' wale block dhoondh ke error paste karo" 'Red'
} else {
  Log 'PURA GLOBAL UPDATE COMPLETE. Saari apps ek hi version (Sidebar me version badge check karo).' 'Green'
}
Log ('End   : ' + (Get-Date))
Log ''
