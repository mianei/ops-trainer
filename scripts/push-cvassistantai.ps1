# 同步主仓到 cvassistantai 并推送（需可访问 GitHub）
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host '==> sync files to cvassistantai mirror'
node scripts/sync-to-cvassistantai.mjs

$Mirror = Join-Path (Split-Path -Parent $Root) 'cvassistantai'
if (-not (Test-Path $Mirror)) {
  throw "Mirror not found: $Mirror"
}

Set-Location $Mirror
git status
$changes = git status --porcelain
if (-not $changes) {
  Write-Host 'No changes to push.'
  exit 0
}

git add -A
git commit -m "Sync features from ops-trainer (auth, optimize, docx export)"
git push origin main
Write-Host 'Done: https://github.com/mianei/cvassistantai'
