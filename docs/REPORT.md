# AXA Sign — Project Report

**Status: v0.1.0 — full demo path implemented. All 14 phases (incl. Phase 13 signing experience) are built; `turbo typecheck` 25/25 and `turbo build` 30/30 tasks are green on Node 24/Linux-any.**

Developed from the master architecture blueprint in `todo.txt` (Tunaxa platform — AXA Sign owns the legal contract lifecycle while AXA CRM owns the business context).

---

## 1. What was built

A complete **modular-monolith monorepo** (TypeScript, npm workspaces + Turborepo) containing:

| Area | App / Package | Description |
|---|---|---|
| API | `apps/api` | Express 5 REST API, 11 modules, event dispatcher, JWT + API-key auth |
| Back-office | `apps/web` | React 19 dashboard (dashboard, contracts, templates, settings, auth) |
| Signing | `apps/signing-app` | Signer-facing app (`/session/:token`): PDF.js page-by-page viewer, click-to-place signature field, typed + canvas-drawn signatures, placement passed to the PDF sealer |
| Admin | `apps/admin` | Platform control center (overview, orgs, users, audit, queues, health, storage, certificates) |
| Workers | `apps/workers` | BullMQ workers: document, email, webhook (HMAC-signed), audit, cleanup |
| Core packages | `packages/*` | `database` (Prisma), `domain`, `shared`, `auth`, `crypto`, `pdf`, `storage`, `queue`, `events`, `notifications` |
| Infra | `infrastructure/` | Dockerfiles, nginx configs, full `docker-compose.yml` stack |

### Data model — 23 Prisma models
Organization, User, Team, Contract, ContractVersion, Document, Template, TemplateVersion, TemplateField, TemplateRole, Participant, SigningSession, SigningStep, Signature, SignatureEvidence, AuditEvent, Certificate, Notification, NotificationDelivery, WebhookEndpoint, WebhookDelivery, Integration, ApiKey — plus 13 enums (contract/participant status machines, field types, roles, plans, etc.).

### Domain design (as specified in the blueprint)
- **Contract lifecycle** with immutable versioning — a sent contract is frozen; changes create a new version + new signing transaction.
- **Signing workflow** (`SigningStep`) with per-step status; sequential ordering via `signingOrder`.
- **Signing sessions** — random, hashed (`sha256`) tokens, short-lived (72h), authenticated before signing, single-purpose, revocable by expiry.
- **Signature engine** — separates *appearance* (typed/drawn), *evidence* (who/what/when/IP/UA/hash, stored in `SignatureEvidence`), and *cryptographic sealing* (SHA-256 before/after + pdf-lib PDF sealing).
- **Hash-chain audit trail** — every `AuditEvent` links `previousHash`; `verifyAuditChain()` detects tampering; admin page exposes chain validity.
- **Event platform** — typed domain event bus (`contract.created`, `contract.sent`, `contract.viewed`, `participant.signed`, `contract.completed`, `certificate.generated`) wired to side effects in `apps/api/src/events/register.ts`.
- **Async queues** — API never waits on email/webhook providers (BullMQ, exponential backoff, retries).
- **Multi-tenancy** — every owned object carries `organizationId`; all queries scoped by the JWT org.

### Key flows implemented end-to-end
1. **Create → Send**: contract + participants → `POST /contracts/:id/send` → event dispatcher creates signing sessions, queues invitation emails, fans out webhooks.
2. **Sign**: signer opens the email link → session view → real PDF rendered page-by-page (PDF.js) → authenticate → click-to-place the signature box (or accept the default at the bottom of page 1) → typed (rendered as a cursive PNG) or drawn (canvas pad) signature → `page/x/y` (PDF points, top-left origin) + signature image sent to the sealer → PDF sealed with signature box, timestamp and embedded signature → stored in MinIO `signed/` → evidence hashes recorded → participant marked `SIGNED`. The document PDF is streamed to the signer by a token-gated endpoint (`GET /signing/session/:token/document`) that validates the already-hashed signing token.
3. **Complete**: last signer signs → contract auto-completes → certificate PDF generated → completion email → webhooks.
4. **Template → Contract**: `POST /templates/generate` merges variables, clones the template document, auto-creates participants from roles (this is the AXA CRM entry point).
5. **Machine access**: API-key system (`axa_…`, hashed at rest, revocable, org-scoped, max 10) via `X-API-Key` middleware.
6. **Admin**: platform metrics, org/user/audit listing, queue stats, health, storage info, certificate download.

### Infrastructure
- `docker-compose.yml`: postgres, redis, minio, api, workers, web, signing-app, nginx, mailhog (9 services).
- Nginx: reverse-proxy config for web, signing-app and API routing (`/api/v1`).

---

## 2. Tech stack

- **Frontend:** React 19 · Vite 6 · Tailwind CSS · TanStack Query 5 · Zustand · lucide-react
- **Backend:** Node 20+ · Express 5 · Zod · Prisma 6
- **Data:** PostgreSQL · Redis (BullMQ) · MinIO/S3 (AWS SDK v3)
- **PDF:** pdf-lib (+ PDF.js planned for phase 13 viewer)
- **Security:** Argon2 (password hashing) · JWT (short-lived access + refresh) · SHA-256 hash chains · HMAC-signed webhooks
- **Tooling:** TypeScript 5.7 · Turborepo 2 · npm workspaces

---

## 3. How to run

Requirements: Node.js >= 20, Docker (for postgres/redis/minio, or point `.env` at your own).

```bash
# 1. Install — from the project root (axa-sign/)
npm install

# 2. Approve install scripts (npm 11+ blocks them by default)
npm approve-scripts --allow-scripts-pending
npm approve-scripts @prisma/client @prisma/engines argon2 prisma esbuild msgpackr-extract

# 3. Start infrastructure
docker-compose up -d postgres redis minio mailhog

# 4. Prepare env + database
copy .env.example .env          # edit secrets for your environment
npm run db:generate             # generate Prisma Client
npm run db:push                 # apply schema to Postgres

# 5. Run everything in dev (Turborepo)
npm run dev
```

Apps (dev ports):
| App | URL |
|---|---|
| API | http://localhost:3000 (`/api/v1`) |
| Web dashboard | http://localhost:5173 |
| Signing app | http://localhost:5174 |
| Admin panel | http://localhost:5175 |
| MailHog (email catcher) | http://localhost:8025 |
| MinIO console | http://localhost:9001 |

Production build: `npm run build` (verified: all 15 turbo build tasks pass).

---

## 4. Verification status (updated 2026-09-09)

Verified on **Node v24.19.0 / npm 11.17.0**:

- `npm install` — OK (after approving blocked install scripts; removed non-existent `@types/pdf-lib`)
- `npx prisma generate` — OK (schema fixed: missing `SigningStep` back-relations, added `WebhookDelivery.status/error` + enum)
- `npx turbo typecheck` — **25/25 tasks pass**
- `npx turbo build` — **30/30 tasks pass** (API, workers, all 3 Vite apps; signing-app now bundles the pdf.js worker asset)

Phase 13 (signing experience) was added and verified in this same pass:
- `GET /signing/session/:token/document` — new token-gated PDF streaming endpoint
- Signing app: `DocumentViewer.tsx` (pdf.js render + click-to-place overlay), `SignaturePad.tsx` (canvas draw), `lib/signature.ts` (typed-name → cursive PNG), reworked `SigningPage.tsx` (review → place → sign)
- Notes: pdf.js adds ~655 kB to the JS bundle (199 kB gzipped) + a ~1.4 MB worker asset — cosmetic; can be code-split if optimization is wanted.

Fixes applied during verification:
- `packages/queue/connection.ts` — `createWorker<T, R>` result-generic
- `packages/auth/src/jwt.ts` — `SignOptions["expiresIn"]` typing for `expiresIn`
- `apps/api` — Prisma `Json` field casts (audit data, org settings, template field config, webhook payload), Express 5 route param casts, notification `deliveries` include, `SigningSession.contractId` derived via participant
- `apps/admin` layout → `<Outlet />`; `apps/signing-app` → TanStack Query v5 API + typed session payload
- Prisma schema corrections documented in section 1 / schema history

> Note: `npm run db:push` requires a running Postgres; it has not been executed in this environment. First full smoke test of the running stack (register → upload → send → sign via MailHog link → certificate/signed PDF in MinIO) is on the critical path — see NEXT_STEPS.md.

---

## 5. File map (highlights)

```
apps/api/src
├── server.ts            # bootstrap, registers event handlers
├── routes.ts            # /auth /signing public; 11 protected modules
├── middleware/          # api-key, error, request-id, require-org, validate
├── events/register.ts   # domain event → sessions, emails, webhooks, certificates
└── modules/             # auth, admin, api-keys, audit, certificates, contracts,
                         # documents, organizations, participants, signing,
                         # templates (+ template-engine), users, webhooks

apps/signing-app/src
├── components/DocumentViewer.tsx   # pdf.js render + click-to-place "SIGN HERE" overlay
├── components/SignaturePad.tsx     # canvas drawing pad → PNG data URL
├── lib/signature.ts                # typed name → cursive signature PNG
└── SigningPage.tsx                 # review → place → sign → complete flow

packages/database/prisma/schema.prisma   # the entire data model (source of truth)
packages/pdf/src/index.ts                # applySignatures, generateCertificate, validatePdf
packages/domain/src/                     # contract state machine, Zod schemas, verifyAuditChain
packages/queue/src/queues.ts             # 8 BullMQ queues
```

Full inventory: ~150 source files across 16 workspaces.

---

## 6. Security model (current)

- Argon2 password hashing; JWT access (15m) + refresh (7d) tokens; tokens signed server-side
- Signing tokens: random 32-byte, stored hashed, 72h expiry, required auth step before signing
- HMAC-SHA256 webhook signatures (`X-AXA-Signature`, `X-AXA-Event`, `X-AXA-Delivery-ID`) — verifiable by customers
- Org-scoped DB queries everywhere (`organizationId` filter); route-level guards + role gate for admin (`OWNER`)
- Multitenant isolation enforced in services; api keys hashed at rest

See NEXT_STEPS.md for hardening gaps (MFA, SSO, rate-limit tuning, CSRF, malware scanning, etc.).