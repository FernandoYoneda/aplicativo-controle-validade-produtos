[CmdletBinding()]
param(
  [string]$EnvFile = ".\.env.deploy",

  [string]$ComposeFile = ".\docker-compose.deploy.yml",

  [string]$BackupDirectory = ".\backups"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-DockerCommand {
  param(
    [Parameter(Mandatory)]
    [string[]]$Arguments,

    [Parameter(Mandatory)]
    [string]$FailureMessage
  )

  & docker @Arguments
  $nativeExitCode = $LASTEXITCODE

  if ($nativeExitCode -ne 0) {
    throw "$FailureMessage Codigo de saida: $nativeExitCode."
  }
}

function Get-PostgresEnvironmentValue {
  param(
    [Parameter(Mandatory)]
    [string[]]$ComposeArguments,

    [Parameter(Mandatory)]
    [string]$VariableName
  )

  $arguments = $ComposeArguments + @(
    "exec",
    "-T",
    "postgres",
    "printenv",
    $VariableName
  )

  $value = [string](& docker @arguments)
  $nativeExitCode = $LASTEXITCODE

  if (
    $nativeExitCode -ne 0 -or
    [string]::IsNullOrWhiteSpace($value)
  ) {
    throw "Nao foi possivel obter a variavel $VariableName do PostgreSQL."
  }

  return $value.Trim()
}

$containerBackupPath = $null
$composeArguments = $null

try {
  $resolvedEnvFile = (
    Resolve-Path `
      -LiteralPath $EnvFile
  ).Path

  $resolvedComposeFile = (
    Resolve-Path `
      -LiteralPath $ComposeFile
  ).Path

  if (-not (Test-Path -LiteralPath $BackupDirectory)) {
    New-Item `
      -ItemType Directory `
      -Path $BackupDirectory `
      -Force |
      Out-Null
  }

  $resolvedBackupDirectory = (
    Resolve-Path `
      -LiteralPath $BackupDirectory
  ).Path

  & docker version --format "{{.Server.Version}}" | Out-Null
  $dockerExitCode = $LASTEXITCODE

  if ($dockerExitCode -ne 0) {
    throw "O Docker nao esta disponivel. Inicie o Docker Desktop e tente novamente."
  }

  $composeArguments = @(
    "compose",
    "--env-file",
    $resolvedEnvFile,
    "-f",
    $resolvedComposeFile
  )

  $statusArguments = $composeArguments + @(
    "ps",
    "--status",
    "running",
    "--services"
  )

  $runningServices = @(& docker @statusArguments)
  $statusExitCode = $LASTEXITCODE

  if ($statusExitCode -ne 0) {
    throw "Nao foi possivel consultar os servicos da implantacao."
  }

  if ($runningServices -notcontains "postgres") {
    throw "O servico PostgreSQL nao esta em execucao. Inicie a implantacao antes de criar o backup."
  }

  $postgresUser = Get-PostgresEnvironmentValue `
    -ComposeArguments $composeArguments `
    -VariableName "POSTGRES_USER"

  $postgresDatabase = Get-PostgresEnvironmentValue `
    -ComposeArguments $composeArguments `
    -VariableName "POSTGRES_DB"

  $timestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
  $backupFileName = "validade-$timestamp.dump"
  $backupPath = Join-Path $resolvedBackupDirectory $backupFileName
  $checksumPath = "$backupPath.sha256"
  $containerBackupPath = "/tmp/$backupFileName"

  Write-Host "Criando backup do PostgreSQL..." -ForegroundColor Cyan

  $dumpArguments = $composeArguments + @(
    "exec",
    "-T",
    "postgres",
    "pg_dump",
    "--username",
    $postgresUser,
    "--dbname",
    $postgresDatabase,
    "--format=custom",
    "--compress=9",
    "--file",
    $containerBackupPath
  )

  Invoke-DockerCommand `
    -Arguments $dumpArguments `
    -FailureMessage "O PostgreSQL nao conseguiu gerar o backup."

  $validateArguments = $composeArguments + @(
    "exec",
    "-T",
    "postgres",
    "pg_restore",
    "--list",
    $containerBackupPath
  )

  & docker @validateArguments | Out-Null
  $validateExitCode = $LASTEXITCODE

  if ($validateExitCode -ne 0) {
    throw "O arquivo criado nao foi reconhecido como um backup valido."
  }

  $copyArguments = $composeArguments + @(
    "cp",
    "postgres:$containerBackupPath",
    $backupPath
  )

  Invoke-DockerCommand `
    -Arguments $copyArguments `
    -FailureMessage "Nao foi possivel copiar o backup para o computador."

  if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
    throw "O arquivo de backup nao foi criado."
  }

  $backupFile = Get-Item -LiteralPath $backupPath

  if ($backupFile.Length -le 0) {
    throw "O arquivo de backup foi criado vazio."
  }

  $hash = (
    Get-FileHash `
      -LiteralPath $backupPath `
      -Algorithm SHA256
  ).Hash.ToLowerInvariant()

  Set-Content `
    -LiteralPath $checksumPath `
    -Value "$hash  $backupFileName" `
    -Encoding UTF8

  $sizeInMegabytes = [Math]::Round(
    $backupFile.Length / 1MB,
    2
  )

  Write-Host ""
  Write-Host "Backup criado com sucesso." -ForegroundColor Green
  Write-Host "Arquivo: $backupPath"
  Write-Host "Tamanho: $sizeInMegabytes MB"
  Write-Host "SHA-256: $hash"
  Write-Host "Arquivo de verificacao: $checksumPath"
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
finally {
  if (
    $null -ne $containerBackupPath -and
    $null -ne $composeArguments
  ) {
    $removeArguments = $composeArguments + @(
      "exec",
      "-T",
      "postgres",
      "rm",
      "-f",
      "--",
      $containerBackupPath
    )

    & docker @removeArguments 2>$null | Out-Null
  }
}