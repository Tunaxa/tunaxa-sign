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

### Changed

- TUN2-1: Make the PostgreSQL host port configurable with `POSTGRES_PORT`.
- TUN2-1: Use `DATABASE_URL` in the Prisma datasource instead of a hardcoded connection string.
- TUN2-1: Pin the MinIO image to `cgr.dev/chainguard/minio@sha256:ddfab4c402bf32e7701600d16d8c40dbccfab4c4e5340eef4c324394349c7926`.
- TUN2-1: Raise Turbo dev concurrency to 16 and set `envMode` to `loose` for local development.
- TUN2-2: Replace the `db:push` development workflow with Prisma migrations and remove the `db:push` scripts.

### Fixed

- TUN2-1: Correct the database credentials in `.env.example` to `tunaxa:axa_secret`.
- TUN2-4: Draw embedded signature images before the signer name and timestamp in `packages/pdf` so opaque PNG signatures no longer hide the timestamp, and remove a no-op coordinate expression.
