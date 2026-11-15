# MonoBau - erzeugt den Upload-Ordner "deploy" (Inhalt kommt in den Ordner public_html bei Hetzner).
#
# Aufruf (PowerShell, im Projektordner):
#     powershell -ExecutionPolicy Bypass -File tools\build-deploy.ps1
#
# Was das Skript tut:
#   1. Sucht in HTML/CSS/JS alle verwendeten Dateien und kopiert NUR diese (kein Archiv, keine alten Bilder).
#   2. Entfernt Metadaten (EXIF, Kommentare, Vorschaubilder) aus JPEGs. Die Bildpunkte bleiben unveraendert:
#      jedes Bild wird danach Pixel fuer Pixel gegen das Original geprueft (verlustfrei, keine Qualitaetseinbusse).
#   3. Meldet fehlende Dateien und noch offene Platzhalter in den Rechtstexten.
#
# Die Dateien im Projektordner werden dabei NICHT veraendert oder geloescht.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $PSScriptRoot
$deploy = Join-Path $root 'deploy'

# ---------------------------------------------------------------- feste Dateien
$fixed = @(
  'index.html', 'impressum.html', 'datenschutz.html', '404.html', 'kontakt.php',
  'style.css', 'script.js', 'boot.js', 'favicon.svg', 'apple-touch-icon.png',
  'robots.txt', 'sitemap.xml', '.htaccess', '.well-known/security.txt',
  'fonts/OFL.txt'
)

# ---------------------------------------------------------------- verwendete Dateien automatisch finden
$scan = @('index.html', 'impressum.html', 'datenschutz.html', '404.html', 'style.css', 'script.js') | ForEach-Object { Join-Path $root $_ }
$assets = New-Object System.Collections.Generic.HashSet[string]
foreach ($f in $scan) {
  $text = [IO.File]::ReadAllText($f)
  foreach ($m in [regex]::Matches($text, '(?:images|projects|fonts)/[A-Za-z0-9_./-]+\.(?:jpg|jpeg|png|webp|svg|woff2)')) {
    [void]$assets.Add($m.Value)
  }
}

$files = @($fixed) + @($assets | Sort-Object)

# ---------------------------------------------------------------- JPEG: Metadaten verlustfrei entfernen
function Remove-JpegMetadata([byte[]]$b) {
  # Behalten: APP0 (JFIF), APP2 (Farbprofil), APP14 (Adobe). Entfernt: APP1 (EXIF/XMP), APP3-13, APP15, Kommentare.
  if ($b.Length -lt 4 -or $b[0] -ne 0xFF -or $b[1] -ne 0xD8) { return ,$b }
  $ms = New-Object System.IO.MemoryStream
  $ms.WriteByte(0xFF); $ms.WriteByte(0xD8)
  $i = 2
  while ($i -lt $b.Length - 1) {
    if ($b[$i] -ne 0xFF) { break }
    $marker = $b[$i + 1]
    if ($marker -eq 0xFF) { $i++; continue }
    if ($marker -eq 0xDA) { $ms.Write($b, $i, $b.Length - $i); $i = $b.Length; break }   # ab hier Bilddaten
    if ($marker -eq 0xD9 -or $marker -eq 0x01 -or ($marker -ge 0xD0 -and $marker -le 0xD7)) { $ms.Write($b, $i, 2); $i += 2; continue }
    $len  = ([int]$b[$i + 2] * 256) + [int]$b[$i + 3]
    $drop = ($marker -ge 0xE1 -and $marker -le 0xEF -and $marker -ne 0xE2 -and $marker -ne 0xEE) -or ($marker -eq 0xFE)
    if (-not $drop) { $ms.Write($b, $i, $len + 2) }
    $i += 2 + $len
  }
  return ,$ms.ToArray()
}

function Get-PixelHash([byte[]]$bytes) {
  $stream = New-Object System.IO.MemoryStream (,$bytes)
  $img = [System.Drawing.Image]::FromStream($stream)
  $bmp = New-Object System.Drawing.Bitmap $img
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $buf = New-Object byte[] ($data.Stride * $data.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $buf.Length)
  $bmp.UnlockBits($data); $bmp.Dispose(); $img.Dispose(); $stream.Dispose()
  $sha = [System.Security.Cryptography.SHA256]::Create()
  return [BitConverter]::ToString($sha.ComputeHash($buf))
}

# ---------------------------------------------------------------- Ordner neu aufbauen
if (Test-Path $deploy) { Remove-Item $deploy -Recurse -Force }
New-Item -ItemType Directory -Path $deploy | Out-Null

$missing = @(); $savedTotal = 0; $count = 0; $verified = 0; $kept = 0
foreach ($rel in $files) {
  $src = Join-Path $root $rel
  if (-not (Test-Path $src)) { $missing += $rel; continue }
  $dst = Join-Path $deploy $rel
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null

  if ($rel -match '\.jpe?g$') {
    $orig = [IO.File]::ReadAllBytes($src)
    $clean = Remove-JpegMetadata $orig
    $useClean = $false
    if ($clean.Length -lt $orig.Length) {
      try {
        if ((Get-PixelHash $orig) -eq (Get-PixelHash $clean)) { $useClean = $true; $verified++ } else { $kept++ }
      } catch { $kept++ }   # Pruefung nicht moeglich: Original unveraendert uebernehmen
    }
    if ($useClean) { [IO.File]::WriteAllBytes($dst, $clean); $savedTotal += ($orig.Length - $clean.Length) }
    else { Copy-Item $src $dst }
  } else {
    Copy-Item $src $dst
  }
  $count++
}

# ---------------------------------------------------------------- Bericht
$size = (Get-ChildItem $deploy -Recurse -File -Force | Measure-Object Length -Sum).Sum
Write-Host ''
Write-Host ('Upload-Ordner: ' + $deploy)
Write-Host ('Dateien: {0}, Gesamtgroesse: {1:N0} KB' -f $count, ($size / 1KB))
Write-Host ('JPEG-Metadaten entfernt (Pixel geprueft, identisch): {0} Bilder, {1:N1} KB gespart; unveraendert uebernommen: {2}' -f $verified, ($savedTotal / 1KB), $kept)

if ($missing.Count -gt 0) {
  Write-Host ''
  Write-Host 'FEHLER - diese Dateien werden verwendet, existieren aber nicht:' -ForegroundColor Red
  $missing | ForEach-Object { Write-Host ('  ' + $_) -ForegroundColor Red }
}

# offene Platzhalter in den Rechtstexten
$open = 0
foreach ($f in 'impressum.html', 'datenschutz.html') {
  $t = [IO.File]::ReadAllText((Join-Path $root $f))
  $n = [regex]::Matches($t, 'class="fill-in"').Count
  $hint = [regex]::Matches($t, 'Hinweis f.r den Betreiber').Count
  if ($n -gt 0 -or $hint -gt 0) {
    Write-Host ('{0}: {1} rot markierte Platzhalter, Betreiber-Hinweis vorhanden: {2}' -f $f, $n, [bool]$hint) -ForegroundColor Yellow
    $open += $n + $hint
  }
}
if ($open -gt 0) {
  Write-Host ''
  Write-Host 'ACHTUNG: Die Rechtstexte enthalten noch Platzhalter. Vor der Veroeffentlichung ausfuellen und die Hinweis-Kaesten loeschen (siehe README.md, Abschnitt Vor dem Livegang).' -ForegroundColor Yellow
}
