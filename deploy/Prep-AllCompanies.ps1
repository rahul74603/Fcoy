# ===============================================================
# BULK PREP - Saari companies ka "khaala ghar" ek saath ready karo
#
# KYA karta hai:
#   companies.json ki har company (master 'acoy' CHHOD ke) ke liye
#   New-CompanyApp.ps1 chalata hai -> project, APIs, Firestore, auth,
#   web app, build, deploy - sab.
#   Company ka ASLI naam + CC account baad me /first-run wizard se
#   lagta hai (handover ke din) - names abhi placeholder se bhi chalenge.
#
# USE:
#   powershell -ExecutionPolicy Bypass -File deploy\Prep-AllCompanies.ps1 -Yes
#   (ya sirf ek company:  -Only bcoy)
#
# NOTE: Naye Google accounts pe project quota hota hai (5-30 projects).
#   Agar QUOTA error aaye to unused projects delete karo
#   (console.cloud.google.com) ya quota increase request karo.
# ===============================================================
param(
  [switch]$Yes,
  [string]$Only = ''
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$registry = Get-Content "deploy\companies.json" -Raw -ErrorAction Stop | ConvertFrom-Json

$codes = @()
foreach ($p in $registry.PSObject.Properties) {
  if ($p.Value.alreadyDeployed -eq $true) { continue }   # master app skip
  if ($Only -ne '' -and $p.Name -ne $Only) { continue }
  $codes += $p.Name
}

if ($codes.Count -eq 0) { Write-Host "[X] Koi company nahi mili (check -Only naam)." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "========  BULK COMPANY PREP  ========" -ForegroundColor Cyan
Write-Host "Companies ($($codes.Count)): $($codes -join ', ')"
Write-Host "Har company: project + APIs + Firestore + auth + web app + build + deploy"
Write-Host "Logs save honge: deploy\logs\<code>.log"
Write-Host ""

if (-not $Yes) {
  $a = Read-Host "Shuru karein? (y/n)"
  if ($a -ne 'y' -and $a -ne 'Y') { Write-Host "Cancel kar diya."; exit 0 }
}

New-Item -ItemType Directory -Force -Path "deploy\logs" | Out-Null

$results = @{}
$i = 0
foreach ($code in $codes) {
  $i++
  Write-Host ""
  Write-Host "=========================================================" -ForegroundColor Cyan
  Write-Host "   COMPANY $i/$($codes.Count): $code" -ForegroundColor Cyan
  Write-Host "=========================================================" -ForegroundColor Cyan
  $logPath = "deploy\logs\$code.log"
  powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\New-CompanyApp.ps1" -Code $code 2>&1 | Tee-Object -FilePath $logPath
  if ($LASTEXITCODE -eq 0) {
    $results[$code] = 'READY'
  } else {
    $results[$code] = "INCOMPLETE (log: $logPath)"
  }
  Write-Host ""
  Write-Host "----- $code result: $($results[$code]) -----" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================  FINAL REPORT CARD  ================" -ForegroundColor Green
foreach ($code in $codes) {
  $mark = if ($results[$code] -eq 'READY') { '[OK]' } else { '[!!]' }
  Write-Host ("  {0}  {1,-8}  {2}" -f $mark, $code, $results[$code])
}
Write-Host ""
Write-Host "READY companies ka URL pattern: https://fcoy-erp-<code>.web.app/first-run" -ForegroundColor Cyan
Write-Host "INCOMPLETE wale dobara chalao (idempotent hai):"
Write-Host "  powershell -ExecutionPolicy Bypass -File deploy\New-CompanyApp.ps1 -Code <code>"
Write-Host ""
