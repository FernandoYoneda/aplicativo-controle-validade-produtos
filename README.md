# Aplicativo de Controle de Validade de Produtos

Plataforma interna do Grupo CasaBella para administrar lojas, usuários, produtos, lotes e datas de validade.

O projeto utiliza um monorepo com uma API NestJS, uma aplicação web Next.js e PostgreSQL. Administradores possuem uma visão consolidada de todas as lojas, enquanto usuários de loja acessam somente os registros vinculados à própria unidade.

## Funcionalidades

### Administrador

- autenticação por login ou e-mail;
- painel consolidado com indicadores e registros prioritários;
- cadastro, consulta, atualização, ativação e inativação de lojas;
- cadastro, consulta, atualização, ativação e inativação de usuários de loja;
- cadastro, consulta, atualização, ativação e inativação de produtos;
- catálogo administrativo paginado, com busca por código, código de barras, nome, marca ou categoria;
- importação de produtos por arquivos XLSX, XLS ou CSV com pré-visualização, deduplicação e filtros de materiais não comercializáveis;
- gerenciamento de lotes, quantidades e datas de validade de todas as lojas;
- pesquisa por produto, loja, lote, data ou situação;
- acompanhamento de produtos vencidos, próximos do vencimento e dentro da validade.

### Usuário de loja

- autenticação por login ou e-mail;
- painel com indicadores da própria unidade;
- consulta e gerenciamento das validades vinculadas à sua loja;
- cadastro de lotes usando automaticamente a loja associada ao usuário;
- busca rápida de produtos ativos por código, código de barras ou nome durante o cadastro de validade;
- isolamento de dados entre unidades.

### Importação de produtos

Administradores podem importar o catálogo pela tela de Produtos. O sistema utiliza somente a coluna `Quebra 1`, no formato `código - nome do produto`, e apresenta uma prévia antes da confirmação.

Durante a análise:

- cada código é considerado apenas uma vez;
- produtos já cadastrados são ignorados;
- códigos repetidos com nomes diferentes são sinalizados para revisão;
- amostras e demonstradores são excluídos;
- sacolas, caixas, papéis de seda, etiquetas e outros materiais operacionais são excluídos;
- materiais com códigos iniciados por `999` são excluídos;
- arquivos CSV em UTF-8 ou Windows-1252 são aceitos.

O limite por arquivo é de 15 MB e 100.000 linhas.

## Tecnologias

- Node.js 22;
- TypeScript;
- NestJS 11;
- Next.js 16;
- React 19;
- Prisma ORM 7;
- PostgreSQL 16;
- Docker Compose;
- GitHub Container Registry;
- Jest e Supertest;
- ESLint e Prettier;
- GitHub Actions;
- npm workspaces.

## Estrutura do projeto

```text
.
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── publish-images.yml
├── apps/
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── prisma/
│   │   ├── src/
│   │   └── test/
│   └── web/
│       ├── Dockerfile
│       ├── public/
│       └── src/
├── .dockerignore
├── .env.deploy.example
├── docker-compose.deploy.yml
├── docker-compose.yml
├── package.json
└── README.md
```

## Requisitos

Instale os seguintes programas antes de iniciar:

- [Node.js 22](https://nodejs.org/);
- npm, incluído com o Node.js;
- [Docker Desktop](https://www.docker.com/products/docker-desktop/);
- Git.

Confirme as versões:

```powershell
node --version
npm.cmd --version
docker --version
docker compose version
git --version
```

## Configuração do ambiente

Na raiz do repositório, crie os arquivos locais a partir dos exemplos:

```powershell
Copy-Item .env.example .env
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env.local
```

### Banco de dados

O arquivo `.env` da raiz configura o contêiner PostgreSQL:

```dotenv
POSTGRES_DB=validade_db
POSTGRES_USER=validade
POSTGRES_PASSWORD=validade_dev
POSTGRES_PORT=5433
API_PORT=3001
WEB_PORT=3100
```

### API

Edite `apps/api/.env`:

```dotenv
PORT=3001
DATABASE_URL="postgresql://validade:validade_dev@localhost:5433/validade_db?schema=public"
ADMIN_NAME="Administrador"
ADMIN_EMAIL="admin@validade.local"
ADMIN_LOGIN="admin"
ADMIN_PASSWORD="defina-uma-senha-segura"
JWT_ACCESS_SECRET="defina-um-segredo-longo-e-aleatorio"
JWT_ACCESS_EXPIRES_IN_SECONDS=900
```

Regras importantes:

- `ADMIN_PASSWORD` deve possuir pelo menos 12 caracteres;
- `JWT_ACCESS_SECRET` não deve ser compartilhado nem versionado;
- a senha do banco em `DATABASE_URL` deve ser igual a `POSTGRES_PASSWORD`;
- arquivos `.env` são ignorados pelo Git.

### Aplicação web

O arquivo `apps/web/.env.local` informa onde a API está disponível:

```dotenv
API_URL="http://localhost:3001"
```

## Executar toda a aplicação com Docker

Com o Docker Desktop ativo e os arquivos de ambiente configurados, execute na raiz do projeto:

```powershell
docker compose up -d --build
docker compose ps -a
```

O Docker Compose:

- inicia o PostgreSQL e aguarda o banco ficar saudável;
- aplica automaticamente as migrações e executa o seed no serviço temporário `setup`;
- inicia a API somente após a preparação do banco terminar com sucesso;
- inicia a aplicação web somente após a API ficar saudável;
- mantém API e aplicação web em imagens de produção executadas por usuários sem privilégios administrativos.

O estado esperado é:

- `postgres`, `api` e `web` em execução e marcados como `healthy`;
- `setup` finalizado como `Exited (0)`, o que representa uma execução bem-sucedida.

Endereços locais:

| Serviço       | Endereço              |
| ------------- | --------------------- |
| Aplicação web | http://localhost:3100 |
| API           | http://localhost:3001 |
| PostgreSQL    | localhost:5433        |

As portas externas podem ser alteradas pelas variáveis `WEB_PORT`, `API_PORT` e `POSTGRES_PORT` do arquivo `.env` da raiz.

Para acompanhar os registros:

```powershell
docker compose logs -f api web
```

Use `Ctrl+C` para sair dos registros sem desligar os serviços.

Para encerrar a aplicação:

```powershell
docker compose down
```

Esse comando preserva o volume do PostgreSQL. Use `docker compose down -v` somente quando desejar apagar permanentemente os dados locais do banco.

## Implantação com imagens publicadas

O arquivo `docker-compose.deploy.yml` permite implantar a aplicação usando imagens prontas do GitHub Container Registry, sem compilar o código-fonte no servidor.

Imagens utilizadas:

- `ghcr.io/fernandoyoneda/aplicativo-controle-validade-produtos-setup`;
- `ghcr.io/fernandoyoneda/aplicativo-controle-validade-produtos-api`;
- `ghcr.io/fernandoyoneda/aplicativo-controle-validade-produtos-web`.

A versão escolhida precisa possuir as três imagens. A imagem `setup` será publicada a partir da primeira versão criada depois da inclusão deste processo de implantação.

### 1. Preparar o ambiente

Copie o modelo:

```powershell
Copy-Item .\.env.deploy.example .\.env.deploy
```

Abra o arquivo:

```powershell
notepad .\.env.deploy
```

Configure obrigatoriamente:

- `POSTGRES_PASSWORD`: senha forte do PostgreSQL;
- `ADMIN_PASSWORD`: senha inicial do administrador;
- `JWT_ACCESS_SECRET`: segredo longo e aleatório para os tokens;
- `APP_VERSION`: versão das imagens que será implantada.

Em produção, prefira uma versão fixa:

```dotenv
APP_VERSION=v1.2.0
IMAGE_PULL_POLICY=always
```

O uso de `latest` acompanha a publicação mais recente, mas torna atualizações e reversões menos previsíveis.

O arquivo `.env.deploy` contém segredos, é ignorado pelo Git e nunca deve ser enviado ao repositório.

### 2. Validar a configuração

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  config --quiet
```

A ausência de saída indica que a configuração é válida.

### 3. Baixar as imagens

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  pull
```

### 4. Iniciar a aplicação

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  up -d
```

Consulte o estado dos serviços:

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  ps -a
```

O estado esperado é:

- `postgres`, `api` e `web` em execução e saudáveis;
- `setup` finalizado como `Exited (0)`.

O serviço `setup` aplica as migrações e executa o seed antes da inicialização da API.

Por padrão:

| Serviço       | Endereço                    |
| ------------- | --------------------------- |
| Aplicação web | http://localhost:3100       |
| API           | http://127.0.0.1:3001       |
| Login         | http://localhost:3100/login |

A aplicação web aceita conexões externas por padrão. A API fica vinculada somente ao endereço local do servidor. O PostgreSQL não possui porta publicada na configuração de implantação.

### 5. Consultar os registros

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  logs -f api web
```

Use `Ctrl+C` para sair dos registros sem desligar os serviços.

Os registros da preparação do banco podem ser consultados com:

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  logs setup
```

### 6. Atualizar a aplicação

Altere `APP_VERSION` no arquivo `.env.deploy` para a nova versão e execute:

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  pull

docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  up -d
```

O volume do PostgreSQL é preservado durante a atualização.

### 7. Reverter uma versão

Altere `APP_VERSION` no arquivo `.env.deploy` para uma versão anterior que possua as imagens `setup`, `api` e `web`.

Em seguida, execute novamente os comandos `pull` e `up -d`.

### 8. Encerrar a aplicação

Para remover os contêineres preservando os dados:

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  down
```

Para também apagar permanentemente o banco:

```powershell
docker compose `
  --env-file .\.env.deploy `
  -f .\docker-compose.deploy.yml `
  down -v
```

Use `down -v` somente quando a exclusão definitiva dos dados for intencional.

## Instalação

Instale todas as dependências do monorepo:

```powershell
npm.cmd ci
```

Se estiver trabalhando sem um `package-lock.json` compatível, use `npm.cmd install`.

## Banco de dados

### 1. Iniciar o PostgreSQL

Abra o Docker Desktop e aguarde o mecanismo ficar disponível. Em seguida:

```powershell
docker compose up -d postgres
docker compose ps
```

O serviço deve aparecer como `healthy` e estará disponível em `localhost:5433`.

### 2. Validar o schema e gerar o cliente Prisma

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
```

### 3. Aplicar as migrações

```powershell
Set-Location apps\api
npx.cmd prisma migrate deploy --config prisma.config.ts
Set-Location ..\..
```

### 4. Executar o seed

```powershell
npm.cmd run db:seed
```

O seed:

- cria ou preserva as lojas `LJ001` até `LJ018`;
- cria o administrador configurado em `apps/api/.env`;
- preserva o administrador caso o login já exista.

## Executar em desenvolvimento

Mantenha o PostgreSQL ativo e abra dois terminais na raiz do projeto.

### Terminal 1 — API

```powershell
npm.cmd run dev:api
```

### Terminal 2 — aplicação web

```powershell
npm.cmd run dev:web
```

Endereços locais:

| Serviço       | Endereço              |
| ------------- | --------------------- |
| Aplicação web | http://localhost:3100 |
| API           | http://localhost:3001 |
| PostgreSQL    | localhost:5433        |

Acesse http://localhost:3100 e entre com o login e a senha definidos nas variáveis `ADMIN_LOGIN` e `ADMIN_PASSWORD`.

## Rotas principais da API

Todas as rotas abaixo, exceto o login e a rota de saúde, exigem um token JWT.

| Método  | Rota               | Perfis                          |
| ------- | ------------------ | ------------------------------- |
| `GET`   | `/`                | Público                         |
| `POST`  | `/auth/login`      | Público                         |
| `GET`   | `/auth/me`         | Autenticado                     |
| `GET`   | `/stores`          | Administrador                   |
| `POST`  | `/stores`          | Administrador                   |
| `PATCH` | `/stores/:id`      | Administrador                   |
| `GET`   | `/users`           | Administrador                   |
| `POST`  | `/users`           | Administrador                   |
| `PATCH` | `/users/:id`       | Administrador                   |
| `GET`   | `/products`        | Administrador e usuário de loja |
| `GET`   | `/products/search` | Administrador e usuário de loja |
| `POST`  | `/products`        | Administrador                   |
| `PATCH` | `/products/:id`    | Administrador                   |
| `GET`   | `/expirations`     | Administrador e usuário de loja |
| `POST`  | `/expirations`     | Administrador e usuário de loja |
| `PATCH` | `/expirations/:id` | Administrador e usuário de loja |

Usuários de loja recebem somente os registros da própria unidade e não podem cadastrar ou atualizar validades de outras lojas.

## Qualidade e testes

### Lint

```powershell
npm.cmd run lint
```

O comando executa o ESLint em todos os workspaces. Na API, o lint também aplica correções automáticas.

### Testes unitários da API

```powershell
npm.cmd run test --workspace=api -- --runInBand
```

### Testes E2E da API

Os testes E2E exigem o PostgreSQL ativo e as migrações aplicadas:

```powershell
npm.cmd run test:e2e --workspace=api -- --runInBand
```

A suíte cria dados com identificadores exclusivos, valida os fluxos administrativos e de usuários de loja e remove os registros temporários ao terminar.

### Cobertura dos testes unitários

```powershell
npm.cmd run test:cov --workspace=api -- --runInBand
```

### Build de produção

```powershell
npm.cmd run build
```

O comando compila a API e gera o build otimizado do frontend.

## Integração contínua

O workflow `.github/workflows/ci.yml` é executado:

- em pull requests destinados a `develop` ou `main`;
- após pushes em `develop` ou `main`;
- manualmente pela aba **Actions** do GitHub.

O job **Validar aplicação**:

1. inicia um PostgreSQL 16 temporário;
2. instala as dependências com `npm ci`;
3. valida o schema e gera o cliente Prisma;
4. aplica as migrações;
5. executa o lint;
6. verifica alterações inesperadas produzidas pelo lint;
7. executa os testes unitários;
8. executa os testes E2E;
9. compila a API e o frontend.

O job **Validar imagens Docker**:

1. prepara arquivos de ambiente temporários;
2. valida `docker-compose.yml`;
3. valida `docker-compose.deploy.yml`;
4. compila as imagens `setup`, `api` e `web`.

## Publicação das imagens

O workflow `.github/workflows/publish-images.yml` é executado quando uma tag no formato `v*.*.*` é enviada ao GitHub.

O workflow:

1. confirma que o commit da tag pertence à branch `main`;
2. autentica no GitHub Container Registry usando o token temporário do GitHub Actions;
3. compila as imagens `setup`, `api` e `web`;
4. adiciona metadados de origem, commit e versão;
5. publica cada imagem com a tag da versão;
6. atualiza a tag `latest`.

Nenhuma senha pessoal ou token permanente é armazenado no repositório.

## Proteção das branches

As branches `develop` e `main` possuem um ruleset ativo que:

- exige pull request;
- exige os checks **Validar aplicação** e **Validar imagens Docker** aprovados;
- exige a resolução das conversas;
- bloqueia force push;
- impede a exclusão das branches protegidas.

## Fluxo de contribuição

Crie cada alteração a partir da versão atualizada de `develop`:

```powershell
git switch develop
git pull --ff-only origin develop
git switch -c tipo/nome-da-alteracao
```

Antes de publicar:

```powershell
npm.cmd run lint
npm.cmd run test --workspace=api -- --runInBand
npm.cmd run test:e2e --workspace=api -- --runInBand
npm.cmd run build
git diff --check
```

Abra o pull request sempre com `develop` como branch base e aguarde os checks obrigatórios.

## Solução de problemas

### Docker não está disponível

Mensagem comum:

```text
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified
```

Abra o Docker Desktop, aguarde o mecanismo iniciar e confirme:

```powershell
docker compose ps
```

### PostgreSQL não aparece como saudável

Consulte os registros:

```powershell
docker compose logs postgres
```

Confirme também se a porta `5433` está livre e se o arquivo `.env` existe na raiz.

### Variável de ambiente não definida

Confirme a existência destes arquivos:

```text
.env
apps/api/.env
apps/web/.env.local
```

Compare cada arquivo local com seu respectivo `.env.example`.

### O seed rejeita a senha administrativa

Defina `ADMIN_PASSWORD` em `apps/api/.env` com pelo menos 12 caracteres e execute novamente:

```powershell
npm.cmd run db:seed
```

### Uma porta já está em uso

Verifique os processos que utilizam as portas do projeto:

```powershell
Get-NetTCPConnection -LocalPort 3001,3100,5433 -ErrorAction SilentlyContinue
```

Encerre o processo conflitante ou ajuste a configuração antes de reiniciar os serviços.

### Imagem de implantação não encontrada

Confirme se `APP_VERSION` aponta para uma versão que possui as três imagens publicadas:

```dotenv
APP_VERSION=v1.2.0
```

Consulte os pacotes publicados no GitHub Container Registry e confirme a existência das imagens `setup`, `api` e `web` para essa versão.

## Segurança

- não versione arquivos `.env`;
- use senhas e segredos diferentes em cada ambiente;
- troque os valores de desenvolvimento antes de uma implantação;
- mantenha o cookie de acesso como `HttpOnly`;
- não exponha diretamente o PostgreSQL em ambientes públicos;
- mantenha dependências e imagens Docker atualizadas;
- prefira versões fixas das imagens em produção;
- restrinja a API ao endereço local ou a uma rede privada.

## Licença

Projeto interno do Grupo CasaBella. O uso e a distribuição devem seguir as políticas da organização.
