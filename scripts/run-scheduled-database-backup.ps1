[CmdletBinding()]
param(
  [string]$EnvFile = ".\.env.deploy",

  [string]$ComposeFile = ".\docker-compose.deploy.yml",

  [string]$BackupDirectory = ".\backups\scheduled",

  [ValidateRange(1, 3650)]
  [int]$RetentionDays = 30,

  [ValidateRange(1, 10000)]
  [int]$MinimumBackups = 7
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$lockStream = $null
$lockPath = $null
$logPath = $null

function Resolve-ProjectPath {
  param(
    [Parameter(Mandatory)]
    [string]$Path,

    [Parameter(Mandatory)]
    [string]$ProjectRoot
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath(
    (Join-Path $ProjectRoot $Path)
  )
}

function Write-BackupLog {
  param(
    [Parameter(Mandatory)]
    [string]$Message,

    [ValidateSet("INFO", "WARN", "ERROR")]
    [string]$Level = "INFO"
  )

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "[$timestamp] [$Level] $Message"

  Write-Host $line

  if (-not [string]::IsNullOrWhiteSpace($script:logPath)) {
    Add-Content `
      -LiteralPath $script:logPath `
      -Value $line `
      -Encoding UTF8
  }
}

try {
  $projectRoot = [System.IO.Path]::GetFullPath(
    (Split-Path -Parent $PSScriptRoot)
  )

  $backupScriptPath = Join-Path `
    $PSScriptRoot `
    "backup-database.ps1"

  if (-not (Test-Path -LiteralPath $backupScriptPath -PathType Leaf)) {
    throw "Script de backup nao encontrado: $backupScriptPath"
  }

  $envFilePath = Resolve-ProjectPath `
    -Path $EnvFile `
    -ProjectRoot $projectRoot

  $composeFilePath = Resolve-ProjectPath `
    -Path $ComposeFile `
    -ProjectRoot $projectRoot

  $backupDirectoryPath = Resolve-ProjectPath `
    -Path $BackupDirectory `
    -ProjectRoot $projectRoot

  if (-not (Test-Path -LiteralPath $envFilePath -PathType Leaf)) {
    throw "Arquivo de ambiente nao encontrado: $envFilePath"
  }

  if (-not (Test-Path -LiteralPath $composeFilePath -PathType Leaf)) {
    throw "Arquivo do Docker Compose nao encontrado: $composeFilePath"
  }

  New-Item `
    -ItemType Directory `
    -Path $backupDirectoryPath `
    -Force |
    Out-Null

  $logDirectoryPath = Join-Path `
    $backupDirectoryPath `
    "logs"

  New-Item `
    -ItemType Directory `
    -Path $logDirectoryPath `
    -Force |
    Out-Null

  $executionTimestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"

  $logPath = Join-Path `
    $logDirectoryPath `
    "backup-$executionTimestamp.log"

  $lockPath = Join-Path `
    $backupDirectoryPath `
    ".backup.lock"

  try {
    $lockStream = [System.IO.File]::Open(
      $lockPath,
      [System.IO.FileMode]::OpenOrCreate,
      [System.IO.FileAccess]::ReadWrite,
      [System.IO.FileShare]::None
    )
  } catch {
    throw "Outra execucao de backup ja esta em andamento."
  }

  Write-BackupLog "Iniciando backup automatico."
  Write-BackupLog "Projeto: $projectRoot"
  Write-BackupLog "Destino: $backupDirectoryPath"
  Write-BackupLog "Retencao: $RetentionDays dias."
  Write-BackupLog "Quantidade minima preservada: $MinimumBackups."

  $powerShellExecutable = (
    Get-Process -Id $PID
  ).Path

  if ([string]::IsNullOrWhiteSpace($powerShellExecutable)) {
    throw "Nao foi possivel identificar o executavel do PowerShell."
  }

  $backupArguments = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $backupScriptPath,
    "-EnvFile",
    $envFilePath,
    "-ComposeFile",
    $composeFilePath,
    "-BackupDirectory",
    $backupDirectoryPath
  )

  $backupStartedAt = Get-Date
  $previousErrorActionPreference = $ErrorActionPreference

  try {
    $ErrorActionPreference = "Continue"

    $backupOutput = & $powerShellExecutable @backupArguments 2>&1
    $backupExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  foreach ($outputLine in @($backupOutput)) {
    $outputText = [string]$outputLine

    if ([string]::IsNullOrWhiteSpace($outputText)) {
      continue
    }

    Write-BackupLog $outputText
  }

  if ($backupExitCode -ne 0) {
    throw "O script de backup terminou com o codigo $backupExitCode."
  }

  $newBackup = Get-ChildItem `
    -LiteralPath $backupDirectoryPath `
    -Filter "*.dump" `
    -File |
    Where-Object {
      $_.LastWriteTime -ge $backupStartedAt.AddSeconds(-2)
    } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if ($null -eq $newBackup) {
    throw "O script terminou sem produzir um novo arquivo de backup."
  }

  $newChecksumPath = "$($newBackup.FullName).sha256"

  if (-not (Test-Path -LiteralPath $newChecksumPath -PathType Leaf)) {
    throw "O arquivo SHA-256 do novo backup nao foi encontrado."
  }

  Write-BackupLog "Novo backup confirmado: $($newBackup.FullName)"

  $cutoffDate = (Get-Date).AddDays(-$RetentionDays)

  $allBackups = @(
    Get-ChildItem `
      -LiteralPath $backupDirectoryPath `
      -Filter "*.dump" `
      -File |
      Sort-Object LastWriteTime -Descending
  )

  $expiredBackups = @(
    $allBackups |
      Select-Object -Skip $MinimumBackups |
      Where-Object {
        $_.LastWriteTime -lt $cutoffDate
      }
  )

  if ($expiredBackups.Count -eq 0) {
    Write-BackupLog "Nenhum backup antigo precisa ser removido."
  } else {
    foreach ($expiredBackup in $expiredBackups) {
      $expiredChecksumPath = "$($expiredBackup.FullName).sha256"

      Write-BackupLog `
        "Removendo backup expirado: $($expiredBackup.Name)" `
        "WARN"

      Remove-Item `
        -LiteralPath $expiredBackup.FullName `
        -Force

      if (Test-Path -LiteralPath $expiredChecksumPath -PathType Leaf) {
        Remove-Item `
          -LiteralPath $expiredChecksumPath `
          -Force
      }
    }
  }

  $expiredLogs = @(
    Get-ChildItem `
      -LiteralPath $logDirectoryPath `
      -Filter "*.log" `
      -File |
      Where-Object {
        $_.FullName -ne $logPath -and
        $_.LastWriteTime -lt $cutoffDate
      }
  )

  foreach ($expiredLog in $expiredLogs) {
    Remove-Item `
      -LiteralPath $expiredLog.FullName `
      -Force
  }

  $remainingBackups = @(
    Get-ChildItem `
      -LiteralPath $backupDirectoryPath `
      -Filter "*.dump" `
      -File
  )

  Write-BackupLog `
    "Backup automatico concluido. Backups preservados: $($remainingBackups.Count)."

  exit 0
} catch {
  $message = $_.Exception.Message

  if (-not [string]::IsNullOrWhiteSpace($logPath)) {
    Write-BackupLog $message "ERROR"
  } else {
    Write-Host "[ERROR] $message" -ForegroundColor Red
  }

  exit 1
} finally {
  if ($null -ne $lockStream) {
    $lockStream.Dispose()
  }

  if (
    -not [string]::IsNullOrWhiteSpace($lockPath) -and
    (Test-Path -LiteralPath $lockPath -PathType Leaf)
  ) {
    Remove-Item `
      -LiteralPath $lockPath `
      -Force `
      -ErrorAction SilentlyContinue
  }
}