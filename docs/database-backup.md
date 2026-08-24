# Backup, restauração e automação do PostgreSQL

Este documento descreve como criar, validar, restaurar e automatizar os backups do banco PostgreSQL da aplicação de Controle de Validade de Produtos.

Os scripts utilizam a implantação configurada em `docker-compose.deploy.yml` e as variáveis locais do arquivo `.env.deploy`.

## Arquivos utilizados

| Arquivo                                     | Finalidade                                            |
| ------------------------------------------- | ----------------------------------------------------- |
| `scripts/backup-database.ps1`               | Cria um backup manual do PostgreSQL                   |
| `scripts/restore-database.ps1`              | Restaura um backup com verificações de segurança      |
| `scripts/run-scheduled-database-backup.ps1` | Executa backup automático, retenção e geração de logs |
| `scripts/manage-database-backup-task.ps1`   | Gerencia a tarefa agendada do Windows                 |
| `.env.deploy`                               | Armazena a configuração local da implantação          |
| `docker-compose.deploy.yml`                 | Define os serviços utilizados na implantação          |

## Requisitos

Antes de executar os scripts, confirme que:

- o Docker Desktop está instalado e ativo;
- o arquivo `.env.deploy` está configurado;
- a implantação está em execução;
- o serviço `postgres` está saudável;
- os comandos estão sendo executados na raiz do projeto;
- o PowerShell está disponível.

Verifique os serviços:

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  ps -a
```

O estado esperado é:

- `postgres` em execução e saudável;
- `setup` finalizado com `Exited (0)`;
- `api` em execução e saudável;
- `web` em execução e saudável.

## Criar um backup manual

Execute:

```powershell
.\scripts\backup-database.ps1
```

Por padrão, os arquivos serão gravados em:

```text
.\backups
```

Para cada backup, serão criados dois arquivos:

```text
validade-AAAAMMDD-HHMMSSmmm.dump
validade-AAAAMMDD-HHMMSSmmm.dump.sha256
```

O arquivo `.dump` contém os dados do PostgreSQL no formato custom do `pg_dump`.

O arquivo `.sha256` contém o código utilizado para verificar a integridade do backup.

## Escolher outro diretório

Use o parâmetro `BackupDirectory`:

```powershell
.\scripts\backup-database.ps1 `
  -BackupDirectory "C:\Backups\ControleValidade"
```

Também é possível utilizar uma pasta dentro do perfil do usuário:

```powershell
$backupDirectory = Join-Path `
  $env:LOCALAPPDATA `
  "ControleValidade\backups"

.\scripts\backup-database.ps1 `
  -BackupDirectory $backupDirectory
```

O diretório será criado automaticamente quando não existir.

## Verificar o SHA-256 manualmente

Selecione o backup mais recente:

```powershell
$backup = Get-ChildItem .\backups\*.dump |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
```

Calcule e compare o SHA-256:

```powershell
$expectedHash = (
  Get-Content `
    -LiteralPath "$($backup.FullName).sha256" `
    -Raw
).Trim().Split()[0]

$actualHash = (
  Get-FileHash `
    -LiteralPath $backup.FullName `
    -Algorithm SHA256
).Hash.ToLowerInvariant()

[PSCustomObject]@{
  Arquivo = $backup.FullName
  Esperado = $expectedHash
  Calculado = $actualHash
  Valido = $expectedHash -eq $actualHash
}
```

O campo `Valido` deve apresentar `True`.

## Restaurar um backup

Selecione o arquivo desejado:

```powershell
$backup = Get-ChildItem .\backups\*.dump |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
```

Confira o arquivo selecionado:

```powershell
$backup |
  Select-Object FullName, Length, LastWriteTime
```

Inicie a restauração:

```powershell
.\scripts\restore-database.ps1 `
  -BackupFile $backup.FullName
```

Antes de alterar o banco, o script:

1. confirma a existência do backup;
2. valida o arquivo SHA-256;
3. copia temporariamente o backup para o contêiner;
4. valida a estrutura interna com `pg_restore`;
5. solicita confirmação explícita;
6. cria um backup automático de segurança;
7. interrompe temporariamente a API e o frontend;
8. recria o schema público;
9. restaura os dados;
10. reinicia a API e o frontend;
11. aguarda os serviços retornarem ao estado saudável;
12. remove os arquivos temporários do contêiner.

Para autorizar a substituição dos dados, digite exatamente:

```text
RESTAURAR
```

Qualquer outro texto cancela a operação sem substituir o banco.

## Backup anterior à restauração

Antes de restaurar o arquivo selecionado, o script cria automaticamente um backup do estado atual.

Esse backup é armazenado em:

```text
.\backups\pre-restore
```

Ele deve ser preservado até que a restauração seja conferida.

## Validar o banco restaurado

Verifique os serviços:

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  ps -a
```

Valide a API:

```powershell
Invoke-RestMethod http://127.0.0.1:3201/
```

Valide o frontend:

```powershell
(
  Invoke-WebRequest `
    http://localhost:3200/login `
    -UseBasicParsing
).StatusCode
```

A porta utilizada depende das variáveis `API_PORT` e `WEB_PORT` do arquivo `.env.deploy`.

## Executar o backup automático manualmente

O script de execução automática também pode ser iniciado diretamente:

```powershell
.\scripts\run-scheduled-database-backup.ps1
```

Configuração personalizada:

```powershell
.\scripts\run-scheduled-database-backup.ps1 `
  -BackupDirectory "C:\Backups\ControleValidade" `
  -RetentionDays 30 `
  -MinimumBackups 7
```

Esse script:

- impede duas execuções simultâneas;
- cria o backup e o arquivo SHA-256;
- confirma que os arquivos foram gerados;
- registra a execução em arquivo de log;
- remove backups vencidos conforme a retenção;
- preserva a quantidade mínima configurada;
- remove arquivos temporários;
- retorna código diferente de zero em caso de erro.

## Política de retenção

Os parâmetros de retenção são:

| Parâmetro        | Significado                                        |
| ---------------- | -------------------------------------------------- |
| `RetentionDays`  | Idade mínima para que um backup possa ser removido |
| `MinimumBackups` | Quantidade mínima de backups que será preservada   |

Exemplo:

```powershell
-RetentionDays 30 -MinimumBackups 7
```

Nesse exemplo:

- backups com até 30 dias são preservados;
- backups mais antigos podem ser removidos;
- pelo menos os 7 backups mais recentes permanecem armazenados.

O arquivo `.sha256` correspondente é removido junto com o backup vencido.

## Logs automáticos

Os logs são armazenados dentro do diretório configurado para os backups:

```text
<DIRETORIO-DE-BACKUP>\logs
```

Para visualizar o log mais recente:

```powershell
$backupDirectory = Join-Path `
  $env:LOCALAPPDATA `
  "ControleValidade\backups"

$latestLog = Get-ChildItem `
  -LiteralPath (Join-Path $backupDirectory "logs") `
  -Filter "*.log" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

Get-Content `
  -LiteralPath $latestLog.FullName `
  -Encoding UTF8
```

## Instalar a tarefa agendada do Windows

A configuração recomendada executa o backup diariamente às `02:00`, preserva backups por 30 dias e mantém no mínimo 7 arquivos.

```powershell
$taskName = "ControleValidade-BackupPostgreSQL"

$backupDirectory = Join-Path `
  $env:LOCALAPPDATA `
  "ControleValidade\backups"

.\scripts\manage-database-backup-task.ps1 `
  -Operation Install `
  -TaskName $taskName `
  -DailyAt "02:00" `
  -BackupDirectory $backupDirectory `
  -RetentionDays 30 `
  -MinimumBackups 7
```

A tarefa utiliza:

- a sessão do usuário que realizou a instalação;
- o Docker Desktop dessa sessão;
- o arquivo `.env.deploy` do projeto;
- o arquivo `docker-compose.deploy.yml`;
- o script `run-scheduled-database-backup.ps1`.

O usuário precisa estar conectado e o Docker Desktop precisa estar ativo.

Se o computador estiver indisponível no horário programado, a configuração permite que o Windows tente iniciar a tarefa quando ela voltar a ficar disponível.

## Consultar a tarefa agendada

```powershell
.\scripts\manage-database-backup-task.ps1 `
  -Operation Status `
  -TaskName "ControleValidade-BackupPostgreSQL"
```

Informações apresentadas:

- estado atual;
- habilitação;
- próxima execução;
- última execução;
- resultado da última execução;
- programa utilizado;
- argumentos;
- diretório de trabalho.

Antes da primeira execução, o código `267011` indica apenas que a tarefa ainda não foi executada.

O código `0` indica uma execução concluída com sucesso.

## Executar a tarefa imediatamente

```powershell
.\scripts\manage-database-backup-task.ps1 `
  -Operation RunNow `
  -TaskName "ControleValidade-BackupPostgreSQL"
```

Depois consulte o resultado:

```powershell
.\scripts\manage-database-backup-task.ps1 `
  -Operation Status `
  -TaskName "ControleValidade-BackupPostgreSQL"
```

## Remover a tarefa agendada

Remoção com confirmação:

```powershell
.\scripts\manage-database-backup-task.ps1 `
  -Operation Remove `
  -TaskName "ControleValidade-BackupPostgreSQL"
```

Para confirmar, digite exatamente:

```text
REMOVER
```

Remoção sem pergunta interativa:

```powershell
.\scripts\manage-database-backup-task.ps1 `
  -Operation Remove `
  -TaskName "ControleValidade-BackupPostgreSQL" `
  -Force
```

A remoção da tarefa não apaga os backups existentes.

## Atualizar a configuração da tarefa

Para alterar horário, diretório ou retenção, execute novamente a operação `Install` com os valores desejados:

```powershell
.\scripts\manage-database-backup-task.ps1 `
  -Operation Install `
  -TaskName "ControleValidade-BackupPostgreSQL" `
  -DailyAt "03:00" `
  -BackupDirectory "C:\Backups\ControleValidade" `
  -RetentionDays 60 `
  -MinimumBackups 14
```

A tarefa existente será atualizada.

## Proteção contra execuções simultâneas

O backup automático utiliza um arquivo de bloqueio:

```text
.backup.lock
```

Enquanto uma execução estiver ativa, outra tentativa será recusada.

O arquivo é removido ao final da execução, inclusive quando ocorre uma falha controlada.

Além disso, a tarefa agendada utiliza a política `IgnoreNew`, impedindo que o Windows inicie uma segunda instância enquanto a primeira ainda estiver sendo executada.

## Segurança

Siga estas recomendações:

- não adicione `.env.deploy` ao Git;
- não adicione o diretório `backups` ao Git;
- utilize senhas fortes no PostgreSQL;
- proteja o acesso ao diretório dos backups;
- mantenha ao menos uma cópia fora do computador da aplicação;
- utilize armazenamento criptografado;
- restrinja o acesso aos arquivos `.dump`;
- valide regularmente os arquivos SHA-256;
- faça testes periódicos de restauração;
- preserve o backup automático criado antes de uma restauração.

Os backups podem conter informações sensíveis da aplicação.

## Cópias externas

A automação local protege contra falhas lógicas e substituições acidentais, mas não protege contra perda completa do computador.

Mantenha cópias adicionais em pelo menos um destes locais:

- servidor de arquivos protegido;
- unidade externa criptografada;
- armazenamento em nuvem corporativo;
- serviço dedicado de backup.

Uma boa prática é manter:

- uma cópia no computador da aplicação;
- uma cópia em outro dispositivo;
- uma cópia fora do local físico principal.

## Solução de problemas

### Docker não está ativo

Inicie o Docker Desktop e aguarde o mecanismo ficar disponível.

Depois execute:

```powershell
docker info
```

### Serviço PostgreSQL não está saudável

Verifique:

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  ps -a
```

Consulte os logs:

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  logs postgres
```

### Tarefa terminou com erro

Consulte o status:

```powershell
.\scripts\manage-database-backup-task.ps1 `
  -Operation Status `
  -TaskName "ControleValidade-BackupPostgreSQL"
```

Depois abra o log mais recente no diretório `logs`.

### A tarefa não executou no horário

Confirme que:

- o usuário estava conectado;
- o Docker Desktop estava ativo;
- o serviço PostgreSQL estava em execução;
- a tarefa estava habilitada;
- o arquivo `.env.deploy` continuava no caminho registrado;
- o projeto não foi movido para outro diretório.

Se o projeto for movido, instale novamente a tarefa para atualizar os caminhos.

### SHA-256 inválido

Não restaure o backup.

Um resultado divergente pode indicar:

- arquivo incompleto;
- corrupção;
- alteração posterior;
- arquivo `.sha256` pertencente a outro backup.

Utilize outra cópia válida.

### Restauração interrompida

Consulte:

```text
.\backups\pre-restore
```

O backup de segurança criado antes da operação pode ser utilizado para recuperar o estado anterior.

## Validação contínua

O workflow `.github/workflows/database-operations.yml` valida automaticamente a sintaxe de todos os arquivos PowerShell dentro de:

```text
scripts
```

A validação é executada em pull requests e atualizações destinadas às branches `develop` e `main`.
