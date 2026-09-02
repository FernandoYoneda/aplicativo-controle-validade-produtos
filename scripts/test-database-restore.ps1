[CmdletBinding()]
param(
  [Parameter(Mandatory, Position = 0)]
  [string]$BackupFile,

  [string]$EnvFile = ".\.env.deploy",

  [string]$ComposeFile = ".\docker-compose.deploy.yml"
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

$composeArguments = $null
$containerBackupPath = $null
$temporaryDatabase = $null
$temporaryDatabaseCreated = $false
$scriptExitCode = 0

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

  $temporaryName = "restore-test-$([Guid]::NewGuid().ToString('N')).dump"
  $containerBackupPath = "/tmp/$temporaryName"

  $copyArguments = $composeArguments + @(
    "cp",
    $resolvedBackupFile,
    "postgres:$containerBackupPath"
  )

  Invoke-DockerCommand `
    -Arguments $copyArguments `
    -FailureMessage "Nao foi possivel copiar o backup para o PostgreSQL."

  $listArguments = $composeArguments + @(
    "exec",
    "-T",
    "postgres",
    "pg_restore",
    "--list",
    $containerBackupPath
  )

  & docker @listArguments | Out-Null
  $listExitCode = $LASTEXITCODE

  if ($listExitCode -ne 0) {
    throw "O PostgreSQL nao reconheceu o arquivo como um backup valido."
  }

  Write-Host "Estrutura interna do backup aprovada." -ForegroundColor Green

  $temporaryDatabase = "validade_restore_test_$((
    [Guid]::NewGuid().ToString('N')
  ).Substring(0, 20))"

  if ($temporaryDatabase -notmatch "^validade_restore_test_[a-f0-9]{20}$") {
    throw "Nao foi possivel gerar um nome seguro para o banco temporario."
  }

  Write-Host "Criando banco temporario isolado..." -ForegroundColor Cyan

  $createArguments = $composeArguments + @(
    "exec",
    "-T",
    "postgres",
    "createdb",
    "--username",
    $postgresUser,
    "--maintenance-db",
    "postgres",
    "--template",
    "template0",
    $temporaryDatabase
  )

  Invoke-DockerCommand `
    -Arguments $createArguments `
    -FailureMessage "Nao foi possivel criar o banco temporario."

  $temporaryDatabaseCreated = $true

  Write-Host "Restaurando o backup no banco temporario..." -ForegroundColor Cyan

  $restoreArguments = $composeArguments + @(
    "exec",
    "-T",
    "postgres",
    "pg_restore",
    "--username",
    $postgresUser,
    "--dbname",
    $temporaryDatabase,
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    $containerBackupPath
  )

  Invoke-DockerCommand `
    -Arguments $restoreArguments `
    -FailureMessage "O backup nao pode ser restaurado no banco temporario."

  Write-Host "Validando tabelas essenciais e contagens..." -ForegroundColor Cyan

  $validationQuery = 'SELECT current_database() AS banco_teste, (SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migracoes, (SELECT COUNT(*) FROM products) AS produtos, (SELECT COUNT(*) FROM product_lots) AS lotes;'

  $queryArguments = $composeArguments + @(
    "exec",
    "-T",
    "postgres",
    "psql",
    "--username",
    $postgresUser,
    "--dbname",
    $temporaryDatabase,
    "--set=ON_ERROR_STOP=1",
    "--command",
    $validationQuery
  )

  Invoke-DockerCommand `
    -Arguments $queryArguments `
    -FailureMessage "As tabelas essenciais nao foram validadas apos a restauracao."

  Write-Host ""
  Write-Host "Teste de restauracao concluido com sucesso." -ForegroundColor Green
  Write-Host "Backup testado: $resolvedBackupFile"
  Write-Host "O banco ativo nao foi alterado."
} catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red
  $scriptExitCode = 1
} finally {
  if (
    $temporaryDatabaseCreated -and
    $null -ne $composeArguments -and
    $temporaryDatabase -match "^validade_restore_test_[a-f0-9]{20}$"
  ) {
    Write-Host "Removendo banco temporario..." -ForegroundColor Cyan

    $dropArguments = $composeArguments + @(
      "exec",
      "-T",
      "postgres",
      "dropdb",
      "--username",
      $postgresUser,
      "--maintenance-db",
      "postgres",
      "--force",
      $temporaryDatabase
    )

    & docker @dropArguments 2>$null | Out-Null
    $dropExitCode = $LASTEXITCODE

    if ($dropExitCode -ne 0) {
      Write-Host "Falha ao remover o banco temporario $temporaryDatabase." -ForegroundColor Red
      $scriptExitCode = 1
    }
  }

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

exit $scriptExitCode
