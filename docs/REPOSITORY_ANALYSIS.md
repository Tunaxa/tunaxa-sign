# Tunaxa Repository – Technical Analysis

## 1. Project Overview
Tunaxa (internally structured as `tunaxa-sign` / AXA Sign) is a modular-monolith electronic signature platform built with TypeScript, Node.js, and Turborepo. It manages legally binding electronic contract lifecycles, cryptographic PDF signing, evidence collection, and immutable hash-chained audit trails.

## 2. Repository Structure

| Folder/File | Purpose | Main Responsibility | Status |
|---|---|---|---|
| `tunaxa-sign/` | Root directory of the signature platform monorepo. | Houses all applications, shared libraries, configuration, and infrastructure files. | Implemented |
| `tunaxa-sign/apps/` | Monorepo applications directory. | Contains deployable user-facing frontends, the backend API, and background workers. | Implemented |
| `tunaxa-sign/apps/api/` | Main REST API service using Express 5. | Provides authentication, contract management, signing coordination, and webhooks. | Implemented |
| `tunaxa-sign/apps/web/` | Back-office dashboard for contract originators. | Provides user management, contract creation, and tracking using React 19 and Vite. | Partially implemented |
| `tunaxa-sign/apps/signing-app/` | Signer-facing public web application. | Renders PDFs via PDF.js and captures electronic/drawn signatures at specific coordinates. | Implemented |
| `tunaxa-sign/apps/admin/` | Super-admin back-office portal. | Displays platform metrics, organizations, audit logs, queues, and certificates. | Partially implemented |
| `tunaxa-sign/apps/workers/` | BullMQ asynchronous background processors. | Handles document processing, email delivery, webhook delivery, audit, and cleanup. | Implemented |
| `tunaxa-sign/packages/` | Monorepo shared packages directory. | Contains shared libraries across domain, database, cryptography, and infrastructure. | Implemented |
| `tunaxa-sign/packages/auth/` | Authentication utilities and middleware. | Handles JWT token issuance/verification and Argon2 password hashing. | Implemented |
| `tunaxa-sign/packages/crypto/` | Cryptographic utilities package. | Provides SHA-256 hashing, HMAC webhook signing, and token generation. | Implemented |
| `tunaxa-sign/packages/database/` | Database layer with Prisma ORM client. | Manages PostgreSQL access, connections, and database client exports. | Implemented |
| `tunaxa-sign/packages/domain/` | Core domain entities and validation rules. | Enforces contract state machines, Zod validation schemas, and audit chain verification. | Implemented |
| `tunaxa-sign/packages/events/` | In-memory domain event dispatcher. | Publishes and subscribes to application lifecycle events synchronously or asynchronously. | Implemented |
| `tunaxa-sign/packages/notifications/`| Notification delivery and templating package. | Formats and sends transactional emails via Nodemailer with HTML templates. | Implemented |
| `tunaxa-sign/packages/pdf/` | PDF manipulation and sealing engine. | Places signature appearances on PDFs using `pdf-lib` and generates completion certificates. | Implemented |
| `tunaxa-sign/packages/queue/` | BullMQ Redis queue abstraction. | Defines shared queue instances, worker connections, and job payload types. | Implemented |
| `tunaxa-sign/packages/shared/` | Shared constants, errors, and utility functions. | Provides standardized HTTP errors, validation types, and system-wide constants. | Implemented |
| `tunaxa-sign/packages/storage/` | S3-compatible object storage client. | Wraps AWS SDK v3 for uploading, streaming, and retrieving PDFs in MinIO/S3. | Implemented |
| `tunaxa-sign/infrastructure/` | Containerization and reverse proxy assets. | Stores Dockerfiles for apps and Nginx routing configuration files. | Implemented |
| `tunaxa-sign/infrastructure/docker/` | Docker build definitions. | Contains multi-stage Dockerfiles for API, web, signing-app, and background workers. | Implemented |
| `tunaxa-sign/infrastructure/nginx/` | Nginx configuration files. | Routes traffic to API (`/api/v1`), web dashboard, and signing app. | Implemented |
| `tunaxa-sign/prisma/schema.prisma` | Root schema mirror / legacy path. | Duplicates the master Prisma schema defining 23 models and 13 enums. | Implemented |
| `tunaxa-sign/.env.example` | Environment variable template. | Documents required configuration for databases, ports, secrets, and third-party services. | Implemented |
| `tunaxa-sign/.gitignore` | Git ignore rules file. | Excludes node_modules, build outputs, environment files, and local logs. | Implemented |
| `tunaxa-sign/docker-compose.yml` | Local orchestration specification. | Runs PostgreSQL, Redis, MailHog, MinIO (commented out), API, workers, and Nginx. | Implemented |
| `tunaxa-sign/package.json` | Monorepo root npm configuration. | Declares npm workspaces, root scripts, engine requirements, and script permissions. | Implemented |
| `tunaxa-sign/package-lock.json` | Lockfile for npm package dependencies. | Pins exact dependency versions for reproducible workspace builds. | Implemented |
| `tunaxa-sign/tsconfig.base.json` | Shared TypeScript compiler settings. | Enforces strict compiler options inherited across all workspaces. | Implemented |
| `tunaxa-sign/turbo.json` | Turborepo pipeline orchestration config. | Defines task dependencies, cache outputs, and persistent dev targets. | Implemented |
| `TunaxaSignDocs/` | Project technical documentation folder. | Stores architectural reports, gap analysis, next steps, and technical audit files. | Implemented |

## 3. Applications

- **`apps/api` (`@axa-sign/api`)**: The core backend application running on Express 5. It exposes 11 modular REST domains (Auth, Contracts, Documents, Signing, Participants, Templates, Admin, Audit, Certificates, API Keys, Webhooks) protected by JWT and API-key middleware, and triggers domain events upon business state changes.
- **`apps/web` (`@axa-sign/web`)**: The originator back-office dashboard built with React 19, Vite, and Tailwind CSS. It allows users to register, log in, create contract records, and view lists of existing contracts.
- **`apps/signing-app` (`@axa-sign/signing-app`)**: The dedicated public signer interface built with React 19, Vite, and PDF.js. It verifies the 72-hour token, streams the PDF securely, enables signers to click-to-place signatures or draw via canvas, and posts signature coordinates to the backend.
- **`apps/admin` (`@axa-sign/admin`)**: A control-plane web portal built with React 19 and Vite. It provides platform administrators with visibility into organizations, registered users, certificates, BullMQ queue status, and system health checks.
- **`apps/workers` (`@axa-sign/workers`)**: The background processing node application powered by BullMQ and Redis. It runs distinct workers for asynchronous tasks: document processing, email notifications via Nodemailer, HMAC-signed webhook delivery with retry backoff, audit event persistence, and expired token cleanup.

## 4. Packages Analysis

- **`packages/auth` (`@axa-sign/auth`)**: Encapsulates user authentication logic using Argon2 for password hashing and `jsonwebtoken` for access/refresh token generation. Exposes Express authentication middleware for route protection.
- **`packages/crypto` (`@axa-sign/crypto`)**: Provides core cryptographic operations using Node's `crypto` module. Handles SHA-256 document hashing, signing token generation, and HMAC-SHA256 signature calculations for webhook payloads.
- **`packages/database` (`@axa-sign/database`)**: Encapsulates database connectivity and Prisma client instantiation. Houses the authoritative `prisma/schema.prisma` file modeling organizations, contracts, participants, signatures, audit events, and API keys.
- **`packages/domain` (`@axa-sign/domain`)**: Houses pure business logic, Zod validation schemas, and domain state machines. Validates contract transition states (`DRAFT` → `SENT` → `COMPLETED` / `DECLINED` / `VOIDED`) and implements `verifyAuditChain` for SHA-256 hash-chain verification.
- **`packages/events` (`@axa-sign/events`)**: Implements an in-memory typed event bus using Node's `EventEmitter`. Handles platform events like `contract.created`, `contract.sent`, `participant.signed`, and `contract.completed`.
- **`packages/notifications` (`@axa-sign/notifications`)**: Transactional email notification service using Nodemailer. Generates responsive HTML email templates for contract invitations, signing confirmations, and contract completion notifications.
- **`packages/pdf` (`@axa-sign/pdf`)**: PDF manipulation engine built on `pdf-lib`. Handles coordinate-based visual signature and metadata embedding, PDF validation, and cryptographic certificate of completion generation.
- **`packages/queue` (`@axa-sign/queue`)**: Centralizes BullMQ queue configurations and shared Redis connections. Exposes strongly typed queue definitions for 8 system queues (document processing, PDF signing, email, SMS, webhooks, audit, certificates, cleanup).
- **`packages/shared` (`@axa-sign/shared`)**: Shared repository primitives containing system constants (file limits, token lifetimes), standard custom application errors (e.g., `NotFoundError`, `UnauthorizedError`), and formatting utilities.
- **`packages/storage` (`@axa-sign/storage`)**: Object storage client based on AWS SDK v3 (`@aws-sdk/client-s3`). Manages bucket initialization and stream-based uploads/downloads for original, processed, and signed PDFs in MinIO or AWS S3.

## 5. Configuration & Infrastructure

- **Environment & Secrets (`.env.example`)**: Configures application ports, PostgreSQL connection strings, Redis host, MinIO S3 credentials, SMTP mail credentials, JWT signing secrets, and webhook secrets. No active `.env` file is committed.
- **Orchestration (`docker-compose.yml`)**: Defines services for PostgreSQL 16, Redis 7, MailHog, API, background workers, Web, Signing App, and an Nginx reverse proxy. Note: MinIO service block is currently commented out in favor of local or external S3.
- **Containerization (`infrastructure/docker/`)**: Contains individual Dockerfiles for `api`, `workers`, `web`, and `signing-app` using multi-stage Node/Alpine setups.
- **Routing & Reverse Proxy (`infrastructure/nginx/`)**: Nginx reverse proxy maps `/api/v1` to the API service (port 3000), root to the web dashboard (port 5173), and signing subdomain/routes to the signing app (port 5174).
- **Monorepo & Build Tooling (`turbo.json`, `package.json`, `tsconfig.base.json`)**: Configured with Turborepo and npm workspaces (`apps/*`, `packages/*`). Pipeline orchestrates `dev`, `build`, `lint`, `typecheck`, and database commands across all packages with cached outputs.

## 6. Current Project Status

- **Implemented**:
  - Full backend REST API (`apps/api`) with 11 modules and JWT/API-key security.
  - Asynchronous background worker system (`apps/workers`) processing BullMQ queues.
  - Signer experience (`apps/signing-app`) with PDF.js document streaming, click-to-place signature placement, and canvas drawing.
  - PDF manipulation engine (`packages/pdf`) applying signature images and generating certificates.
  - Cryptographic verification via SHA-256 hash-chained audit trails.
  - Complete data model with 23 Prisma models and relational database integrity.
- **Partially Implemented**:
  - `apps/web`: Contract list and basic contract creation modal exist; file upload drag-and-drop, participant assignment UI, live audit trail component, and download buttons are missing.
  - `apps/web/src/pages/TemplatesPage.tsx` and `SettingsPage.tsx`: Render placeholder screens ("Templates coming soon", "API key management coming soon").
  - `apps/admin`: Pages render tables and queue cards, but metrics rely on approximate calculations (`storageBytes: documentCount * 250_000`) and mock health checks (`API`, `Workers`, `Email` return `true` without actual probes).
- **Missing**:
  - Prisma migration directory (`prisma/migrations`): Schema is managed exclusively via `db:push` without baseline migrations.
  - Database seed script (`packages/database/prisma/seed.ts`): Script referenced in `package.json` does not exist on disk.
  - Granular RBAC/ABAC permission enforcement (only basic role enum and admin OWNER check exist).
  - Production evidence ZIP compilation (`contract.pdf` + `certificate.pdf` + `audit.json`).
  - SMS notification provider adapter (SMS queue and enum exist, but no external SMS transport is wired).

## 7. Issues & Risks

1. **MinIO Commented Out in Docker Compose**: In `tunaxa-sign/docker-compose.yml`, the MinIO service definition is commented out. Running `docker-compose up` without an external S3 instance will cause storage operations to fail.
2. **Missing Database Migration History & Seed**: The database relies on `npm run db:push`. Without Prisma migrations, structural schema updates in staging/production risk data loss and lack version control. The absence of a seed script complicates onboarding and local testing.
3. **Frontend Incompleteness in Web App**: Originators in `apps/web` cannot upload PDF files directly from the UI or assign participants to contracts via the visual interface; features must be triggered via direct API calls.
4. **Discrepancy Between Schema Locations**: Schema exists at both `tunaxa-sign/prisma/schema.prisma` and `tunaxa-sign/packages/database/prisma/schema.prisma`. Maintaining duplicate schema files risks divergence.
5. **Admin Monitoring Placeholders**: `AdminService.getHealth()` hardcodes healthy statuses for API, Workers, Storage, and Email instead of probing real connections; storage bytes are approximated via document count multiplications.

## 8. Recommended Next Steps

### P0: Critical (Blocks Full Local Execution & Demo)
- **Uncomment / Configure Storage in Docker Compose**: Restore the MinIO service in `docker-compose.yml` or document the external S3 configuration so document uploads succeed out of the box.
- **Create Database Seed Script**: Implement `packages/database/prisma/seed.ts` to populate default organizations, admin/demo users, and sample templates for instant testing.
- **Create Initial Prisma Migration**: Run `npx prisma migrate dev --name init` in `packages/database` to create the formal SQL migration baseline.

### P1: High Priority (Core Feature Completion)
- **Implement Document Upload & Participant Management in Web App**: Complete `apps/web/src/pages/ContractsPage.tsx` and `ContractDetailPage.tsx` by adding file upload controls, participant list editing, and download links for completed PDFs/certificates.
- **Deduplicate Prisma Schema**: Consolidate schema definitions into `packages/database/prisma/schema.prisma` and point root scripts directly to it.
- **Complete Settings & Templates UI**: Implement API key generation/revocation and Webhook management UI in `apps/web/src/pages/SettingsPage.tsx`.

### P2: Medium Priority (Hardening & Enhancements)
- **Real Metrics & Health Probing**: Replace mock health checks and estimated storage values in `AdminService` with real ping probes and S3 bucket metadata queries.
- **Evidence Bundle Compilation**: Implement an archiver utility generating a complete ZIP package (signed PDF, certificate, and audit trail manifest) upon contract completion.
- **Idempotency & Rate Limiting**: Enforce `Idempotency-Key` headers on contract dispatch and tune route-level rate limits for public signing endpoints.

## 9. Final Summary
Tunaxa (`tunaxa-sign`) possesses a robust, well-architected backend and domain foundation. The core signing engine, cryptographic hash-chaining, BullMQ asynchronous queue system, and PDF coordinate sealing are fully functional and pass typecheck and build requirements. The primary gap lies in frontend completeness within the back-office web application (`apps/web`), deployment automation (Prisma migrations and seed scripts), and container storage readiness in Docker Compose.

---

## 10. Run Project Commands (Commandes d'Exécution)

### Prérequis
- **Node.js** >= 20.0.0
- **npm** >= 10.9.0
- **Docker & Docker Compose**

### 1. Installation des dépendances
Depuis le dossier `tunaxa-sign/` :
```bash
cd tunaxa-sign
npm install
npm run clean # (optionnel, pour nettoyer les caches)
```

*Note pour npm 11+ : si des scripts natifs sont bloqués, approuvez-les :*
```bash
npm approve-scripts @prisma/client @prisma/engines argon2 prisma esbuild msgpackr-extract
```

### 2. Démarrage de l'infrastructure Docker
Lancez les conteneurs requis (PostgreSQL, Redis, MailHog) :
```bash
docker-compose up -d postgres redis mailhog
```
*(Si MinIO est décommenté dans `docker-compose.yml`, ajoutez `minio` à la commande).*

### 3. Configuration de l'environnement & Base de données
Copiez le fichier d'exemple et appliquez le schéma Prisma :
```bash
cp .env.example .env
npm run db:generate
npm run db:push
```

### 4. Lancement en mode Développement
Lancez tous les microservices et applications simultanément via Turborepo :
```bash
npm run dev
```

### 5. Accès aux applications (Ports Locaux)
- **API REST** : [http://localhost:3000/api/v1](http://localhost:3000/api/v1)
- **Web Dashboard (Back-Office)** : [http://localhost:5173](http://localhost:5173)
- **Application de Signature** : [http://localhost:5174](http://localhost:5174)
- **Portail Super-Admin** : [http://localhost:5175](http://localhost:5175)
- **MailHog (Capture emails de test)** : [http://localhost:8025](http://localhost:8025)
- **MinIO Console (si activé)** : [http://localhost:9001](http://localhost:9001)

### 6. Commandes Utiles (Build, Vérification & Studio)
```bash
# Vérification TypeScript sur l'ensemble du monorepo
npm run typecheck

# Build de production de toutes les applications et packages
npm run build

# Ouvrir l'interface graphique Prisma Studio pour explorer la base de données
npm run db:studio
```
