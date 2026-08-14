\# Aplicativo de Controle de Validade de Produtos



Monorepo da plataforma de controle de validade de produtos.



\## Tecnologias



\- NestJS

\- Next.js

\- TypeScript

\- Prisma ORM

\- PostgreSQL

\- Docker Compose

\- npm workspaces



\## AplicaÃ§Ãµes



\- Frontend: http://localhost:3100

\- API: http://localhost:3001

\- PostgreSQL: localhost:5433



\## PreparaÃ§Ã£o



```powershell

Copy-Item .env.example .env

Copy-Item apps\\api\\.env.example apps\\api\\.env

npm.cmd install

docker-compose up -d postgres

npm.cmd run db:generate

npm.cmd run db:seed
