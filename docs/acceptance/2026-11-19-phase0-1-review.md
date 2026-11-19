# Phase 0/1 Acceptance Review — 2026-11-19

Reviewed commit: `2cd72f3bad1d6f969767ec9542c457697a411a98` (`dev`, clean at start).

## Overall status

PASS/FAIL/NOT VERIFIED counts across the eight requested In Review tickets:

- PASS: 5
- FAIL: 2
- NOT VERIFIED: 1

| Ticket | Status | Basis |
| --- | --- | --- |
| TUN2-1 | NOT VERIFIED | Local env/bootstrap works, but “errors documented in ticket” could not be checked without Linear access. |
| TUN2-2 | PASS | Empty-DB migration applies cleanly; schema drift diff is empty; current-version FK exists. |
| TUN2-3 | PASS | Seed is idempotent, PDF hash matches S3, production seeding is refused by default. |
| TUN2-4 | PASS | PDF package tests pass and single-signer signing works; multi-signer overwrite is recorded separately under TUN2-8. |
| TUN2-7 | FAIL | Parallel upload to the same contract returns one `201` and one `500` with `INTERNAL_ERROR`. |
| TUN2-9 | FAIL | Template PDF is a cloned reference; variables are stored in metadata but not rendered into the PDF. |
| TUN2-48 | PASS | CI workflow is active, PR check is green, push check on reviewed commit is green, red-proof PR failed as expected. |
| TUN2-79 | PASS | Send creates one session, queues one invite job, redacts raw token paths from notifications, and uses 72-hour expiry. |

## Summary of work done

- Verified `dev` was clean and at `origin/dev`, then reviewed the exact commit without changing code, tests, config, workflows, frontend, or CHANGELOG.
- Started the current stack with `docker compose build api workers` and `docker compose up -d postgres redis minio mailhog api workers`; health returned `200` and workers logged `All workers started`.
- Exercised API flows with seeded agent/admin logins without printing tokens: auth, contracts, documents, participants, send, signing session, authenticate, sign, download, and delete.
- Ran uncached unit/integration suites, typecheck, build, lint, audit, migrations, seed idempotency, production-seed refusal, race checks, a three-iteration signing replay, and a fresh-clone install/migrate/typecheck/build/test from the exact commit.
- Checked CI, PR #88/#89 state, check runs, workflow runs, and branch protection through the GitHub REST API.
- Cleaned all generated contracts, documents, participants, sessions, MailHog messages, queue jobs, MinIO objects, notifications, throwaway bucket, throwaway DB, and temp clone. No seed data or audit rows were removed with raw SQL.

## Acceptance matrix details

### TUN2-1 — local dev/env bootstrap: NOT VERIFIED

- `docker compose` stack starts and API health returns `200`.
- `scripts/with-env.mjs` loads `.env` via `process.loadEnvFile(envPath)`.
- `.env.example` contains example seed credentials; production seeding is blocked unless explicitly overridden.
- README quickstart/CI context is present and consistent with local startup.
- Not verified: ticket-specific “errors documented in ticket” acceptance item; no Linear access was available.

### TUN2-2 — migration baseline: PASS

- `npm run db:migrate:status`: `1 migration found`, `Database schema is up to date!`.
- `20261114101048_init` applies cleanly to empty `axa_sign_review`.
- Empty DB after migration: 24 tables, 1 applied migration.
- `prisma migrate diff` from empty DB to schema emitted only the empty-migration comment and exited `0`.
- `Contract.currentVersionId` FK to contract versions: true.
- Active package schema uses `env("DATABASE_URL")`; no `db:push` scripts are configured.

### TUN2-3 — seed data: PASS

- Two consecutive `npm run db:seed` runs exited `0`.
- Counts before and after were identical: `organizations=1`, `users=2`, `templates=1`, `template_versions=1`, `template_fields=3`, `template_roles=2`, `documents=7`, `contracts=4`.
- Seed document `seed_nda_document_v1`: DB size `2788`, S3 size `2788`, masked SHA `481d1b7f...0283`, DB/S3 hash match true.
- Production seed refusal: `Refusing to seed production. Set SEED_ALLOW_PRODUCTION=true to override intentionally.`

### TUN2-4 — PDF sealing: PASS

- PDF test suite: 2 tests, 2 pass, 0 fail.
- Three-iteration replay produced two signed objects and one certificate object per completed contract.
- Contract final status reached `COMPLETED` after all signers signed.
- Multi-signer chain issue is recorded in Findings as TUN2-8.

### TUN2-7 — document upload/versioning: FAIL

- Sequential upload works: generated contract, uploaded PDF, participants, send, sign, and download all returned expected statuses.
- Parallel upload of two files with the same name to the same contract returned `[201,500]`; failure body was `{"error":"Internal server error","code":"INTERNAL_ERROR"}`.
- After the race, DB counts were `documents=1`, `contract_versions=1`, `contracts=1`, showing one upload attempt was lost.

### TUN2-9 — template generation: FAIL

- `POST /api/v1/templates/generate` returned `201`.
- Generated document storage key was `templates/<org>/nda-template-v1.pdf`, matching the template source rather than a newly rendered PDF.
- Request variables were stored in document metadata only.
- The template source draws `{{company_name}}` and `{{effective_date}}`; source inspection confirms generation clones the source reference and does not merge variables into PDF content.

### TUN2-48 — CI workflow: PASS

- `.github/workflows/ci.yml` is active (`id=424329212`) and runs on PRs and pushes to `dev`/`main`.
- PR #88 head `14f57b47e7cd8c74ed1cbe4d869006fdc0820c2a`: `ci` check completed with `success`.
- Push run `44618302998` on reviewed commit `2cd72f3...`: all CI steps succeeded, including empty-DB migrations, typecheck, lint, build, and test.
- Red-proof PR #89 run `44617542822` failed at `Test`; PR was closed unmerged.
- Branch protection endpoint returned HTTP 404 for both `dev` and `main`, so required-check enforcement could not be verified.

### TUN2-79 — sign send/session: PASS

- Send returned `200`; DB counts were `sessions=1`, `CC sessions=0`, `steps=1`, `audit=1`, expiry hours `72.0`.
- One queued email job carried a token hash that matched the DB hash.
- Notification body contained a redacted link and did not contain the raw token path.
- Authenticate and sign succeeded; invalid session returned `404`.

## Findings

1. TUN2-8 — multi-signer sealing overwrites earlier signatures. Two signers produced two signed objects, but each PDF contained exactly one embedded image object (`1`, `1`). Final signed state did not carry both signatures. Severity: high.
2. TUN2-7 — parallel upload race. Same-name simultaneous uploads returned `[201,500]` and left only one document/version. Severity: high.
3. TUN2-9 — template variables are not rendered. Generated document reuses source `storageKey`; variables are metadata only. Severity: high.
4. TUN2-81 — cross-org standalone document access. A document from org A was readable, downloadable, and deletable by an authenticated user from org B (`200`, `200`, `204`). Severity: high.
5. TUN2-80 — participants route mismatch. `GET /api/v1/contracts/:id/participants` returned `404`; working route is `/api/v1/participants/contracts/:id/participants`. Severity: medium.
6. TUN2-12 — auth rate limiter is active but threshold was not cleanly verified. 101 requests to `/auth/me` produced first `401`, first `429` at request 61, and last `429`; the IP had prior traffic. Severity: informational / verification gap.
7. Supply-chain hygiene: `npm audit --json` reported `total=13`, `critical=1`, `high=9`, `moderate=3`, `low=0`, `info=0`. Severity: high tracker item.
8. Config drift: stale root `prisma/schema.prisma` uses a non-env datasource URL while `packages/database/prisma/schema.prisma` correctly uses `env("DATABASE_URL")`. Severity: low.
9. CI quality gap: `npm run lint` exits `0` but is a no-op because no workspace defines a lint script. Severity: low.
10. Branch protection: GitHub returned HTTP 404 for `/branches/dev/protection` and `/branches/main/protection`; required-check enforcement is not demonstrated. Severity: medium verification gap.
11. Unrelated run noise: Dependabot dynamic run `44618523528` failed at `Run Dependabot` on the reviewed commit; the named `CI` push run `44618302998` on the same commit succeeded. Severity: informational.

## Hard test results

| Check | Result |
| --- | --- |
| `npx turbo run test --force --filter=@axa-sign/api` | exit `0`; 17 tests, 17 pass, 0 fail; `Cached: 0 cached, 11 total` |
| `npx turbo run test --force --filter=@axa-sign/pdf` | exit `0`; 2 tests, 2 pass, 0 fail; `Cached: 0 cached, 2 total` |
| `npx turbo run test --force` | exit `0`; 17 API + 2 PDF pass; `Cached: 0 cached, 12 total` |
| API tests with workers stopped | exit `0`; 17/17 pass; `Cached: 0 cached, 11 total`; workers restarted successfully |
| `npx turbo run typecheck --force` | exit `0`; `Cached: 0 cached, 25 total` |
| `npx turbo run build --force` | exit `0`; `Cached: 0 cached, 15 total`; tree clean afterward |
| `npm run lint` | exit `0`; `Cached: 10 cached, 10 total`; no workspace lint scripts |
| `npm audit --json` | 13 vulnerabilities: 1 critical, 9 high, 3 moderate |
| `npm run db:migrate:status` | exit `0`; `Database schema is up to date!`; 1 migration |
| Empty DB migration and diff | applied `20261114101048_init`; 24 tables; 1 migration; empty diff |
| Seed idempotency | two runs exit `0`; identical counts; PDF DB/S3 hash match |
| Production seed refusal | exit `1` with explicit refusal message |
| Three-iteration signing replay | every iteration: generate `201`, two signers, send `[200,409]`, token hashes matched, sessions `200`, invalid `404`, sign `200`, final `COMPLETED`, audit leftovers `0` |
| Parallel upload race | `[201,500]`; one document/version remained |
| Parallel send race | `[200,409]`; contract remained `SENT` |
| Cross-org document test | `GET 200`, download `200`, delete `204` |
| Participants route test | documented route `404`; working route `200` |
| Auth limiter probe | first `401`, first `429` at request 61, last `429`; clean threshold not established |
| Fresh clone at exact commit | `npm ci`, `npm run db:generate`, `npm run db:migrate:deploy`, typecheck, build, and test all exit `0`; API 17/17, PDF 2/2 |
| GitHub PR #88 | merged, head check `ci` success |
| GitHub PR #89 | closed unmerged, check run failure at `Test` as intended |
| GitHub push run `44618302998` | success on reviewed commit; all CI steps green |

## Not verified

- TUN2-1 ticket-specific error documentation (Linear unavailable).
- Exact IP-based rate-limit threshold from a clean IP because the local IP had prior traffic.
- Raw PDF text from generated template PDFs could not be extracted with available local tooling; failure conclusion is based on source behavior and metadata/storage-key inspection.
- Branch protection enforced required checks, because protection endpoints returned HTTP 404 with the available credential.

## Artifacts and cleanup

- Report file created: `docs/acceptance/2026-11-19-phase0-1-review.md`.
- Throwaway DB `axa_sign_review`: created for migration/fresh-clone checks and dropped at the end.
- Throwaway bucket `axa-sign-review`: created for fresh-clone checks, confirmed empty, and deleted.
- Fresh clone at `C:\Users\thebr\AppData\Local\Temp\opencode\fresh-clone-2cd72f3`: removed.
- All API test data was cleaned. Generated audit rows were not deleted with raw SQL; remaining audit leftovers were `0` after cleanup.
- No code, tests, config, workflows, frontend, or CHANGELOG files were changed.

## Links

- PR #87: https://github.com/Tunaxa/tunaxa-sign/pull/87
- PR #88: https://github.com/Tunaxa/tunaxa-sign/pull/88
- PR #89: https://github.com/Tunaxa/tunaxa-sign/pull/89
- PR #88 CI run: https://github.com/Tunaxa/tunaxa-sign/actions/runs/44616875085
- Red-proof CI run: https://github.com/Tunaxa/tunaxa-sign/actions/runs/44617542822
- Reviewed-commit push CI run: https://github.com/Tunaxa/tunaxa-sign/actions/runs/44618302998
