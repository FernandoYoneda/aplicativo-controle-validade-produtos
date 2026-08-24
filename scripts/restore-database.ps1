[CmdletBinding()]
param(
  [Parameter(Mandatory, Position = 0)]
  [string]$BackupFile,

  [string]$EnvFile = ".\.env.deploy",

  [string]$ComposeFile = ".\docker-compose.deploy.yml",

  [string]$SafetyBackupDirectory = ".\backups\pre-restore"
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

function Wait-DockerComposeServiceHealthy {
  param(
    [Parameter(Mandatory)]
    [string[]]$ComposeArguments,

    [Parameter(Mandatory)]
    [string]$Service,

    [int]$TimeoutSeconds = 120
  )

  $containerArguments = $ComposeArguments + @(
    "ps",
    "-q",
    $Service
  )

  $containerId = [string](& docker @containerArguments)
  $nativeExitCode = $LASTEXITCODE

  if (
    $nativeExitCode -ne 0 -or
    [string]::IsNullOrWhiteSpace($containerId)
  ) {
    throw "Nao foi possivel localizar o container do servico $Service."
  }

  $containerId = $containerId.Trim()
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    $inspectArguments = @(
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
      $containerId
    )

    $status = [string](& docker @inspectArguments 2>$null)
    $inspectExitCode = $LASTEXITCODE

    if ($inspectExitCode -eq 0) {
      $status = $status.Trim()

      if ($status -eq "healthy") {
        Write-Host "Servico $Service saudavel." -ForegroundColor Green
        return
      }

      if ($status -eq "unhealthy") {
        throw "O servico $Service ficou indisponivel apos a restauracao."
      }

      if ($status -eq "exited" -or $status -eq "dead") {
        throw "O servico $Service foi encerrado apos a restauracao."
      }
    }

    Start-Sleep -Seconds 2
  }

  throw "Tempo limite excedido aguardando o servico $Service."
}

$containerBackupPath = $null
$composeArguments = $null
$servicesStopped = $false
$databaseReset = $false
$restoreCompleted = $false

try {
  $resolvedBackupFile = (
    Resolve-Path `
      -LiteralPath $BackupFile
  ).Path

  $resolvedEnvFile = (
    Resolve-Path `
      -LiteralPath $EnvFile
  ).Path

  $resolvedComposeFile = (
    Resolve-Path `
      -LiteralPath $ComposeFile
  ).Path

  $backupItem = Get-Item -LiteralPath $resolvedBackupFile

  if ($backupItem.Length -le 0) {
    throw "O arquivo de backup esta vazio."
  }

  $checksumPath = "$resolvedBackupFile.sha256"

  if (-not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) {
    throw "O arquivo de verificacao SHA-256 nao foi encontrado: $checksumPath"
  }

  $checksumContent = (
    Get-Content `
      -LiteralPath $checksumPath `
      -Raw
  ).Trim()

  $expectedHash = (
    $checksumContent -split "\s+"
  )[0].ToLowerInvariant()

  if ($expectedHash -notmatch "^[a-f0-9]{64}$") {
    throw "O arquivo de verificacao SHA-256 possui formato invalido."
  }

  $actualHash = (
    Get-FileHash `
      -LiteralPath $resolvedBackupFile `
      -Algorithm SHA256
  ).Hash.ToLowerInvariant()

  if ($actualHash -ne $expectedHash) {
    throw "O SHA-256 do backup nao corresponde ao arquivo de verificacao."
  }

  Write-Host "SHA-256 do backup aprovado." -ForegroundColor Green

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
    throw "O servico PostgreSQL nao esta em execucao."
  }

  $postgresUser = Get-PostgresEnvironmentValue `
    -ComposeArguments $composeArguments `
    -VariableName "POSTGRES_USER"

  $postgresDatabase = Get-PostgresEnvironmentValue `
    -ComposeArguments $composeArguments `
    -VariableName "POSTGRES_DB"

  $temporaryName = "restore-$([Guid]::NewGuid().ToString('N')).dump"
  $containerBackupPath = "/tmp/$temporaryName"

  $copyArguments = $composeArguments + @(
    "cp",
    $resolvedBackupFile,
    "postgres:$containerBackupPath"
  )

  Invoke-DockerCommand `
    -Arguments $copyArguments `
    -FailureMessage "Nao foi possivel copiar o backup para o PostgreSQL."

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
    throw "O PostgreSQL nao reconheceu o arquivo como um backup valido."
  }

  Write-Host "Estrutura interna do backup aprovada." -ForegroundColor Green
  Write-Host ""
  Write-Host "ATENCAO: a restauracao substituira os dados atuais." -ForegroundColor Yellow
  Write-Host "Antes da substituicao sera criado um backup automatico de seguranca."
  Write-Host ""

  $confirmation = Read-Host "Digite RESTAURAR para continuar"

  if ($confirmation -cne "RESTAURAR") {
    Write-Host "Restauracao cancelada. Nenhum dado foi alterado." -ForegroundColor Yellow
    return
  }

  $backupScriptPath = Join-Path $PSScriptRoot "backup-database.ps1"

  if (-not (Test-Path -LiteralPath $backupScriptPath -PathType Leaf)) {
    throw "O script de backup de seguranca nao foi encontrado."
  }

  Write-Host ""
  Write-Host "Criando backup automatico de seguranca..." -ForegroundColor Cyan

  $powerShellExecutable = (Get-Process -Id $PID).Path

  $safetyBackupArguments = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $backupScriptPath,
    "-EnvFile",
    $resolvedEnvFile,
    "-ComposeFile",
    $resolvedComposeFile,
    "-BackupDirectory",
    $SafetyBackupDirectory
  )

  & $powerShellExecutable @safetyBackupArguments
  $safetyBackupExitCode = $LASTEXITCODE

  if ($safetyBackupExitCode -ne 0) {
    throw "O backup automatico de seguranca falhou. A restauracao foi interrompida."
  }

  Write-Host ""
  Write-Host "Interrompendo API e frontend..." -ForegroundColor Cyan

  $stopArguments = $composeArguments + @(
    "stop",
    "api",
    "web"
  )

  Invoke-DockerCommand `
    -Arguments $stopArguments `
    -FailureMessage "Nao foi possivel interromper a API e o frontend."

  $servicesStopped = $true

  Write-Host "Limpando o banco atual..." -ForegroundColor Cyan

  $resetArguments = $composeArguments + @(
    "exec",
    "-T",
    "postgres",
    "psql",
    "--username",
    $postgresUser,
    "--dbname",
    $postgresDatabase,
    "--set=ON_ERROR_STOP=1",
    "--command",
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION CURRENT_USER;"
  )

  Invoke-DockerCommand `
    -Arguments $resetArguments `
    -FailureMessage "Nao foi possivel preparar o banco para a restauracao."

  $databaseReset = $true

  Write-Host "Restaurando os dados..." -ForegroundColor Cyan

  $restoreArguments = $composeArguments + @(
    "exec",
    "-T",
    "postgres",
    "pg_restore",
    "--username",
    $postgresUser,
    "--dbname",
    $postgresDatabase,
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    $containerBackupPath
  )

  Invoke-DockerCommand `
    -Arguments $restoreArguments `
    -FailureMessage "A restauracao do banco falhou."

  $analyzeArguments = $composeArguments + @(
    "exec",
    "-T",
    "postgres",
    "psql",
    "--username",
    $postgresUser,
    "--dbname",
    $postgresDatabase,
    "--set=ON_ERROR_STOP=1",
    "--command",
    "ANALYZE;"
  )

  Invoke-DockerCommand `
    -Arguments $analyzeArguments `
    -FailureMessage "Os dados foram restaurados, mas a atualizacao das estatisticas falhou."

  $restoreCompleted = $true

  Write-Host "Reiniciando API e frontend..." -ForegroundColor Cyan

  $startArguments = $composeArguments + @(
    "up",
    "-d",
    "--no-deps",
    "api",
    "web"
  )

  Invoke-DockerCommand `
    -Arguments $startArguments `
    -FailureMessage "Os dados foram restaurados, mas os servicos nao puderam ser reiniciados."

  Wait-DockerComposeServiceHealthy `
    -ComposeArguments $composeArguments `
    -Service "api"

  Wait-DockerComposeServiceHealthy `
    -ComposeArguments $composeArguments `
    -Service "web"

  Write-Host ""
  Write-Host "Restauracao concluida com sucesso." -ForegroundColor Green
  Write-Host "Backup restaurado: $resolvedBackupFile"
  Write-Host "Backup anterior preservado em: $SafetyBackupDirectory"
}
catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red

  if ($databaseReset -and -not $restoreCompleted) {
    Write-Host "O banco foi limpo, mas nao foi totalmente restaurado." -ForegroundColor Red
    Write-Host "Use o backup automatico de seguranca para recuperar o estado anterior." -ForegroundColor Yellow
  }

  if ($servicesStopped -and -not $restoreCompleted) {
    Write-Host "A API e o frontend permanecem parados para proteger os dados." -ForegroundColor Yellow
  }

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