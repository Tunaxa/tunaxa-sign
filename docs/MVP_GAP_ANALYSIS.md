# AXA Sign — MVP Gap Analysis & Requirements Specification

> **Target Goal:** Transform AXA Sign into a fully functional, production-ready Minimum Viable Product (MVP) for legally binding electronic contract signing.

---

## 1. FRONTEND GAPS

The frontend currently consists of three applications:
- `apps/web`: Originator back-office dashboard
- `apps/signing-app`: Signer-facing public interface
- `apps/admin`: Platform administration portal

---

### A. Back-Office Web App (`apps/web`)

#### 1. Contract Creation & Document Upload (`ContractsPage.tsx`)
*   [ ] **PDF Upload Component**:
    *   Currently, the modal only has a single text input for `Contract title`.
    *   **Missing**: A drag-and-drop file upload area for `.pdf` files.
    *   **Missing**: File validation on the client (max 50 MB, strictly PDF MIME type).
    *   **Missing**: Upload progress bar and file preview (page count, file size, thumbnail).
    *   **Missing**: Form fields for `Expiration Date` (e.g., 30 days default) and optional `Message for Signers`.
*   [ ] **Post-Creation Redirection**:
    *   Direct the user immediately to `/contracts/:id` upon creation to configure signers and preview the contract.

#### 2. Contract Detail & Management (`ContractDetailPage.tsx`)
*   [ ] **Signer & Participant Management UI**:
    *   Currently renders participants if present, but has **no way to add, edit, or delete them**.
    *   **Missing**: "Add Signer" modal with fields:
        *   `Name` (text)
        *   `Email` (email validation)
        *   `Role Type`: `SIGNER` (needs to sign), `APPROVER` (approves before signers), `CC` (receives copy on completion), `VIEWER` (read-only)
        *   `Signing Order` (number: 1, 2, 3... to toggle sequential vs parallel signing).
    *   **Missing**: Drag-and-drop or re-order controls for signing sequence.
    *   **Missing**: Delete and edit action buttons for draft participants.
*   [ ] **Document Preview & Management**:
    *   **Missing**: Embedded PDF preview tab (using PDF.js or native object embed) so the creator can read the uploaded document inside the dashboard.
    *   **Missing**: "Replace Document" button if the contract is still in `DRAFT`.
*   [ ] **Action Controls & Status Guards**:
    *   "Send for Signature" button should be disabled with informative tooltips if:
        *   No document has been uploaded.
        *   No signers (`SIGNER` type) have been added.
    *   **Missing**: "Resend Invitation" button for individual signers if email bounces or session expires.
    *   **Missing**: "Void / Cancel Contract" modal with required cancellation reason.
*   [ ] **Download Actions for Completed Contracts**:
    *   When status is `COMPLETED`, provide visible download buttons:
        *   `Download Signed PDF` (the sealed contract with all signatures).
        *   `Download Certificate of Completion` (the cryptographic verification certificate).
        *   `Download Evidence ZIP` (contract + certificate + audit manifest).
*   [ ] **Live Audit Trail Component**:
    *   The audit trail card currently displays hardcoded placeholder text: *"Audit events will appear here as the contract progresses."*
    *   **Missing**: Query hook calling `/api/v1/audit?contractId=:id`.
    *   **Missing**: Interactive timeline UI showing timestamp, actor (name/email or system), event type (Created, Sent, Viewed, Signed, Completed), and IP address.

#### 3. Reusable Templates (`TemplatesPage.tsx`)
*   Currently a placeholder screen displaying *"Templates coming soon"*.
*   [ ] **Template Catalog**:
    *   List existing templates (e.g., Standard NDA, Employment Agreement, Sales Order).
    *   Template creation modal: Upload base PDF + specify variable placeholders (e.g., `{{company_name}}`, `{{effective_date}}`, `{{payment_amount}}`).
    *   Define default signer roles (e.g., "Company Representative", "Client Signer").
*   [ ] **"Use Template" Quick Flow**:
    *   One-click "Generate Contract from Template" wizard that fills variables, assigns emails to template roles, and creates a ready-to-send contract.

#### 4. Settings & Integrations (`SettingsPage.tsx`)
*   Currently renders static user info and has empty cards for API Keys and Webhooks.
*   [ ] **API Keys UI**:
    *   List generated API keys with created date, last used date, and scope.
    *   "Generate New Key" modal with one-time secret reveal copy button.
    *   "Revoke Key" confirmation dialog.
*   [ ] **Webhooks UI**:
    *   List configured webhook endpoints with active status badge.
    *   Add webhook dialog: `Payload URL`, `HMAC Secret`, and event multiselect (`contract.sent`, `contract.signed`, `contract.completed`, etc.).
    *   Recent webhook deliveries log with status code (200, 500) and manual "Retry Delivery" button.

---

### B. Signer Experience (`apps/signing-app`)

#### 1. Legal Consent & Statutory Compliance (eIDAS / ESIGN / UETA)
*   [ ] **Electronic Records & Signature Disclosure**:
    *   Before viewing or signing, prompt an affirmative legal agreement:
        > *"By clicking 'Continue', you agree to use electronic records and signatures and accept the terms of the Electronic Signature Disclosure."*
    *   Record acceptance timestamp and IP address as legal evidence.

#### 2. Signer Action Controls
*   [ ] **Decline to Sign Flow**:
    *   Add a "Decline to Sign" button.
    *   Modal prompting for a mandatory reason (e.g., "Terms disagreement", "Incorrect details").
    *   Notifies sender immediately and updates contract status to `DECLINED`.
*   [ ] **Post-Signing Confirmation Screen**:
    *   Upon signing completion, display a clear success screen with:
        *   Immediate "Download My Copy" button.
        *   Confirmation notice that a copy was sent to the signer's email address.

#### 3. Multi-Field / Pre-Assigned Field Positioning
*   [ ] Currently, the signer manually clicks anywhere on the document to drop their signature.
*   [ ] **Required for Contracts**: If the sender or template has pre-designated signature locations (or standard bottom-page placement), automatically focus and scroll the signer to the exact target signing box with a "Sign Here" indicator.
*   [ ] Add `Date` and `Full Name` auto-stamping next to the signature box.

#### 4. Mobile & Responsive Signer Experience
*   [ ] Touch-device signature pad adjustments (prevent screen scrolling while drawing signature).
*   [ ] Responsive document viewer with pinch-to-zoom / double-tap-to-zoom on iOS/Android.

---

### C. Platform Admin Portal (`apps/admin`)

*   [ ] **Real Data Binding**:
    *   Replace mock metrics in `HealthPage.tsx`, `QueuesPage.tsx`, and `StoragePage.tsx` with live data from Redis, MinIO, and BullMQ worker health endpoints.
*   [ ] **Audit Explorer**:
    *   Add global cryptographic audit-chain integrity check button (`verifyAuditChain`).

---

## 2. BACKEND GAPS

The backend is built as an Express 5 API (`apps/api`) supported by background BullMQ workers (`apps/workers`) and modular packages (`packages/*`).

---

### A. Document Pipeline & Data Consistency (Critical Bug Fixes)

#### 1. Orphaned Document on Manual Upload (`DocumentService` & `ContractService`)
*   [ ] **The Bug**: `POST /documents` uploads the file to MinIO and writes a record to `Document`, but **never creates a `ContractVersion`**. When a signer opens the signing link, `SigningService.getDocument()` queries `prisma.contractVersion.findFirst({ where: { contractId, isCurrent: true } })`, finds `null`, and throws a 404 error.
*   [ ] **The Fix**:
    *   When uploading a document with a `contractId` (or via `POST /contracts/:id/documents`), automatically create:
        ```ts
        await prisma.contractVersion.create({
          data: {
            contractId,
            version: 1,
            documentId: document.id,
            sha256: hash,
            isCurrent: true,
            createdBy: userId,
          }
        });
        await prisma.contract.update({
          where: { id: contractId },
          data: { currentVersionId: version.id }
        });
        ```

#### 2. Multi-Signer Signature Overwriting (`SigningService.sign`)
*   [ ] **The Bug**: When Participant 1 signs, a new PDF is generated in `STORAGE_FOLDERS.SIGNED`. However, `ContractVersion` is **never updated**, and `currentVersionId` remains pointing to the original document. When Participant 2 signs, the system loads the original unsigned document again, stamps Participant 2's signature, and **erases Participant 1's signature**.
*   [ ] **The Fix**:
    *   Chain signatures: When Participant N signs, load the **latest signed buffer** from the current `ContractVersion`.
    *   Create a new `Document` and a new `ContractVersion` (version: N + 1, `isCurrent: true`).
    *   Set previous versions to `isCurrent: false`.
    *   Update `contract.currentVersionId` to the newly signed version.

#### 3. Foreign Key Violation in Template Engine (`template-engine.service.ts`)
*   [ ] **The Bug**: In line 115:
    ```ts
    await prisma.contract.update({
      where: { id: result.contract.id },
      data: { currentVersionId: document.id }, // FAILS: document.id is not a ContractVersion.id
    });
    ```
*   [ ] **The Fix**: Assign `currentVersionId: contractVersion.id`.

#### 4. Missing Contract Download Endpoints (`contract.routes.ts`)
*   [ ] **Missing**: `GET /api/v1/contracts/:id/download`:
    *   Verifies user belongs to the contract's organization.
    *   Streams the latest signed PDF (or original if DRAFT) with headers `Content-Disposition: attachment; filename="<title>.pdf"`.
*   [ ] **Missing**: `GET /api/v1/contracts/:id/package`:
    *   Generates and streams a `.zip` file containing:
        1. `contract-signed.pdf`
        2. `certificate-of-completion.pdf`
        3. `audit-manifest.json` (cryptographic evidence log).
*   [ ] **Missing**: `GET /api/v1/signing/session/:token/download`:
    *   Allows completed signers to download their signed PDF directly without needing a dashboard login.

---

### B. Workflow & State Engine

#### 1. Enforce Sequential Signing Orders (`events/register.ts`)
*   [ ] **The Bug**: `POST /contracts/:id/send` creates signing steps with `signingOrder`, but `registerEventHandlers` immediately creates signing sessions and sends invitation emails to **all participants at the same time**.
*   [ ] **The Fix**:
    *   On `contract.sent`, only create sessions and send emails to participants where `signingOrder === 1` (or the minimum order).
    *   On `participant.signed`, query for the next pending participant with the next sequential `signingOrder`.
    *   If a next participant exists, generate their session and queue their invitation email.
    *   If all participants have signed, trigger `contract.completed`.

#### 2. Decline to Sign Endpoint (`signing.routes.ts`)
*   [ ] **Missing Route**: `POST /api/v1/signing/session/:token/decline`
    *   Input: `{ reason: string }`
    *   Updates participant status to `DECLINED` and records reason.
    *   Updates contract status to `DECLINED`.
    *   Cancels remaining signing sessions.
    *   Emits `contract.declined` event to notify sender and trigger webhooks.

#### 3. Resend & Re-Auth Session Management
*   [ ] **Missing Route**: `POST /api/v1/contracts/:id/participants/:participantId/resend`
    *   Revokes old session token and issues a fresh 72-hour token.
    *   Re-queues the invitation email via BullMQ.

---

### C. Legal Evidence & PDF Engine (`packages/pdf`)

#### 1. Self-Contained Signed PDF (Summary Page Attachment)
*   [ ] Currently, the certificate is stored as an entirely separate PDF file.
*   [ ] **Standard Practice**: Provide an option (or default) to automatically merge/append the **Certificate of Completion as the final page of the contract PDF** so third parties opening the PDF in Adobe Acrobat can see both signatures and evidence without separate files.

#### 2. Detailed Audit Manifest
*   [ ] The certificate must include:
    *   Contract unique ID and title.
    *   Original document SHA-256 hash.
    *   Final sealed document SHA-256 hash.
    *   Signer full name and verified email.
    *   Signature capture type (`DRAWN` or `TYPED`).
    *   Signer IP address and browser User-Agent.
    *   Exact UTC timestamp for document viewed and document signed.

---

### D. Infrastructure, Database & Operations

#### 1. Database Seed Script (`packages/database/prisma/seed.ts`)
*   [ ] **Missing**: Seed script to initialize a working environment for demos and testing:
    *   1 Demo Organization (`AXA Assurance France`).
    *   1 Admin User (`admin@axa.com` / password).
    *   1 Standard User (`agent@axa.com`).
    *   1 Sample Reusable Template (e.g., NDA with sample PDF attached in MinIO).

#### 2. Prisma Migration Baseline
*   [ ] Currently uses `npm run db:push`.
*   [ ] Generate real migration files via `npx prisma migrate dev --name init` and commit to git for repeatable CI/CD deployments.

#### 3. Real Email & Production Transport
*   [ ] Currently hardcoded to local MailHog (`localhost:1025`).
*   [ ] Add environment configuration for production SMTP (SendGrid / AWS SES / Postmark / Resend) with fallback to MailHog in development.

#### 4. Rate Limiting & Input Sanitization
*   [ ] Add rate limiting on public signing endpoints (`/api/v1/signing/*`) to prevent token brute-forcing.
*   [ ] Validate PDF file headers on upload (magic bytes `25 50 44 46` / `%PDF-`) to prevent arbitrary file upload vulnerabilities.

---

## 3. SUMMARY COMPARISON MATRIX

| Feature / Capability | Current Status | MVP Requirement |
| :--- | :--- | :--- |
| **PDF Document Upload** | ❌ API only (broken version link) | ✅ Web UI drag-and-drop + instant version link |
| **Add Signers / Approvers** | ❌ Backend only | ✅ Complete modal in `ContractDetailPage` |
| **Download Signed PDF** | ❌ Not implemented | ✅ `GET /contracts/:id/download` + UI buttons |
| **Multi-Signer Chaining** | ❌ Signer 2 overwrites Signer 1 | ✅ Chained `ContractVersion` stamping |
| **Sequential Signing** | ❌ All invited at once | ✅ Enforced order (1 -> 2 -> 3) |
| **Legal Consent Disclosure** | ❌ None | ✅ Statutory affirmative consent modal |
| **Audit Trail Visualization** | ❌ Placeholder text | ✅ Real-time chronological event feed |
| **Decline to Sign** | ❌ Not implemented | ✅ Endpoint + modal with decline reason |
| **Download Certificate** | ⚠️ API exists, UI missing | ✅ Accessible from both Web & Signing apps |
| **Database Seed Script** | ❌ Missing | ✅ Ready-to-demo seed script |
| **Template Management** | ⚠️ Partial backend, 0% UI | ✅ Basic template upload & generate wizard |
| **API Keys & Webhooks UI** | ⚠️ Backend complete, 0% UI | ✅ Management views in Settings |
