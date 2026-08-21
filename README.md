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
- gerenciamento de lotes, quantidades e datas de validade de todas as lojas;
- pesquisa por produto, loja, lote, data ou situação;
- acompanhamento de produtos vencidos, próximos do vencimento e dentro da validade.

### Usuário de loja

- autenticação por login ou e-mail;
- painel com indicadores da própria unidade;
- consulta e gerenciamento das validades vinculadas à sua loja;
- cadastro de lotes usando automaticamente a loja associada ao usuário;
- isolamento de dados entre unidades.

## Tecnologias

- Node.js 22;
- TypeScript;
- NestJS 11;
- Next.js 16;
- React 19;
- Prisma ORM 7;
- PostgreSQL 16;
- Docker Compose;
- Jest e Supertest;
- ESLint e Prettier;
- GitHub Actions;
- npm workspaces.

## Estrutura do projeto

```text
.
├── .github/
│   └── workflows/
│       └── ci.yml
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
docker-compose version
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
docker-compose up -d --build
docker-compose ps -a
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
docker-compose logs -f api web
```

Use `Ctrl+C` para sair dos registros sem desligar os serviços. Para encerrar a aplicação:

```powershell
docker-compose down
```

Esse comando preserva o volume do PostgreSQL. Use `docker-compose down -v` somente quando desejar apagar permanentemente os dados locais do banco.

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
docker-compose up -d postgres
docker-compose ps
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

As validações automáticas:

1. iniciam um PostgreSQL 16 temporário;
2. instalam as dependências com `npm ci`;
3. validam o schema e geram o cliente Prisma;
4. aplicam as migrações;
5. executam lint;
6. verificam alterações inesperadas produzidas pelo lint;
7. executam os testes unitários;
8. executam os testes E2E;
9. compilam a API e o frontend.

A branch `develop` possui um ruleset ativo que:

- exige pull request;
- exige o check **Validar aplicação** aprovado;
- exige a resolução das conversas;
- bloqueia force push;
- impede a exclusão da branch.

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

Abra o pull request sempre com `develop` como branch base e aguarde o check obrigatório.

## Solução de problemas

### Docker não está disponível

Mensagem comum:

```text
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified
```

Abra o Docker Desktop, aguarde o mecanismo iniciar e confirme:

```powershell
docker-compose ps
```

### PostgreSQL não aparece como saudável

Consulte os logs:

```powershell
docker-compose logs postgres
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

## Segurança

- não versione arquivos `.env`;
- use senhas e segredos diferentes em cada ambiente;
- troque os valores de desenvolvimento antes de uma implantação;
- mantenha o cookie de acesso como `HttpOnly`;
- não exponha diretamente o PostgreSQL em ambientes públicos;
- mantenha dependências e imagens Docker atualizadas.

## Licença

Projeto interno do Grupo CasaBella. O uso e a distribuição devem seguir as políticas da organização.
