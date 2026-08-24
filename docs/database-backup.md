\# Backup e restauração do PostgreSQL

Este documento descreve como criar e restaurar backups do banco de dados da aplicação de Controle de Validade de Produtos.

Os comandos utilizam a implantação definida em `docker-compose.deploy.yml` e as configurações locais do arquivo `.env.deploy`.

\## Requisitos

Antes de executar os scripts, confirme que:

\- o Docker Desktop está ativo;

\- o arquivo `.env.deploy` está configurado;

\- a implantação está em execução;

\- o serviço `postgres` está saudável;

\- os scripts estão sendo executados na raiz do projeto.

Verifique os serviços:

```powershell

docker compose `

&#x20; --env-file .\\.env.deploy `

&#x20; -f .\\docker-compose.deploy.yml `

&#x20; ps -a

```
