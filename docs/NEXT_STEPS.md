# AXA Sign — Next Steps & Known Gaps

Priority legend: **[P0]** blocks a demo/launch · **[P1]** should be done next release · **[P2]** backlog.

---

## A. Immediate — smoke test the running stack (P0)

- [ ] Start `docker-compose up -d` and run `npm run db:push` + `npm run db:seed` (the seed script does not exist yet — see C).
- [ ] First end-to-end smoke test: register → org → upload contract → add participant(s) → send → sign via email link (MailHog): verify the PDF.js review, click-to-place signature field, canvas draw pad, sealed signed PDF in MinIO `signed/`, and generated certificate.
- [ ] Verify MinIO rasterization path in the signing worker actually renders (a classic first-failure point before the first sign).

---

## B. Phase 13 — Signing experience ✅ COMPLETED

Build, typecheck and Vite bundling all verified (pdf.js worker asset included).

- Done: token-gated document streaming (`GET /signing/session/:token/document`), PDF.js page-by-page viewer, click-to-place signature box (with page/x/y in PDF points), canvas drawing pad, typed signatures rendered as cursive PNGs, full review → place → sign → complete flow.
- Nice-to-have (P2): code-split pdf.js (`manualChunks`) to trim the 655 kB main chunk to the 200 kB logo; initial/date/checkbox field types matching the `FieldType` enum (only SIGNATURE is exercised today.

---

## C. Data / database (P0-P1)

- [ ] **Prisma migration workflow** — the repo uses `db:push` only; create the first `prisma migrate dev` baseline + commit migration files so deployments are reproducible.
- [ ] **Seed script** (`packages/database/prisma/seed.ts`) for a demo org, user, plan, and sample template — needed for any colleague demo.
- [ ] **Search** — no search index service yet (blueprint lists a Search datastore). For now add Postgres-based search on contracts/templates (PL/pgSQL or simple ILIKE) —[P2].
- [ ] OAuthClient / Permission models (blueprint items) not yet in the schema —[P2].

---

## D. Backend hardening (P1)

- [ ] **RBAC/ABAC permissions table** — roles exist (`UserRole` enum) but permissions (`contracts.*`, `templates.*`, `audit.read`…) are not enforced end-to-end (only `OWNER` gate on admin + `requireRole` on one route). Implement a capabilities map + `requirePermission` middleware (stub already exists in `api-key.ts`).
- [ ] **Idempotency keys** on `POST /contracts/:id/send` etc. (`Idempotency-Key` header) so retries never double-send emails/sessions.
- [ ] **MFA (TOTP)** and **SSO / OIDC / SAML / SCIM** — enterprise identity roadmap (P2, big chunk).
- [ ] **Rate-limit tuning** (express-rate-limit present, per-route limits not configured) + WAF-style headers.
- [ ] **CSRF protection** for cookie-based flows; ensure refresh tokens are rotated + stored hashed.
- [ ] **Malware/AV scanning** on document upload (ClamAV), plus sanitization of PDFs (QPDF) before signing.
- [ ] **KMS / encrypted secrets** (SMTP creds, storage keys, JWT secret) — env-file only today (fine for dev, not for prod).
- [ ] **Notifications**: SMS channel exists as a model but only email is implemented; add SMS provider adapter.
- [ ] `MAX_UPLOAD_SIZE` and storage quotas per plan should be enforced (constants exist in `packages/shared`).

---

## E. Evidence & compliance (P1)

- [ ] **Evidence package** on completion: `contract.pdf` + `certificate.pdf` + `audit-trail.pdf` + `manifest.json` (blueprint §18) — currently only the certificate is generated.
- [ ] **Timestamps** — trusted timestamping authority or TSA integration for cryptographic time; timestamps are app-generated today.
- [ ] Consider **PDF digital signatures** (PAdES/graphics) beyond the visual seal.

---

## F. Frontend completeness (P1)

- [ ] **API key management UI** in `apps/web` Settings (backend fully done, UI missing).
- [ ] **Template editor UI** — fields/roles/variable merge UI, and a "generate from template" flow surfaced in the dashboard.
- [ ] **Contract detail**: download signed PDF + certificate; timeline of events; participant status badges.
- [ ] **Admin panel**: real storage/queue metrics (`getStorageInfo`/`getQueueStatus` are placeholder-backed today); add billing/plan view.
- [ ] **Webhook endpoints UI** (create/list/delete + delivery log) in Settings — backend done, UI missing.
- [ ] PDF thumbnails/preview in the contracts list.

---

## G. Integration layer (P1-P2)

- [ ] **AXA CRM integration** first-class: `POST /templates/generate` exists — add `crmContext` input, `GET /contracts?status=`, and a `contract.completed` → CRM sink (mark deal signed, attach signed PDF, timeline event + store contract ID). Define the contract/API between AXA Sign and AXA CRM explicitly.
- [ ] Generalize the integration bus (blueprint §31) with adapters (Slack/Teams, Google Drive, Dropbox…) — P2; keep the core domain decoupled.

---

## H. Observability & analytics (P1-P2)

- [ ] Wire OpenTelemetry instrumentation (endpoint/secret placeholders exist in `.env.example`); add requestId/traceId propagation across queue jobs.
- [ ] Health/metrics endpoint for the API (admin `HealthPage` exists but needs backend data source beyond placeholders).
- [ ] Analytics pipeline (contracts created/sent/opened, completion rate, avg signing time, webhook failures) — blueprint §32.

---

## I. Packaging / delivery (P1)

- [ ] Write a proper `README.md` (this report covers it; fold key sections in).
- [ ] CI (GitHub Actions): install → db:generate → typecheck → build → lint → migrations on PR.
- [ ] Add `docs/` (architecture, API reference, security, compliance) per blueprint repo layout.
- [ ] Staging/prod deployment: Cloudflare → nginx → api + workers + postgres/redis/minio; secrets manager.

---

## J. Known gaps vs the master blueprint (todo.txt)

| Blueprint item | Status |
|---|---|
| Domain → Application → Infrastructure → HTTP layering per module | Partial — modules are service-class based; acceptable for v0.1 |
| Packaging `validation`, `observability`, `api-client` | Not created (logic lives in `shared`/inline) |
| Billing domain (plans exist, no billing logic) | Missing — `Plan` enum present only |
| Analytics pipeline | Missing |
| Search datastore | Missing |
| Enterprise identity (MFA/SSO/OIDC/SAML/SCIM/WebAuthn) | Missing — roadmap P2 |
| SMS channel | Model only, no adapter |
| Docs folder | Missing |
| Seed/migration baseline | Missing |

---

### Recommended order to land a colleague-demoable build

1. **A** (smoke test — now covers the new viewer + placement + draw pad) → 2. **F** highlights (API keys UI, download links, webhook UI) → 3. **C** (migration + seed) → 4. **G** CRM endpoint wiring → 5. **D/E** hardening → 6. **H/I** ops readiness.