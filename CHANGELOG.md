# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- TUN2-1: Automatically create the MinIO `axa-sign` bucket on API and worker startup with an idempotent `ensureBucket()` check.
- TUN2-1: Load the repository `.env` for API, workers, and Prisma commands through `scripts/with-env.mjs`.
- TUN2-1: Enable the MinIO service in Docker Compose.
- TUN2-2: Add the initial Prisma migration baseline and `db:migrate:deploy` / `db:migrate:status` scripts.
- TUN2-3: Add an idempotent demo seed for the AXA organization, admin/agent users, NDA template roles/fields, and PDF stored in MinIO.
- TUN2-4: Add a pdf-lib/`node:test` regression test for the PDF seal step in `packages/pdf`.
- TUN2-48: Add a GitHub Actions CI workflow that installs dependencies, applies migrations to an empty database, typechecks, lints, builds and tests every PR and push to `dev`/`main`.

### Changed

- TUN2-1: Make the PostgreSQL host port configurable with `POSTGRES_PORT`.
- TUN2-1: Use `DATABASE_URL` in the Prisma datasource instead of a hardcoded connection string.
- TUN2-1: Pin the MinIO image to `cgr.dev/chainguard/minio@sha256:ddfab4c402bf32e7701600d16d8c40dbccfab4c4e5340eef4c324394349c7926`.
- TUN2-1: Raise Turbo dev concurrency to 16 and set `envMode` to `loose` for local development.
- TUN2-2: Replace the `db:push` development workflow with Prisma migrations and remove the `db:push` scripts.

### Fixed

- TUN2-1: Correct the database credentials in `.env.example` to `tunaxa:axa_secret`.
- TUN2-4: Draw embedded signature images before the signer name and timestamp in `packages/pdf` so opaque PNG signatures no longer hide the timestamp, and remove a no-op coordinate expression.
- TUN2-9: Create the `ContractVersion` in the same transaction as the contract, document and participants, set `Contract.currentVersionId` to the version id, and hash the stored PDF bytes instead of the template variables.
- TUN2-7: Create a `ContractVersion` when a document is uploaded to a contract and set `Contract.currentVersionId`, so signed-document links resolve instead of returning 404.
- TUN2-79: Allow DRAFT → SENT and make contract send create hashed 72-hour signing sessions and queue one invitation email per non-CC participant after the status, step and session transaction commits.
- TUN2-81: Scope standalone documents to their organization; applying the new `add_document_organization_id` migration is required.

### Security

- TUN2-81: Return 404 for cross-organization document reads, downloads and deletes; applying the new `add_document_organization_id` migration is required.

### Known gaps

- TUN2-9: Generated PDFs still contain unfilled `{{placeholder}}` values because merged PDF generation is tracked separately in TUN2-38.
