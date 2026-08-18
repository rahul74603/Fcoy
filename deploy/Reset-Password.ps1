# ===============================================================
# RESET PASSWORD (OWNER TOOL) - kisi bhi account ka password
# turant naya set karo. KUCH DELETE NAHI HOTA:
#   - Auth account wahi rehta hai (UID same)
#   - Firestore users profile wahi rehti hai (role/isDeveloper same)
#   - Bas password badal jata hai
#
# USE (VS Code / PowerShell):
#   cd C:\Users\Rahul\Fcoy
#   powershell -ExecutionPolicy Bypass -File deploy\Reset-Password.ps1 `
#     -Email developer@acoy.com -NewPassword "NayaPass123"
#
#   Dusre project (company app) ke liye:
#   ... -Email cc@acoy.local -NewPassword "Pass123" -ProjectId fcoy-erp-bcoy
#
# Pehli baar: gcloud auth login (wahi Google account jo Firebase owner hai)
# ===============================================================
param(
  [Parameter(Mandatory=$true)][string]$Email,
  [Parameter(Mandatory=$true)][string]$NewPassword,
  [string]$ProjectId = 'training-command-erp'
)

$ErrorActionPreference = 'Continue'

if ($NewPassword.Length -lt 6) { throw "[X] Password kam se kam 6 characters ka rakho." }

Write-Host ""
Write-Host "================  PASSWORD RESET  ================" -ForegroundColor Cyan
Write-Host "Project : $ProjectId"
Write-Host "Account : $Email"
Write-Host ""

# -- 1. Owner token (gcloud se) --
$tok = (gcloud auth print-access-token 2>$null | Select-Object -First 1)
if (-not $tok) { throw "[X] gcloud token nahi mila - pehle 'gcloud auth login' chalao (Firebase owner Google account se)." }
$tok = "$tok".Trim()
# x-goog-user-project ZAROORI hai - warna gcloud ka default project alag
# hone par Google 403 Forbidden deta hai (quota project mismatch).
$headers = @{
  Authorization        = "Bearer $tok"
  'Content-Type'       = 'application/json'
  'x-goog-user-project' = $ProjectId
}
$base = "https://identitytoolkit.googleapis.com/v1/projects/$ProjectId"

# -- 2. Email se UID dhoondo --
$lookupBody = @{ email = @($Email.Trim().ToLower()) } | ConvertTo-Json
try {
  $lookup = Invoke-RestMethod -Method Post -Uri "$base/accounts:lookup" -Headers $headers -Body $lookupBody -ErrorAction Stop
} catch {
  throw "[X] Lookup fail: $($_.Exception.Message) - gcloud account ke paas '$ProjectId' ka access hai? (gcloud auth login dobara try karo)"
}
if (-not $lookup.users -or $lookup.users.Count -eq 0) {
  throw "[X] '$Email' is project ($ProjectId) me NAHI mila. Email/project check karo."
}
$uid = $lookup.users[0].localId
Write-Host "[OK] Account mila - UID: $uid" -ForegroundColor Green

# -- 3. Naya password set karo (UID/profile untouched) --
$updateBody = @{ localId = $uid; password = $NewPassword } | ConvertTo-Json
try {
  $null = Invoke-RestMethod -Method Post -Uri "$base/accounts:update" -Headers $headers -Body $updateBody -ErrorAction Stop
} catch {
  throw "[X] Password update fail: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "[DONE] $Email ka password reset ho gaya." -ForegroundColor Green
Write-Host "       Naya password: $NewPassword" -ForegroundColor Yellow
Write-Host "       UID same, Firestore profile same - seedha login karo." -ForegroundColor DarkGray
Write-Host ""
