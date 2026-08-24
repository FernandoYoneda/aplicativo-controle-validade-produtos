[CmdletBinding()]
param(
  [ValidateSet("Install", "Status", "RunNow", "Remove")]
  [string]$Operation = "Status",

  [string]$TaskName = "ControleValidade-BackupPostgreSQL",

  [ValidatePattern("^([01]\d|2[0-3]):[0-5]\d$")]
  [string]$DailyAt = "02:00",

  [string]$EnvFile = ".\.env.deploy",

  [string]$ComposeFile = ".\docker-compose.deploy.yml",

  [string]$BackupDirectory = ".\backups\scheduled",

  [ValidateRange(1, 3650)]
  [int]$RetentionDays = 30,

  [ValidateRange(1, 10000)]
  [int]$MinimumBackups = 7,

  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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

function ConvertTo-CommandLineArgument {
  param(
    [Parameter(Mandatory)]
    [AllowEmptyString()]
    [string]$Value
  )

  $escapedValue = $Value.Replace('"', '\"')
  return "`"$escapedValue`""
}

function Get-BackupScheduledTask {
  param(
    [Parameter(Mandatory)]
    [string]$Name
  )

  return Get-ScheduledTask `
    -TaskName $Name `
    -ErrorAction SilentlyContinue
}

function Show-BackupScheduledTask {
  param(
    [Parameter(Mandatory)]
    [string]$Name
  )

  $task = Get-BackupScheduledTask -Name $Name

  if ($null -eq $task) {
    Write-Host "Tarefa nao instalada: $Name" -ForegroundColor Yellow
    return
  }

  $taskInfo = Get-ScheduledTaskInfo `
    -TaskName $Name

  $dailyTrigger = $task.Triggers |
    Select-Object -First 1

  [PSCustomObject]@{
    TaskName = $task.TaskName
    State = $task.State
    Enabled = $task.Settings.Enabled
    NextRunTime = $taskInfo.NextRunTime
    LastRunTime = $taskInfo.LastRunTime
    LastTaskResult = $taskInfo.LastTaskResult
    TriggerStartBoundary = $dailyTrigger.StartBoundary
    Execute = $task.Actions.Execute
    Arguments = $task.Actions.Arguments
    WorkingDirectory = $task.Actions.WorkingDirectory
  } |
    Format-List
}

try {
  $projectRoot = [System.IO.Path]::GetFullPath(
    (Split-Path -Parent $PSScriptRoot)
  )

  $scheduledBackupScript = Join-Path `
    $PSScriptRoot `
    "run-scheduled-database-backup.ps1"

  $envFilePath = Resolve-ProjectPath `
    -Path $EnvFile `
    -ProjectRoot $projectRoot

  $composeFilePath = Resolve-ProjectPath `
    -Path $ComposeFile `
    -ProjectRoot $projectRoot

  $backupDirectoryPath = Resolve-ProjectPath `
    -Path $BackupDirectory `
    -ProjectRoot $projectRoot

  switch ($Operation) {
    "Install" {
      if (
        -not (
          Test-Path `
            -LiteralPath $scheduledBackupScript `
            -PathType Leaf
        )
      ) {
        throw "Executor de backup nao encontrado: $scheduledBackupScript"
      }

      if (
        -not (
          Test-Path `
            -LiteralPath $envFilePath `
            -PathType Leaf
        )
      ) {
        throw "Arquivo de ambiente nao encontrado: $envFilePath"
      }

      if (
        -not (
          Test-Path `
            -LiteralPath $composeFilePath `
            -PathType Leaf
        )
      ) {
        throw "Arquivo do Docker Compose nao encontrado: $composeFilePath"
      }

      New-Item `
        -ItemType Directory `
        -Path $backupDirectoryPath `
        -Force |
        Out-Null

      $powerShellExecutable = (
        Get-Process -Id $PID
      ).Path

      if ([string]::IsNullOrWhiteSpace($powerShellExecutable)) {
        throw "Nao foi possivel identificar o executavel do PowerShell."
      }

      $taskArguments = @(
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        (
          ConvertTo-CommandLineArgument `
            -Value $scheduledBackupScript
        ),
        "-EnvFile",
        (
          ConvertTo-CommandLineArgument `
            -Value $envFilePath
        ),
        "-ComposeFile",
        (
          ConvertTo-CommandLineArgument `
            -Value $composeFilePath
        ),
        "-BackupDirectory",
        (
          ConvertTo-CommandLineArgument `
            -Value $backupDirectoryPath
        ),
        "-RetentionDays",
        $RetentionDays,
        "-MinimumBackups",
        $MinimumBackups
      ) -join " "

      $parsedTime = [DateTime]::ParseExact(
        $DailyAt,
        "HH:mm",
        [System.Globalization.CultureInfo]::InvariantCulture
      )

      $scheduledAction = New-ScheduledTaskAction `
        -Execute $powerShellExecutable `
        -Argument $taskArguments `
        -WorkingDirectory $projectRoot

      $scheduledTrigger = New-ScheduledTaskTrigger `
        -Daily `
        -At $parsedTime

      $scheduledSettings = New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -ExecutionTimeLimit (
          New-TimeSpan -Hours 2
        ) `
        -MultipleInstances IgnoreNew

      $currentIdentity = (
        [System.Security.Principal.WindowsIdentity]::GetCurrent()
      ).Name

      $scheduledPrincipal = New-ScheduledTaskPrincipal `
        -UserId $currentIdentity `
        -LogonType Interactive `
        -RunLevel Limited

      Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $scheduledAction `
        -Trigger $scheduledTrigger `
        -Settings $scheduledSettings `
        -Principal $scheduledPrincipal `
        -Description "Backup automatico do PostgreSQL do sistema de controle de validade." `
        -Force |
        Out-Null

      Write-Host "Tarefa instalada com sucesso." -ForegroundColor Green
      Write-Host "Nome: $TaskName"
      Write-Host "Horario diario: $DailyAt"
      Write-Host "Destino: $backupDirectoryPath"
      Write-Host "Retencao: $RetentionDays dias"
      Write-Host "Quantidade minima: $MinimumBackups"
      Write-Host ""
      Write-Host "A tarefa utiliza o Docker Desktop da sessao do usuario."
      Write-Host "O usuario deve estar conectado e o Docker deve estar ativo."
      Write-Host ""

      Show-BackupScheduledTask -Name $TaskName
    }

    "Status" {
      Show-BackupScheduledTask -Name $TaskName
    }

    "RunNow" {
      $task = Get-BackupScheduledTask -Name $TaskName

      if ($null -eq $task) {
        throw "Tarefa nao encontrada: $TaskName"
      }

      Start-ScheduledTask `
        -TaskName $TaskName

      Write-Host "Execucao solicitada com sucesso." -ForegroundColor Green
      Write-Host "Use a operacao Status para acompanhar o resultado."
    }

    "Remove" {
      $task = Get-BackupScheduledTask -Name $TaskName

      if ($null -eq $task) {
        Write-Host "Tarefa nao instalada: $TaskName" -ForegroundColor Yellow
        exit 0
      }

      if (-not $Force) {
        Write-Host ""
        Write-Host "ATENCAO: a tarefa agendada sera removida."
        Write-Host "Os backups existentes nao serao apagados."
        Write-Host ""

        $confirmation = Read-Host "Digite REMOVER para continuar"

        if ($confirmation -cne "REMOVER") {
          Write-Host "Remocao cancelada. Nenhuma tarefa foi alterada."
          exit 0
        }
      }

      Unregister-ScheduledTask `
        -TaskName $TaskName `
        -Confirm:$false

      Write-Host "Tarefa removida com sucesso." -ForegroundColor Green
      Write-Host "Os arquivos de backup foram preservados."
    }
  }

  exit 0
} catch {
  Write-Host ""
  Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}