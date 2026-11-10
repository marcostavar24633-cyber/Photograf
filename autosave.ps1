# =====================================================================
#  Автосохранение сайта на GitHub
#  Следит за папкой, в которой лежит этот файл. Как только вы сохранили
#  изменения и несколько секунд ничего не правите, скрипт делает коммит
#  и отправляет его в репозиторий. Окно должно оставаться открытым.
# =====================================================================
$RepoUrl    = 'https://github.com/marcostavar24633-cyber/Photograf.git'
$Branch     = 'main'
$CheckEvery = 5     # как часто проверять изменения, секунд
$QuietTime  = 10    # сколько секунд не должно быть правок перед сохранением
$PullEvery  = 120   # как часто забирать изменения с GitHub, секунд

$ErrorActionPreference = 'Continue'
$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
Set-Location -LiteralPath $root
$Host.UI.RawUI.WindowTitle = 'Автосохранение на GitHub: ' + (Split-Path $root -Leaf)

function Say($text, $color = 'Gray') { Write-Host ('[{0:HH:mm:ss}] {1}' -f (Get-Date), $text) -ForegroundColor $color }
function G { $out = & git @args 2>&1 | Out-String; $script:gitOk = ($LASTEXITCODE -eq 0); return $out.Trim() }

# --- 1. Проверяем, что установлен Git ---
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Say 'Git не найден. Установите Git for Windows: https://git-scm.com/download/win и запустите скрипт снова.' Red
    exit 1
}

# --- 2. Первый запуск: превращаем папку в копию репозитория ---
if (-not (Test-Path (Join-Path $root '.git'))) {
    Say 'Первый запуск: подключаю папку к репозиторию...' Cyan
    G init | Out-Null
    G config core.quotepath false | Out-Null
    G remote add origin $RepoUrl | Out-Null
    $o = G fetch origin $Branch
    if (-not $gitOk) { Say "Не удалось получить репозиторий:`n$o" Red; exit 1 }
    G symbolic-ref HEAD "refs/heads/$Branch" | Out-Null
    G reset "origin/$Branch" | Out-Null          # ваши файлы не трогаются
    G branch --set-upstream-to "origin/$Branch" | Out-Null
    # Файлы, которых нет у вас в папке, но есть на GitHub, восстанавливаем, а не удаляем
    $missing = (G ls-files --deleted) -split "`r?`n" | Where-Object { $_ }
    foreach ($f in $missing) { G checkout -- $f | Out-Null }
    if ($missing) { Say "Восстановлено из репозитория файлов: $($missing.Count)" }
    Say 'Папка подключена.' Green
}

G config core.quotepath false | Out-Null
if (-not (G config user.name))  { G config user.name 'marcostavar24633-cyber' | Out-Null }
if (-not (G config user.email)) { G config user.email 'marcostavar24633-cyber@users.noreply.github.com' | Out-Null }

function Sync-Remote {
    $o = G pull --rebase --autostash -q origin $Branch
    if (-not $gitOk) {
        G rebase --abort | Out-Null
        Say "Не удалось забрать изменения с GitHub (возможно, один файл правили и там, и здесь):`n$o" Yellow
        return $false
    }
    return $true
}

function Push-Pending {
    $ahead = G rev-list --count "origin/$Branch..HEAD"
    if ($gitOk -and [int]$ahead -gt 0) {
        $o = G push origin $Branch
        if ($gitOk) { Say "Отправлено на GitHub (коммитов: $ahead)" Green }
        else { Say "Не удалось отправить, повторю позже:`n$o" Yellow }
    }
}

function Save-Changes {
    G add -A | Out-Null
    $files = (G diff --cached --name-only) -split "`r?`n" | Where-Object { $_ }
    if (-not $files) { return }
    $big = $files | Where-Object { (Test-Path -LiteralPath $_) -and (Get-Item -LiteralPath $_).Length -gt 95MB }
    if ($big) { Say "Файлы больше 95 МБ GitHub не примет, пропускаю: $($big -join ', ')" Red; foreach ($b in $big) { G reset -q -- $b | Out-Null } }
    $files = (G diff --cached --name-only) -split "`r?`n" | Where-Object { $_ }
    if (-not $files) { return }
    $list = ($files | Select-Object -First 3) -join ', '
    if ($files.Count -gt 3) { $list += " и ещё $($files.Count - 3)" }
    $msg = 'Автосохранение {0:dd.MM.yyyy HH:mm}: {1}' -f (Get-Date), $list
    G commit -q -m $msg | Out-Null
    Say "Сохранено: $list" Cyan
    if (Sync-Remote) { Push-Pending }
}

# --- 3. Основной цикл ---
Say "Слежу за папкой: $root" Green
Say 'Правьте файлы как обычно. Чтобы остановить, закройте окно или нажмите Ctrl+C.'
Sync-Remote | Out-Null; Push-Pending

$lastState = ''; $changedAt = $null; $lastPull = Get-Date
while ($true) {
    Start-Sleep -Seconds $CheckEvery
    $state = G status --porcelain
    if ($state) {
        if ($state -ne $lastState) { $lastState = $state; $changedAt = Get-Date }
        elseif (((Get-Date) - $changedAt).TotalSeconds -ge $QuietTime) { Save-Changes; $lastState = '' }
    } else {
        $lastState = ''
        Push-Pending
        if (((Get-Date) - $lastPull).TotalSeconds -ge $PullEvery) {
            $before = G rev-parse HEAD
            if (Sync-Remote) { if ((G rev-parse HEAD) -ne $before) { Say 'Забрал свежие изменения с GitHub' } }
            $lastPull = Get-Date
        }
    }
}
