# =====================================================================
#  Скачивание фото Unsplash для лендинга и замена ссылок на локальные
#  Положите этот файл рядом с index.html и запустите «Скачать фото.bat»
# =====================================================================
$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'   # без этого загрузка в PowerShell 5 идёт очень медленно
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root   = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$html   = Join-Path $root 'index.html'
$imgDir = Join-Path $root 'img'
$utf8   = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path $html)) { Write-Host "Не найден index.html рядом со скриптом: $root" -ForegroundColor Red; exit 1 }
New-Item -ItemType Directory -Force -Path $imgDir | Out-Null

# Резервная копия
$backup = Join-Path $root 'index.backup.html'
if (-not (Test-Path $backup)) { Copy-Item $html $backup }

$text = [IO.File]::ReadAllText($html, $utf8)

# Все ссылки на фото (в HTML & записан как &amp;)
$pattern = 'https://images\.unsplash\.com/photo-(?:[^"''\s,]|,(?!\s))+'
$urls = [regex]::Matches($text, $pattern) | ForEach-Object { $_.Value } | Sort-Object -Unique

if (-not $urls) { Write-Host 'Ссылок на Unsplash не найдено: похоже, фото уже скачаны.' -ForegroundColor Yellow; exit 0 }
Write-Host "Найдено вариантов фото: $($urls.Count)`n"

$ok = 0; $fail = @(); $n = 0
foreach ($raw in $urls) {
    $n++
    $url = $raw -replace '&amp;', '&'
    $id  = [regex]::Match($url, 'photo-([\w-]+)\?').Groups[1].Value
    $w   = [regex]::Match($url, '[?&]w=(\d+)').Groups[1].Value
    $h   = [regex]::Match($url, '[?&]h=(\d+)').Groups[1].Value
    $name = if ($h) { "$id-${w}x$h.webp" } elseif ($url -match 'fit=max') { "$id-full.webp" } else { "$id-$w.webp" }
    $out  = Join-Path $imgDir $name

    # Просим у Unsplash формат WebP вместо auto
    $dl = ($url -replace 'auto=format&?', '') + '&fm=webp'

    try {
        if (-not (Test-Path $out) -or (Get-Item $out).Length -eq 0) {
            Invoke-WebRequest -Uri $dl -OutFile $out -UseBasicParsing -TimeoutSec 60
        }
        $text = $text.Replace($raw, "img/$name")
        $ok++
        Write-Host ("[{0,3}/{1}] {2}" -f $n, $urls.Count, $name)
    } catch {
        $fail += $url
        Write-Host ("[{0,3}/{1}] ОШИБКА: {2}" -f $n, $urls.Count, $name) -ForegroundColor Red
    }
}

# preconnect к Unsplash больше не нужен
$text = $text -replace '\s*<link rel="preconnect" href="https://images\.unsplash\.com">', ''

[IO.File]::WriteAllText($html, $text, $utf8)

$size = [math]::Round(((Get-ChildItem $imgDir -File | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host "`nГотово: скачано $ok из $($urls.Count), папка img = $size МБ" -ForegroundColor Green
Write-Host "Резервная копия исходного файла: index.backup.html"
if ($fail.Count) {
    Write-Host "`nНе скачались ($($fail.Count)). Ссылки на них остались прежними, запустите скрипт ещё раз:" -ForegroundColor Yellow
    $fail | ForEach-Object { Write-Host "  $_" }
}
