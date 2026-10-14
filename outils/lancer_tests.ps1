# BobyMusc : lance tous les tests sur une copie locale, nettoie les comptes de test et vérifie les vrais comptes.
# Usage : powershell -File E:\urbex\BobMusc\outils\lancer_tests.ps1
# Les tests utilisent la VRAIE base Firebase avec des comptes test-...@example.com (supprimés à la fin).
$ErrorActionPreference = 'Continue'
$o = $PSScriptRoot
$node = 'E:\Outils\node-v24.21.0-win-x64\node.exe'
$shots = Join-Path $o 'captures'
New-Item -ItemType Directory -Force $shots | Out-Null
$srv = Start-Process python -ArgumentList '-m', 'http.server', '8765', '--directory', (Split-Path $o) -PassThru -WindowStyle Hidden
Start-Sleep 1
try {
  $photo = Join-Path $o 'photo_test.jpg'
  $tests = @(
    @('test_app.py', $shots),
    @('test_tpl.py', $shots),
    @('test_timer.py', $shots),
    @('test_photos.py', $shots),
    @('test_friends.py', $shots, (Join-Path $shots 'uids1.json')),
    @('test_settings.py', $shots, (Join-Path $shots 'uids2.json')),
    @('test_groups.py', $shots, $photo),
    @('test_motiv.py', $shots, $photo)
  )
  foreach ($t in $tests) {
    $res = python -I (Join-Path $o $t[0]) @($t[1..($t.Length - 1)]) 2>&1 | Select-Object -Last 1
    Write-Output ("{0,-18} {1}" -f $t[0], $res)
  }
} finally {
  Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue
  & $node --no-deprecation (Join-Path $o 'cleanup_tests.js')
  & $node --no-deprecation (Join-Path $o 'check_real.js')
}
