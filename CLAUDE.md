# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FootEra** is a full-stack sports/fitness training platform (Portuguese-language app). It's a monorepo with a React frontend (Vite + PWA) and an Express backend, connected to PostgreSQL via Prisma.

## Development Commands
```bash
# Run full dev environment (server + client concurrently)
npm run dev

# Run individually
npm run dev:server   # Express with tsx watch (port 3001)
npm run dev:client   # Vite dev server (port 3000)

# Build for production
npm run build        # Vite + esbuild

# Database
npm run prisma:migrate   # Apply migrations
npm run prisma:studio    # Open Prisma web UI
npm run seed:all         # Seed exercises + base data

# Testing
npm run test             # Full E2E suite (Playwright)
npm run cy:run           # Cypress headless
npm run cy:open          # Cypress interactive

# Docker
docker-compose up        # Start PostgreSQL + backend + frontend
```

## Architecture

### Monorepo Structure
- `client/` — React 19 + Vite + TypeScript + TailwindCSS frontend
- `server/` — Express + TypeScript backend
- `shared/` — Shared types and Zod schemas used by both sides
- `migrations/` — Database migration scripts
- `tests/` — Playwright E2E tests
- `cypress/` — Cypress tests (mobile viewport 390×844)

### Frontend (`client/`)
- **Router:** Wouter (lightweight, ~50+ pages)
- **State/Data:** React Query (TanStack) for server state, Axios for HTTP
- **UI:** Radix UI components + Lucide icons + Framer Motion + TailwindCSS
- **Real-time:** Socket.io client (presence tracking, messaging)
- **Mobile:** Capacitor (Android support), PWA plugin
- **Path alias:** `@/` maps to `client/src/`

Key file: `client/src/routes.tsx` — all page routes
API config: `client/src/config.ts` — base URL (`VITE_API_URL` or `http://localhost:3001/api`)

### Backend (`server/`)
- **Framework:** Express 4 + TypeScript (run via `tsx`)
- **ORM:** Prisma 6 with PostgreSQL
- **Auth:** JWT + Passport.js + Google OAuth
- **Real-time:** Socket.io (presence, online status)
- **File storage:** AWS S3 via multer-s3
- **Video processing:** FFmpeg (fluent-ffmpeg)
- **Payments:** Mercado Pago SDK
- **Background jobs:** node-cron (2 AM ranking, 3 AM cold storage/billing, 3:30 AM purge, 4 AM expiry)

Entry point: `server/index.ts`
Database schema: `server/prisma/schema.prisma`

### API Structure
All routes are prefixed with `/api/`. Key route groups:
- `/api/auth/*` — login, Google OAuth
- `/api/treinos*` — training management (core feature)
- `/api/exercicios` — exercise catalog
- `/api/usuarios` — user profiles
- `/api/feed` — social feed
- `/api/mensagens` — messaging
- `/api/billing` — subscriptions/payments
- `/api/admin/*` — admin operations
- `/api/ranking` — leaderboards
- `/api/metodologias` — training methodologies

### Database (PostgreSQL)
- Docker port: **5555** (configured via `DATABASE_URL`)
- Key models: `Usuario`, `Treino*`, `Exercicio`, `ExercicioPersonalizado`, `Postagem`, `Desafio*`, `Assinatura`, `Metodologia`, `Turma`
- `Usuario` has role-specific profiles: `Atleta`, `Professor`, `Clube`, `Escolinha`, `Olheiro`

### Environment Variables
- `server/.env` (and `.env.development`, `.env.production`)
- `client/.env` (and environment variants)
- Key vars: `DATABASE_URL`, `JWT_SECRET`, `PORT` (default 3001), `VITE_API_URL`, `AWS_*`, `NODE_ENV`

### Path Aliases (tsconfig)
- `@/*` → `client/src/*`
- `server/*` → `server/*`
- `@shared/*` → `shared/*`

## Key Patterns

- **Validation:** Zod schemas in `shared/` used on both client and server
- **Auth middleware:** `authenticateToken` guards most server routes; separate admin/membership guards exist
- **Feature access:** `server/services/entitlements.ts` controls plan-based feature gating
- **Audit logging:** `server/services/audit.ts` tracks sensitive operations
- **User types:** The app distinguishes between Atleta, Professor, Clube, Escolinha, and Olheiro — many features are role-specific

## Code Conventions

- Comentários e mensagens de erro em português (é um app PT-BR)
- Componentes React em PascalCase, arquivos em kebab-case
- Sempre usar os schemas Zod de `shared/` para validação — nunca validar só no client ou só no server
- Rotas novas no backend seguem o padrão das existentes em `server/routes/`
- Cypress roda em viewport mobile 390×844 — desenvolver sempre mobile-first

## Important — Do Not

- Não trocar Wouter por React Router
- Não usar fetch direto — sempre usar Axios com o config de `client/src/config.ts`
- Não criar migrations manualmente — usar `npx prisma migrate dev`
- Não expor JWT_SECRET ou chaves AWS no client
- Não alterar porta do Docker (5555) sem atualizar DATABASE_URL

## Business Context

- Plataforma em fase MVP com time enxuto
- 5 perfis com permissões diferentes: Atleta, Professor, Clube, Escolinha, Olheiro
- Planos pagos via Mercado Pago — checar `entitlements.ts` antes de liberar features premium
- App em português brasileiro — textos, erros e comentários sempre em PT-BR
```

---

**Como aplicar:** substitua o conteúdo do arquivo `CLAUDE.md` na raiz do projeto por esse, depois no terminal do Claude Code:
```
> git add CLAUDE.md && commit "update CLAUDE.md with conventions and business context"