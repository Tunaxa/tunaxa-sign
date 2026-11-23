# Frontend Architecture Audit — Tunaxa Sign (AXA Sign)

> **Generated:** 2026-11-23  
> **Scope:** Three Vite/React frontend applications in `tunaxa-sign/apps/`  
> **Purpose:** Research-ready reference for UI/UX improvements — covers folder structure, file design, design system, page-by-page analysis, state management, API patterns, gaps, and improvement roadmap.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Applications Overview](#2-applications-overview)
3. [Folder & File Structure](#3-folder--file-structure)
4. [Technology Stack (exact versions)](#4-technology-stack)
5. [Design System & Colors](#5-design-system--colors)
6. [Page-by-Page Analysis](#6-page-by-page-analysis)
   - [6.1 Web App (`apps/web`)](#61-web-app--appswebsrc-)
   - [6.2 Admin App (`apps/admin`)](#62-admin-app--appsadminsrc-)
   - [6.3 Signing App (`apps/signing-app`)](#63-signing-app--appssigning-appsrc-)
7. [State Management Analysis](#7-state-management-analysis)
8. [API Integration Patterns](#8-api-integration-patterns)
9. [Component Reuse & Design Gaps](#9-component-reuse--design-gaps)
10. [Accessibility (a11y) Gaps](#10-accessibility-a11y-gaps)
11. [Responsive Design Assessment](#11-responsive-design-assessment)
12. [Performance Considerations](#12-performance-considerations)
13. [Issues & Anti-patterns Found](#13-issues--anti-patterns-found)
14. [Recommended Improvements (Prioritized)](#14-recommended-improvements-prioritized)
15. [Proposed Improved Architecture](#15-proposed-improved-architecture)

---

## 1. Executive Summary

The Tunaxa Sign frontend is composed of **three separate Vite/React 19 single-page applications**, each with its own Tailwind configuration, Vite proxy, and no shared component library. The codebase is **clean, well-structured for MVP**, and uses modern tooling (React 19, TanStack Query v5, Zustand v5, React Router v7). However, it shows several gaps typical of a first-generation SaaS MVP:

| Area | Assessment |
|---|---|
| Code quality | ✅ Good — consistent, readable TypeScript |
| Design consistency | ⚠️ Partial — same brand color but no shared token system |
| Feature completeness | ❌ Partial — Templates and Settings pages are placeholders |
| Shared component library | ❌ Missing — no `packages/ui` or `libs/components` |
| Accessibility | ❌ No ARIA roles, no keyboard trap management, no focus rings |
| Testing | ❌ No test files anywhere in the frontend |
| Responsive design | ⚠️ Partial — only signing app has real responsive layout |
| Error handling | ⚠️ Minimal — no global error boundary, no toast system |
| Token refresh | ❌ Not wired — `refreshAuth` exists but is never called automatically |

**Primary pain point for improvement:** No shared design system. Each app duplicates the same `brand` color definition, the same `cn()` utility, the same button/input patterns, and each owns its own API client. Any UI improvement must be made in three places.

---

## 2. Applications Overview

| App | Package | Port | Theme | Role |
|---|---|---|---|---|
| **Web Dashboard** | `@axa-sign/web` | 5173 | Light (white/gray bg, dark navy sidebar) | End-user contract management |
| **Admin Portal** | `@axa-sign/admin` | 5175 | Dark (deep navy `#0a0a22` bg) | Platform superadmin console |
| **Signing App** | `@axa-sign/signing-app` | 5174 | Light (`#f9fafb` bg) | External signers — view & sign PDF |

All three apps:
- Proxy `/api/*` → `http://localhost:3000` via Vite
- Use React Router v7 with `BrowserRouter`
- Use TanStack Query v5 for server state
- Share the same brand color definition (but each copies it independently)

---

## 3. Folder & File Structure

### 3.1 Web App (`apps/web/src/`)

```
src/
├── App.tsx                          # Route definitions + ProtectedRoute
├── main.tsx                         # App entry — QueryClientProvider + BrowserRouter
├── index.css                        # Tailwind directives + system font stack
│
├── components/
│   └── layout/
│       └── DashboardLayout.tsx      # Sidebar + top bar shell (126 lines)
│
├── pages/
│   ├── LoginPage.tsx                # 92 lines — email+password form
│   ├── RegisterPage.tsx             # 139 lines — 5-field registration form
│   ├── ContractsPage.tsx            # 200 lines — table + create modal + pagination
│   ├── ContractDetailPage.tsx       # 124 lines — detail view + participants + audit trail stub
│   ├── TemplatesPage.tsx            # 21 lines — PLACEHOLDER ("coming soon")
│   └── SettingsPage.tsx             # 65 lines — read-only org/profile + 2 placeholders
│
├── hooks/
│   └── use-contracts.ts             # 96 lines — TanStack Query hooks for contracts
│
├── stores/
│   └── auth.ts                      # 124 lines — Zustand persist store
│
└── lib/
    ├── api.ts                       # 58 lines — ApiClient class with token injection
    └── cn.ts                        # 1 line — clsx + tailwind-merge utility
```

**File count:** 12 source files  
**Total estimated LOC:** ~875 lines  
**Missing directories:** `tests/`, `components/ui/`, `components/shared/`, `types/`

### 3.2 Admin App (`apps/admin/src/`)

```
src/
├── App.tsx                          # Router with 8 routes under AdminLayout
├── main.tsx                         # QueryClientProvider entry
├── index.css                        # Tailwind + dark body background #0a0a22
│
├── components/
│   └── layout/
│       └── AdminLayout.tsx          # 78 lines — dark sidebar, 8 nav items
│
├── pages/
│   ├── OverviewPage.tsx             # 136 lines — 6 KPI cards + status + storage/webhook
│   ├── OrganizationsPage.tsx        # 84 lines — table of tenants
│   ├── UsersPage.tsx                # 98 lines — table of all users + MFA + roles
│   ├── AuditLogsPage.tsx            # 73 lines — hash-chained event table
│   ├── QueuesPage.tsx               # 81 lines — BullMQ queue cards
│   ├── HealthPage.tsx               # 68 lines — service health (auto-refresh 30s)
│   ├── StoragePage.tsx              # 81 lines — MinIO/S3 bucket cards
│   └── CertificatesPage.tsx         # 72 lines — signing certificates table
│
└── lib/
    ├── api.ts                       # 17 lines — bare fetch wrappers (NO auth token!)
    └── cn.ts                        # 1 line — same clsx+twMerge utility
```

**File count:** 13 source files  
**Total estimated LOC:** ~733 lines  
**Missing directories:** `tests/`, `stores/` (no auth store — admin is currently unsecured!)

### 3.3 Signing App (`apps/signing-app/src/`)

```
src/
├── SigningPage.tsx                   # 325 lines — full signing flow state machine
├── main.tsx                         # 21 lines — minimal entry, single route
├── index.css                        # 8 lines — Tailwind + light background
│
├── components/
│   ├── DocumentViewer.tsx           # 169 lines — PDF.js multi-page renderer + click-to-place
│   └── SignaturePad.tsx             # 107 lines — canvas drawing pad (Pointer Events API)
│
└── lib/
    ├── signature.ts                 # 31 lines — typed name → PNG via Canvas API
    └── cn.ts                        # 1 line — same utility (3rd copy)
```

**File count:** 7 source files  
**Total estimated LOC:** ~661 lines  
**Missing directories:** `tests/`, `components/ui/`

---

## 4. Technology Stack

### 4.1 Shared across all three apps

| Technology | Version | Role |
|---|---|---|
| React | `^19.0.0` | UI library |
| React DOM | `^19.0.0` | DOM renderer |
| Vite | `^6.0.0` | Build tool + dev server |
| TypeScript | `^5.7.0` | Type safety |
| Tailwind CSS | `^3.4.0` | Utility CSS framework |
| PostCSS + Autoprefixer | `^8.4.0` / `^10.4.0` | CSS processing |
| React Router DOM | `^7.1.0` | Client-side routing |
| TanStack Query (React Query) | `^5.62.0` | Server state management |
| lucide-react | `^0.468.0` | Icon library |
| clsx | `^2.1.0` | Conditional class names |
| tailwind-merge | `^2.6.0` | Tailwind class conflict resolver |

### 4.2 Web App only

| Technology | Version | Role |
|---|---|---|
| Zustand | `^5.0.0` | Auth client state |
| react-hook-form | `^7.54.0` | Form management |
| Zod | `^3.24.0` | Schema validation |
| @hookform/resolvers | `^3.9.0` | Zod ↔ react-hook-form bridge |
| date-fns | `^4.1.0` | Date formatting |

> **Note:** `react-hook-form` and `zod` are listed as dependencies but **are NOT actually used** in any page — all forms use plain `useState`. These are unused dependencies.

### 4.3 Admin App only

| Technology | Version | Role |
|---|---|---|
| date-fns | `^4.1.0` | Date formatting (not used in admin — unused dep) |

> Admin does **NOT** have Zustand — there is no authentication on the admin portal.

### 4.4 Signing App only

| Technology | Version | Role |
|---|---|---|
| pdfjs-dist | `^4.10.38` | PDF rendering in browser |
| react-hook-form | `^7.54.0` | Listed but not used |
| Zod | `^3.24.0` | Listed but not used |
| @hookform/resolvers | `^3.9.0` | Listed but not used |

---

## 5. Design System & Colors

### 5.1 Brand Color Palette

The `brand` color is defined **identically in each app's `tailwind.config.js`** (3 separate copies). There are **no shared design tokens**.

#### Web App (`apps/web/tailwind.config.js`) — Full scale

```js
brand: {
  50:  "#f0f0ff",   // very light lavender
  100: "#e0e0ff",   // light lavender
  200: "#c2c2ff",   // used for muted sidebar text (brand-200)
  300: "#a3a3ff",   // light periwinkle
  400: "#8585ff",   // medium periwinkle
  500: "#1a1a2e",   // ★ PRIMARY — dark navy (main sidebar bg, buttons, header)
  600: "#16162b",   // ★ HOVER STATE — slightly darker navy
  700: "#121228",   // deep navy
  800: "#0e0e25",   // darker
  900: "#0a0a22",   // darkest navy (admin portal full-page background)
}
```

> **Important insight:** The scale is **inverted** relative to typical Tailwind conventions. `brand-500` is a very **dark** navy (#1a1a2e), and `brand-50`/`brand-100`/`brand-200` are **light** lavenders used for muted text. This is non-standard and may confuse future developers.

#### Admin App (`apps/admin/tailwind.config.js`) — Minimal

```js
brand: {
  500: "#1a1a2e",   // same primary
  600: "#16162b",   // same hover
}
```

#### Signing App (`apps/signing-app/tailwind.config.js`) — Minimal

```js
brand: {
  500: "#1a1a2e",   // same primary
  600: "#16162b",   // same hover
}
```

### 5.2 Color Usage Mapping

| Color | Hex | Usage context |
|---|---|---|
| `brand-500` | `#1a1a2e` | Sidebar bg, primary buttons, header bar, focus rings, link color |
| `brand-600` | `#16162b` | Button hover, active nav item bg |
| `brand-200` | `#c2c2ff` | Sidebar muted text, subtitle labels |
| `gray-50` | Tailwind default | Web app body background |
| `#0a0a22` | (admin CSS) | Admin portal full-page background |
| `#121228` | (admin inline) | Admin card/table backgrounds |
| `white/5` | (admin inline) | Admin borders (semi-transparent white) |
| `blue-400` | Tailwind default | Admin active nav, metric icons |
| `blue-600/20` | (admin inline) | Admin active nav background |
| `#f9fafb` | (signing-app CSS) | Signing app body background |
| `#e11d48` (rose-600) | (signing-app inline) | "SIGN HERE" overlay border and text |
| `#1a1a2e` | (signature.ts) | Drawn/typed signature ink color (matches brand-500) |

### 5.3 Themes per App

| App | Background | Sidebar | Cards/Tables | Text primary |
|---|---|---|---|---|
| **Web** | `gray-50` (#f9fafb) | `brand-500` (#1a1a2e) | `white` with `border` | `gray-900` |
| **Admin** | `#0a0a22` | `#121228` | `#121228` with `white/5` border | `white` |
| **Signing** | `#f9fafb` | No sidebar | `white` | `gray-900` |

### 5.4 Typography

- **Font stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (system font — no custom web font)
- **No type scale defined** — uses Tailwind defaults: `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px), `text-xl` (20px), `text-2xl` (24px), `text-3xl` (30px)
- **Page titles:** `text-2xl font-bold` (24px/700)
- **Card headings:** `text-lg font-semibold` (18px/600)
- **Body:** `text-sm` (14px) — most content
- **Muted:** `text-gray-500` / `text-gray-400`
- **Signature typing:** `text-2xl font-serif italic` — special cursive appearance

### 5.5 Spacing & Layout Conventions

- **Border radius:** `rounded-lg` (8px) for inputs/buttons, `rounded-xl` (12px) for cards/panels, `rounded-full` for badges/status pills
- **Card padding:** `p-6` (24px) consistently
- **Page padding:** `p-6` (web main), `p-8` (admin main)
- **Button padding:** `px-4 py-2.5` standard, `px-6 py-3` CTA
- **Sidebar width:** 256px (`w-64`) web, 240px (`w-60`) admin
- **Top bar height:** `h-16` (64px) both apps

### 5.6 Status Badge Colors

Used in Web (ContractsPage) and Admin (UsersPage, OrganizationsPage):

```
DRAFT      → bg-gray-100   text-gray-700
SENT       → bg-blue-100   text-blue-700
VIEWED     → bg-yellow-100 text-yellow-700
IN_PROGRESS→ bg-orange-100 text-orange-700
COMPLETED  → bg-green-100  text-green-700
DECLINED   → bg-red-100    text-red-700
EXPIRED    → bg-gray-100   text-gray-500
CANCELLED  → bg-gray-100   text-gray-500
```

> **Issue:** `STATUS_STYLES` is defined **twice** — once in `ContractsPage.tsx` and again in `ContractDetailPage.tsx`. This is duplicate code that should be in a shared module.

---

## 6. Page-by-Page Analysis

### 6.1 Web App (`apps/web/src/`)

#### Route Map

```
/login          → LoginPage         (public)
/register       → RegisterPage      (public)
/              → redirect /contracts (protected)
/contracts      → ContractsPage     (protected)
/contracts/:id  → ContractDetailPage (protected)
/templates      → TemplatesPage     (protected, placeholder)
/settings       → SettingsPage      (protected, placeholder)
```

**Auth guard:** `ProtectedRoute` reads `isAuthenticated` from Zustand — if false, redirects to `/login`. Simple and effective but has a flash-of-unauthenticated-content risk on hydration.

---

#### Page: `LoginPage.tsx`

**Purpose:** User authentication entry  
**Layout:** Full-screen centered card (`flex min-h-screen items-center justify-center bg-gray-50`)  
**Components:**
- Brand heading: `text-3xl font-bold text-brand-500` → "AXA SIGN"
- White card `rounded-xl shadow-sm border p-8 max-w-md`
- Two `<input>` fields (email, password) with `focus:ring-2 focus:ring-brand-500`
- Primary `<button>` → `bg-brand-500 hover:bg-brand-600`
- Error banner: `bg-red-50 text-red-700`
- Link to `/register`

**Interactions:** Calls `useAuthStore.login()` → `api.post('/auth/login')` → stores JWT + redirects to `/contracts`  
**Gaps:**
- No "forgot password" link
- No loading skeleton — just disabled button
- No `autocomplete` attributes on inputs
- No password visibility toggle
- Error message is raw API error string (no localization)

---

#### Page: `RegisterPage.tsx`

**Purpose:** New organization + user registration  
**Layout:** Same centered card as login  
**Components:**
- 5 fields: First name, Last name, Organization name, Email, Password
- First/Last name in `grid grid-cols-2 gap-4`
- Password has `minLength={8}` HTML validation
- Same primary button + error banner pattern

**Interactions:** Calls `useAuthStore.register()` → redirects to `/contracts`  
**Gaps:**
- No password confirmation field
- No terms of service acceptance checkbox
- No organization already-exists feedback
- `react-hook-form` / `zod` are installed but **not used** — validation is implicit HTML5 only

---

#### Page: `ContractsPage.tsx`

**Purpose:** Main contract list — browse, filter, create  
**Layout:** Flex header + filter row + table + pagination  
**Components:**
- Inline create modal: `fixed inset-0 z-50 bg-black/50` with centered white card — no component abstraction, no focus trap
- Status filter `<select>` with 5 options
- Table: `bg-white rounded-xl border overflow-hidden` with `thead bg-gray-50`
- Status badges: `rounded-full px-2.5 py-0.5 text-xs` pill pattern
- Empty state: `FileText` icon + text — good UX pattern
- Pagination: simple Previous/Next with count display

**Data:** `useContracts({ page, status })` → TanStack Query → `GET /api/v1/contracts?page=N&status=X`  
**Interactions:** Create, navigate to detail, filter by status, paginate  
**Gaps:**
- No search / text filter
- No sort columns
- No bulk actions (delete, archive)
- No document upload capability (PDF must be uploaded separately via undocumented flow)
- Modal has no keyboard close (Escape key), no focus trap, no ARIA role
- Loading state is just text "Loading..."  — no skeleton
- `STATUS_STYLES` duplicated from `ContractDetailPage`

---

#### Page: `ContractDetailPage.tsx`

**Purpose:** View contract, manage participants, send, cancel  
**Layout:** Back link + header + action buttons + 2 cards (Participants + Audit Trail)  
**Components:**
- Status badge (same pill pattern)
- Action row: "Send for Signature" (brand button) + "Cancel" (red outlined button)
- Participants card: `space-y-3`, each participant in `bg-gray-50 rounded-lg p-3`
- Audit Trail card: **stub only** — shows placeholder text

**Interactions:**
- Send: `useSendContract()` → `POST /contracts/:id/send`
- Cancel: `useCancelContract()` → `POST /contracts/:id/cancel`

**Gaps:**
- Cannot **add participants** from UI — the API supports it but no form exists in this page
- Cannot **upload a PDF document** to the contract from UI
- Cannot **add signature fields** (placement) from the dashboard
- Audit trail section is entirely empty (placeholder text only)
- No download signed PDF button
- No participant status update indicator / real-time refresh

---

#### Page: `TemplatesPage.tsx`

**Status: PLACEHOLDER**  
**Content:** Just header + "Templates coming soon" text  
**Lines:** 21  
**Impact:** This feature is listed in product docs as a planned capability — 0% implemented in UI

---

#### Page: `SettingsPage.tsx`

**Status: PARTIALLY IMPLEMENTED**  
- Organization section: Shows name + slug (read-only)
- Profile section: Shows first name, last name, email, role (read-only)
- API Keys section: "API key management coming soon" — **PLACEHOLDER**
- Webhooks section: "Webhook configuration coming soon" — **PLACEHOLDER**

**Gaps:** No edit capability for any field, no password change, no MFA setup, no notification preferences

---

#### DashboardLayout.tsx

**Structure:**
```
div.flex.h-screen
├── aside.w-64.bg-brand-500        # Sidebar (fixed on mobile, static lg+)
│   ├── Logo area (h-16)
│   ├── Organization name + user email
│   ├── nav (3 items: Contracts, Templates, Settings)
│   └── Logout button
├── div.black/50 overlay           # Mobile backdrop
└── div.flex-1
    ├── header.h-16.bg-white       # Top bar with hamburger (mobile) + user name
    └── main.p-6                   # Page content
```

**Responsive behavior:**
- Sidebar: `fixed` on mobile, hidden (`-translate-x-full`), slides in on `sidebarOpen` state
- Mobile trigger: hamburger `<Menu>` icon in top bar
- `lg:` breakpoint switches sidebar to static
- **Issue:** No overlay close on resize, `lg:translate-x-0` hardcoded (SSR risk)

---

### 6.2 Admin App (`apps/admin/src/`)

#### Route Map

```
/               → OverviewPage
/organizations  → OrganizationsPage
/users          → UsersPage
/audit-logs     → AuditLogsPage
/queues         → QueuesPage
/health         → HealthPage
/storage        → StoragePage
/certificates   → CertificatesPage
```

> **Critical Security Issue:** The admin app has **NO authentication**. Any user who knows the URL `localhost:5175` has full read access to all platform data. The API endpoints themselves require `SUPER_ADMIN` role but the UI provides no login.

---

#### AdminLayout.tsx

**Theme:** Dark — `bg-[#0a0a22]` page, `bg-[#121228]` sidebar  
**Structure:**
```
div.flex.h-screen
├── aside.w-60.bg-[#121228]
│   ├── Header: "AXA SIGN ADMIN" in white + "ADMIN" in blue-400
│   ├── nav (8 items with lucide icons)
│   │   Active: bg-blue-600/20 text-blue-300 border border-blue-500/30
│   │   Inactive: text-gray-400 hover:text-gray-200 hover:bg-white/5
│   └── Footer: red "Restricted: Platform Admins Only" badge (ShieldAlert icon)
└── main.flex-1.p-8
```

**Note:** The "Restricted" badge is decorative only — there is no actual auth gate.  
**Responsive:** No mobile menu — sidebar is always visible (admin is desktop-only).

---

#### Page: `OverviewPage.tsx`

**Purpose:** Platform KPI dashboard  
**Components:**
- 6 metric cards: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`
- Each card: `bg-[#121228] border border-white/5 p-5` + lucide icon in blue-400 + large white number
- System status row: 4 services (PostgreSQL, Redis, Object Storage, Workers) — **hardcoded "Healthy" / "5 Active" — NOT live data**
- Storage usage: progress bar hardcoded at `width: "35%"` — **fake data**
- Webhook health: shows `failedWebhooks` from API (this IS real)

**Data source:** `GET /api/v1/admin/stats` → `SystemStats` interface  
**Gaps:**
- System status cards are hardcoded (not from health API)
- Storage progress bar is hardcoded at 35%
- No charts / time-series data
- No date range filters

---

#### Page: `UsersPage.tsx`

**Purpose:** View all platform users  
**Components:** Dark-themed table with 5 columns (User, Organization, Role, MFA, Last Login)  
**Role badges:** Color-coded per role (OWNER=green, ADMIN=blue, MANAGER=purple, MEMBER/VIEWER=gray, ACCOUNTANT=yellow)  
**Data:** `GET /api/v1/admin/users`  
**Gaps:** Read-only — no suspend/delete/impersonate actions

---

#### Page: `OrganizationsPage.tsx`

**Purpose:** View all tenants  
**Components:** Dark table with 6 columns (Organization, Plan, Users, Contracts, Templates, Created)  
**Plan badges:** FREE=gray, STARTER=blue, BUSINESS=purple, ENTERPRISE=green  
**Data:** `GET /api/v1/admin/organizations`  
**Gaps:** Read-only — no edit plan, no suspend org

---

#### Page: `AuditLogsPage.tsx`

**Purpose:** View platform-wide hash-chained audit events  
**Components:** Dark table — Timestamp, Event Type (blue badge), User ID (truncated), Org ID (truncated), Hash (truncated to 16 chars with "...")  
**Data:** `GET /api/v1/admin/audit-events`  
**Gaps:**
- Shows raw UUIDs for user/org instead of names
- No filter by event type, org, or date range
- No pagination — loads all at once
- Hash is truncated — no expand/copy feature

---

#### Page: `QueuesPage.tsx`

**Purpose:** BullMQ Redis queue monitor  
**Components:** Grid of queue cards — name, active/idle badge (color-cycled), 4 counters: waiting/active/completed/failed  
**Data:** `GET /api/v1/admin/queues`  
**Gaps:** No retry failed jobs action, no drain queue, no real-time refresh (only manual)

---

#### Page: `HealthPage.tsx`

**Purpose:** Live service health status  
**Components:** Grid of service cards — name, latency (ms), last check time, status badge (healthy/degraded/down)  
**Data:** `GET /api/v1/admin/health` — **auto-refreshes every 30 seconds** (via `refetchInterval: 30000`)  
**Gaps:** No historical health log, no alerting

---

#### Page: `StoragePage.tsx`

**Purpose:** MinIO/S3 object storage usage  
**Components:** Grid of bucket cards (objects, size, region) + folder structure legend  
**Data:** `GET /api/v1/admin/storage`  
**Gaps:** No drill-down per object, no delete capability

---

#### Page: `CertificatesPage.tsx`

**Purpose:** View completion certificates issued for signed contracts  
**Components:** Dark table — Serial, Contract title, Subject, Valid From, Valid To  
**Data:** `GET /api/v1/admin/certificates`  
**Gaps:** No download, no revocation

---

### 6.3 Signing App (`apps/signing-app/src/`)

#### Route Map

```
/session/:token → SigningPage
*               → "Invalid signing link" fallback
```

No authentication — the token in the URL IS the credential.

---

#### Page: `SigningPage.tsx` (325 lines)

**Purpose:** Public-facing document signing flow for external participants  
**Flow (state machine):**

```
"loading"
    ↓ (token validated via GET /signing/session/:token)
"view"      ← Review document + "Review & Sign" button
    ↓ (POST /signing/session/authenticate)
"sign"      ← Choose type/draw signature + place on doc + "Sign Document"
    ↓ (POST /signing/sign)
"complete"  ← Success screen
    ↓ (error at any step)
"error"     ← "Invalid or expired signing link" screen
```

**Components:**
- **Header:** Dark `bg-brand-500` sticky bar — "AXA SIGN by Tunaxa" + participant name/email
- **View step:** `lg:flex` split layout — PDF viewer left (auto-width), info panel right (360px fixed)
- **Sign step:** Same split — PDF viewer with clickable placement + sign panel right
- **Info panel (view):** Contract title, participant name, description + "Review & Sign" button
- **Sign panel:** Signature type toggle (Type | Draw), typed input or `<SignaturePad>`, placement indicator, Back + Sign buttons
- **Complete screen:** `CheckCircle` green icon (64×64) + thank-you message
- **Error screen:** Red text + "contact sender" message

**Default placement:** Automatically set to page 1 at (width/2 - 80, height×0.9) if no manual placement

**Gaps:**
- No OTP / email verification step (session authenticate is single-factor)
- No "Decline" button for the signer
- No page navigation controls for multi-page documents (PDF.js renders all pages sequentially)
- Mobile layout: on small screens, PDF viewer and panel stack vertically — usable but tight
- No zoom control on document viewer
- Signature field has hardcoded size (26% of page width, 52px min-height)
- No download signed document from completion screen

---

#### Component: `DocumentViewer.tsx` (169 lines)

**Technology:** `pdfjs-dist ^4.10.38`  
**Key design:** Pure DOM manipulation (not React state) — PDF pages are rendered to canvas elements appended to a container `div` via `useEffect`. This is intentional for performance (avoids React reconciliation overhead for canvas).

**Modes:**
- `"view"` — render all pages sequentially, no interaction
- `"place"` — same render + click handlers on each page slot → fires `onPlace(Placement)`

**Signature overlay:** A separate `useEffect` watches `[placement, mode]` and injects an absolutely-positioned `div` with dashed `#e11d48` border labeled "SIGN HERE". Removed and re-added on each placement change.

**Scale:** `Math.min(1.5, 860/pageWidth)` — max 860px wide, max 1.5× scale. Good quality on typical A4 PDFs.

**Page labels:** Small `Page N` badge in top-right of each page slot (`bg-gray-900/60 text-white`)

**Gaps:**
- PDF loaded via `fetch(url)` — no progress indicator
- No text selection (canvas rendering)
- No zoom
- Error handling: catches silently (`catch(() => {})`), page just stays blank

---

#### Component: `SignaturePad.tsx` (107 lines)

**Technology:** Native canvas + Pointer Events API (supports mouse, stylus, touch)  
**Canvas size:** 640×240 logical pixels (2× for HiDPI via `devicePixelRatio`)  
**Stroke:** `lineWidth: 2.75`, `lineCap/lineJoin: round`, color `#1a1a2e` (matches brand)  
**Output:** PNG data URL via `canvas.toDataURL("image/png")`  
**Clear:** Eraser icon button — white fill + resets `hasInkRef`  

**Gaps:**
- `setPointerCapture` used correctly for drag, but no `onPointerCancel` handler
- No variable stroke width (pressure not used)
- Fixed canvas size — may be very narrow on mobile viewports

---

#### Utility: `signature.ts` (31 lines)

**Purpose:** Render a typed name as a handwriting-like PNG for the "TYPED" signature mode  
**Canvas:** 700×220 logical pixels  
**Font:** `italic 110px 'Segoe Script','Brush Script MT','Lucida Handwriting','Comic Sans MS',cursive`  
**Color:** `#1a1a2e` (brand color)  
**Transform:** Slight rotation `-0.03 rad` for natural tilt  
**Returns:** `null` if name too wide (> 660px at the given font size) or empty  

**Gaps:** Font availability depends on OS — Linux may fall back to Comic Sans, which is not signature-like

---

## 7. State Management Analysis

### 7.1 Web App — Zustand Auth Store (`stores/auth.ts`)

**Store name (localStorage key):** `"axa-sign-auth"`  
**Persisted fields:** `user`, `organization`, `accessToken`, `refreshToken`, `isAuthenticated`  
**Non-persisted:** nothing (all state is persisted)

**State shape:**
```ts
{
  user: { id, email, firstName, lastName, role } | null
  organization: { id, name, slug } | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
}
```

**Actions:**
- `login(email, password)` → POST `/auth/login` → stores tokens, calls `api.setToken()`
- `register(data)` → POST `/auth/register` → same
- `logout()` → clears all state, calls `api.setToken(null)`
- `refreshAuth()` → POST `/auth/refresh` with refreshToken → updates tokens

**Critical gap:** `refreshAuth()` is **never called automatically**. There is no interceptor that catches 401 responses and refreshes the token. When the access token expires, all API calls silently fail with 401. The user is not redirected to login.

**Token storage:** `localStorage` via Zustand persist. Tokens are readable by any JavaScript on the page (XSS risk). No httpOnly cookie alternative.

### 7.2 Admin App — No Auth Store

The admin app has no Zustand or any auth store. `apps/admin/lib/api.ts` sends requests **without any `Authorization` header**. The admin API endpoints rely entirely on the server-side `SUPER_ADMIN` guard — but the UI has no login flow whatsoever.

### 7.3 TanStack Query Configuration

**Web app `main.tsx`:** `new QueryClient()` — all defaults  
**Admin app:** Same  
**Signing app:** Same  

No custom `defaultOptions` configured. This means:
- `staleTime: 0` — data refetches on every window focus
- `gcTime: 5 minutes` (default)
- `retry: 3` (default) — will retry failed API calls 3 times before showing error

**Health page exception:** `refetchInterval: 30000` — good practice for live monitoring.

---

## 8. API Integration Patterns

### 8.1 Web App API Client (`lib/api.ts`)

**Pattern:** Singleton `ApiClient` class instance exported as `api`

```ts
class ApiClient {
  private token: string | null = null
  setToken(token: string | null): void
  async request<T>(path: string, options): Promise<T>
  get<T>(path: string): Promise<T>
  post<T>(path: string, body?): Promise<T>
  patch<T>(path: string, body?): Promise<T>
  delete<T>(path: string): Promise<T>
}
export const api = new ApiClient()
```

**Base URL:** `/api/v1` (relative — Vite proxies to `http://localhost:3000`)  
**Auth:** `Authorization: Bearer ${token}` header when token is set  
**Error handling:** `if (!response.ok)` → parses JSON error body → throws `new Error(error.error || "HTTP 405")`  
**204 handling:** Returns `undefined as T` — correct  

**Gaps:**
- No automatic token refresh on 401
- No request timeout
- No request cancellation (AbortController)
- No global error notification (no toast)
- Token is stored in-memory on the class instance — lost on page refresh until Zustand hydrates and calls `setToken()` again

**Token re-hydration issue:** When the page loads, Zustand persist hydrates from localStorage asynchronously. The `api.token` starts as `null`. There is no code that calls `api.setToken(accessToken)` after hydration. This means after a hard refresh, the first API call may go out without a token until the Zustand store hydrates.

> **Fix needed:** In `main.tsx`, read persisted token and call `api.setToken()` before mounting the app.

### 8.2 Admin App API Client (`lib/api.ts`)

**Pattern:** Bare functions (not a class)

```ts
export async function apiGet<T>(path: string): Promise<T>
export async function apiPost<T>(path: string, body?): Promise<T>
```

**No auth token at all.** No `Authorization` header. Relies entirely on server-side checks.  
**No error details** — only `throw new Error("Request failed: ${res.status}")` — no body parsing.

### 8.3 Signing App API

**Pattern:** Plain `fetch()` calls directly in `SigningPage.tsx` (not a client class)

```ts
async function fetchSession(token): Promise<SessionResponse>
async function authenticateSession(token): Promise<...>
async function signDocument(token, data): Promise<...>
```

**No shared client, no auth headers** — the signing session token is passed in the request body, not as a header.

### 8.4 Query Key Conventions

| App | Key pattern |
|---|---|
| Web | `["contracts", params]`, `["contract", id]` |
| Admin | `["admin", "stats"]`, `["admin", "users"]`, `["admin", "organizations"]`, etc. |
| Signing | `["signing-session", token]` |

No standardized key factory pattern. Query keys are plain arrays defined inline in each hook/page.

---

## 9. Component Reuse & Design Gaps

### 9.1 Code Duplication Inventory

| Item | Duplicated in | Lines each |
|---|---|---|
| `tailwind.config.js` brand colors | web, admin, signing-app | ~8 lines × 3 |
| `lib/cn.ts` utility | web, admin, signing-app | 1 line × 3 |
| `STATUS_STYLES` Record | ContractsPage, ContractDetailPage | ~10 lines × 2 |
| Vite proxy config `/api` → `localhost:3000` | web, admin, signing-app | ~5 lines × 3 |
| Input field styling | LoginPage, RegisterPage, ContractsPage | ~6 chars × N |
| Button styling `bg-brand-500 ... hover:bg-brand-600` | 8+ locations | repeated |
| Loading spinner pattern | 6+ pages (just text "Loading...") | ~1 line × 6 |
| Empty state pattern | ContractsPage only | — |

### 9.2 Missing Shared Components (High Priority)

The following components are needed but don't exist in any shared location:

| Component | Used as inline styles in | Priority |
|---|---|---|
| `<Button>` with variants (primary, secondary, danger, ghost) | Everywhere | P0 |
| `<Input>` with label, error, helper text | LoginPage, RegisterPage, ContractsPage | P0 |
| `<Badge>` / `<StatusPill>` | ContractsPage, ContractDetailPage, UsersPage, OrganizationsPage | P0 |
| `<Modal>` / `<Dialog>` with focus trap and Escape | ContractsPage inline modal | P0 |
| `<Table>` with sortable columns | 6+ pages | P1 |
| `<Card>` with standard padding | 10+ pages | P1 |
| `<EmptyState>` with icon, title, description | ContractsPage only but needed everywhere | P1 |
| `<Skeleton>` loading placeholder | All pages | P1 |
| `<Toast>` / `<Notification>` system | Nowhere — errors shown inline | P1 |
| `<Pagination>` | ContractsPage | P1 |
| `<Avatar>` | Nowhere — user initials would improve sidebar | P2 |
| `<Tooltip>` | Nowhere | P2 |
| `<Select>` with custom styling | ContractsPage filter select | P2 |

### 9.3 No Design Token System

There is no central design token file (CSS custom properties, JS object, or Tailwind preset). Every color is re-declared per app. Any brand color change requires 3 file edits.

---

## 10. Accessibility (a11y) Gaps

| Gap | Location | Severity |
|---|---|---|
| Inline modal has no `role="dialog"`, no `aria-modal`, no focus trap | ContractsPage create modal | High |
| No `aria-label` on icon-only buttons (hamburger, X, logout) | DashboardLayout | High |
| No `role="alert"` on error banners | LoginPage, RegisterPage, SigningPage | High |
| Form inputs lack `id` / `htmlFor` associations | Multiple pages | High |
| No visible focus rings on nav links (overridden by `focus:outline-none`) | All apps | High |
| Sidebar navigation has no `aria-current="page"` | DashboardLayout, AdminLayout | Medium |
| Table headers have no `scope="col"` | All table pages | Medium |
| `<button>` loading states do not announce to screen readers | All forms | Medium |
| No `lang` attribute on `<html>` elements | All apps | Medium |
| Color contrast: `brand-200` (#c2c2ff) on `brand-500` (#1a1a2e) → 7:1 ✅ OK | Sidebar | — |
| Color contrast: `text-gray-500` (#6B7280) on `white` → 4.6:1 ✅ WCAG AA | Cards | — |
| `<canvas>` for signature has no keyboard fallback | SignaturePad | High |
| PDF viewer canvas has no `aria-label` | DocumentViewer | Medium |
| No skip-to-main-content link | All apps | Medium |

---

## 11. Responsive Design Assessment

| App | Mobile | Tablet | Desktop | Assessment |
|---|---|---|---|---|
| **Web** | ⚠️ Partial | ⚠️ Partial | ✅ Good | Sidebar slide-in works; table overflows horizontally on small screens; forms fit |
| **Admin** | ❌ Not designed | ⚠️ OK | ✅ Good | No mobile menu at all; sidebar always visible (hides content on mobile) |
| **Signing App** | ⚠️ OK | ✅ Good | ✅ Good | `lg:flex` split layout stacks on mobile; sign panel appears below PDF (usable but requires scrolling) |

**Specific issues:**
- Web table (`ContractsPage`) has no horizontal scroll wrapper — columns clip on mobile
- Admin sidebar is 240px wide with no collapse mechanism — unusable below 768px
- Signing PDF viewer at max 860px may require horizontal scroll on 375px viewport
- `SignaturePad` canvas at max 640px CSS width fits most mobiles but is tight on iPhone SE (375px)

---

## 12. Performance Considerations

| Item | Assessment |
|---|---|
| Bundle splitting | Vite default chunk splitting — no manual optimization |
| PDF.js bundle | `pdfjs-dist ^4.10.38` ≈ 2.5MB minified — largest dependency; loads in signing-app only |
| PDF worker | Correctly configured via `import.meta.url` as a Worker URL — good |
| PDF fetch | `arrayBuffer()` download before rendering — no streaming; large PDFs will cause delay |
| Canvas rendering | All pages rendered simultaneously via loop — large multi-page PDFs may cause frame drops |
| TanStack Query caching | `staleTime: 0` — refetches on every window focus. For contract lists, `staleTime: 30000` would reduce server load |
| Font loading | System font stack — no FOUT/CLS issues |
| No images | No external images — no optimization needed |
| No code splitting | All routes are eager imports — no `React.lazy()` used |
| Tailwind purge | Configured via `content` globs — only used classes in bundle ✅ |

---

## 13. Issues & Anti-patterns Found

### Critical
1. **Admin portal has zero authentication** — any user with the port can read all platform data
2. **Access token not re-hydrated** — after hard refresh, first API calls may go unauthenticated until Zustand hydrates
3. **No token refresh interceptor** — expired access tokens cause silent 401s, not redirects to login
4. **No `ProtectedRoute` on admin app** — no login guard of any kind

### High
5. **`STATUS_STYLES` duplicated** in `ContractsPage.tsx` and `ContractDetailPage.tsx`
6. **`react-hook-form` + `zod` installed but completely unused** — 3 unused package dependencies
7. **Admin `lib/api.ts` sends no `Authorization` header** — works only because admin API checks JWT internally, but admin UI never provides it
8. **Inline modal without focus trap** — keyboard users can tab behind the modal overlay
9. **`api.setToken()` not called on Zustand hydration** — race condition on page load

### Medium
10. **`cn.ts` utility copied 3 times** — should live in `packages/shared`
11. **`tailwind.config.js` brand colors defined 3 times** — should use a Tailwind preset or CSS custom properties
12. **Storage progress bar hardcoded at 35%** in OverviewPage — misleading fake data
13. **System status cards hardcoded as "Healthy"** in OverviewPage — not actual health check results
14. **No global error boundary** — unhandled React errors crash the entire app
15. **No toast notification system** — errors shown only in inline `{error && <div>}` patterns; success states are silent
16. **Contract detail cannot add participants or upload PDF** — core workflow is blocked in the UI
17. **Templates feature entirely missing** (placeholder page only)

### Low
18. **Admin app has no `date-fns` usage** despite being a declared dependency
19. **`react-hook-form` / `zod` in signing-app** — installed but unused
20. **Typed signature font reliance on OS** — Linux systems will get Comic Sans fallback
21. **No loading skeleton** anywhere — text "Loading..." is accessible but visually poor
22. **No empty state components** in admin pages — empty tables show nothing
23. **Audit log shows truncated UUIDs** instead of user/org names
24. **No `lang` attribute** on HTML elements

---

## 14. Recommended Improvements (Prioritized)

### P0 — Critical (block production)

| # | Improvement | Effort | Impact |
|---|---|---|---|
| P0.1 | Add authentication to admin portal (login page + JWT header on `apiGet`/`apiPost`) | M (1-2d) | 🔴 Security |
| P0.2 | Fix token re-hydration: call `api.setToken()` from Zustand hydration callback in `main.tsx` | S (2h) | 🔴 Auth reliability |
| P0.3 | Add 401 interceptor: on 401, call `refreshAuth()`, retry once, then redirect to `/login` | M (1d) | 🔴 Session management |
| P0.4 | Add focus trap + ARIA attrs to the create contract modal | S (3h) | 🟡 Accessibility |

### P1 — High Priority (pre-launch polish)

| # | Improvement | Effort | Impact |
|---|---|---|---|
| P1.1 | Create `packages/ui` shared component library with Button, Input, Badge, Modal, Card, Table, Skeleton | L (3-5d) | ✨ Consistency + DX |
| P1.2 | Move brand colors to a shared Tailwind preset in `packages/ui/tailwind-preset.js` | S (3h) | ✨ Single source of truth |
| P1.3 | Implement contract PDF upload + participant management UI in ContractDetailPage | L (3d) | 🔑 Core workflow |
| P1.4 | Add global error boundary (`React.lazy` + `ErrorBoundary`) | S (4h) | 🛡️ Stability |
| P1.5 | Add toast notification system (e.g., `sonner` or custom) for success/error feedback | M (1d) | ✨ UX |
| P1.6 | Replace all "Loading..." text with skeleton loaders | M (1d) | ✨ UX |
| P1.7 | Fix `STATUS_STYLES` duplication — move to `packages/shared` or `lib/constants.ts` | S (1h) | 🧹 Maintenance |
| P1.8 | Remove unused packages: `react-hook-form`, `zod`, `@hookform/resolvers`, `date-fns` from apps that don't use them | S (1h) | 🧹 Bundle size |
| P1.9 | Add stale time to TanStack Query: `staleTime: 30_000` for list queries | S (1h) | ⚡ Performance |

### P2 — Medium Priority (quality of life)

| # | Improvement | Effort | Impact |
|---|---|---|---|
| P2.1 | Implement TemplatesPage (template creation, preview, use as contract source) | XL (5-7d) | 🔑 Feature |
| P2.2 | Implement SettingsPage (profile edit, password change, API keys, webhooks) | L (3-4d) | 🔑 Feature |
| P2.3 | Add contract search + sort to ContractsPage | M (1d) | ✨ UX |
| P2.4 | Implement audit trail on ContractDetailPage | M (1d) | 🔑 Feature |
| P2.5 | Add "Decline" button on SigningPage | S (4h) | 🔑 Feature |
| P2.6 | Add zoom controls to DocumentViewer | M (1d) | ✨ UX |
| P2.7 | Add pagination to admin tables (AuditLogs, Users, Orgs) | M (1d) | ⚡ Performance |
| P2.8 | Add signature pressure sensitivity to SignaturePad | M (1d) | ✨ UX |
| P2.9 | Add `aria-label`, `role`, `lang`, and form `id/htmlFor` associations everywhere | M (1-2d) | ♿ a11y |
| P2.10 | Add mobile sidebar to admin portal | M (1d) | 📱 Mobile |
| P2.11 | Custom web font for signature typing (e.g., "Dancing Script" from Google Fonts) | S (2h) | ✨ UX |
| P2.12 | Add "Download signed PDF" button on signing completion screen | S (4h) | 🔑 Feature |

### P3 — Nice to Have

| # | Improvement | Effort |
|---|---|---|
| P3.1 | Add unit tests (Vitest + Testing Library) | XL |
| P3.2 | Add E2E tests (Playwright) for core signing flow | XL |
| P3.3 | Implement real-time updates via WebSocket/SSE for contract status | XL |
| P3.4 | Add dark mode support to web dashboard | L |
| P3.5 | Add internationalization (i18n) | L |
| P3.6 | Implement dashboard charts (contract volume over time) | M |
| P3.7 | Replace inline canvas PDF overlay with proper signature field component | M |
| P3.8 | Add PWA manifest + service worker for offline signing | L |

---

## 15. Proposed Improved Architecture

### 15.1 Shared UI Package

Create a new `packages/ui` package alongside the existing shared packages:

```
packages/
└── ui/
    ├── package.json             # @axa-sign/ui
    ├── tsconfig.json
    ├── tailwind-preset.js       # Shared brand colors + font + spacing tokens
    ├── src/
    │   ├── index.ts             # Barrel export
    │   ├── components/
    │   │   ├── Button.tsx       # Variants: primary, secondary, danger, ghost, link
    │   │   ├── Input.tsx        # With label, error, helperText props
    │   │   ├── Badge.tsx        # Status pill with STATUS_STYLES mapping
    │   │   ├── Card.tsx         # Standard card container with padding variants
    │   │   ├── Modal.tsx        # Focus trap, Escape close, aria-modal
    │   │   ├── Table.tsx        # Sortable, with empty state slot
    │   │   ├── Skeleton.tsx     # Loading placeholder
    │   │   ├── Toast.tsx        # Notification system (or re-export sonner)
    │   │   ├── EmptyState.tsx   # Icon + title + description + action
    │   │   ├── Pagination.tsx   # Previous/Next with count
    │   │   └── Avatar.tsx       # Initials-based avatar
    │   ├── lib/
    │   │   ├── cn.ts            # Single cn() utility
    │   │   └── constants.ts     # STATUS_STYLES and other shared constants
    │   └── types/
    │       └── index.ts         # Shared TypeScript types
    └── dist/                    # Built output
```

### 15.2 Design Token System

**Option A — Tailwind Preset (recommended):**
```js
// packages/ui/tailwind-preset.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f0ff",
          100: "#e0e0ff",
          200: "#c2c2ff",
          300: "#a3a3ff",
          400: "#8585ff",
          500: "#1a1a2e",   // primary navy
          600: "#16162b",   // hover
          700: "#121228",   // deep (admin cards)
          800: "#0e0e25",
          900: "#0a0a22",   // admin background
        },
        surface: {
          dark:   "#0a0a22",
          darkCard: "#121228",
        },
      },
      fontFamily: {
        sans:      ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        signature: ['"Dancing Script"', '"Segoe Script"', '"Brush Script MT"', 'cursive'],
      },
      borderRadius: {
        card: '0.75rem',   // 12px — xl
        input: '0.5rem',   // 8px — lg
      },
    },
  },
};
```

**Usage in each app's `tailwind.config.js`:**
```js
import preset from '@axa-sign/ui/tailwind-preset'
export default { presets: [preset], content: [...] }
```

**Option B — CSS Custom Properties:**
```css
/* packages/ui/src/tokens.css */
:root {
  --color-brand:       #1a1a2e;
  --color-brand-hover: #16162b;
  --color-brand-muted: #c2c2ff;
  --color-bg-dark:     #0a0a22;
  --color-bg-card:     #121228;
}
```

### 15.3 Auth Architecture Fix

```
apps/web/src/main.tsx (after fix):
1. Create QueryClient
2. Read Zustand persisted state from localStorage
3. If accessToken present → api.setToken(accessToken)
4. Mount app

apps/web/src/lib/api.ts (after fix):
- Add interceptor: on 401 → call authStore.refreshAuth() → retry request
- On refresh failure → call authStore.logout() → window.location = '/login'
```

### 15.4 Admin Auth Architecture

```
apps/admin/src/
├── pages/
│   └── LoginPage.tsx           # Simple email+password, POST /api/v1/auth/login
│                                 Note: same endpoint as web — SUPER_ADMIN check on server
├── stores/
│   └── auth.ts                 # Simple: { token, login(), logout() }
├── lib/
│   └── api.ts                  # Include Authorization: Bearer ${token} header
└── App.tsx                     # Add ProtectedRoute wrapper
```

### 15.5 Improved Component Structure (per app)

```
apps/web/src/
├── components/
│   ├── layout/
│   │   └── DashboardLayout.tsx   # (exists)
│   └── contracts/
│       ├── ContractTable.tsx     # Extracted from ContractsPage
│       ├── CreateContractModal.tsx  # Extracted + proper modal component
│       └── ParticipantsList.tsx  # Extracted from ContractDetailPage
├── pages/                        # (exists)
├── hooks/                        # (exists)
├── stores/                       # (exists)
├── lib/                          # (exists)
└── types/
    └── index.ts                  # Contract, Participant, User types
```

### 15.6 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     packages/ui                             │
│  Button  Input  Badge  Modal  Table  Skeleton  Toast  ...   │
│  tailwind-preset.js  |  cn.ts  |  STATUS_STYLES  |  types  │
└────────────┬───────────────────┬───────────────────┬────────┘
             │                   │                   │
     ┌───────▼──────┐  ┌────────▼──────┐  ┌────────▼──────┐
     │  apps/web    │  │  apps/admin   │  │ apps/signing  │
     │  :5173       │  │  :5175        │  │  :5174        │
     │  Light theme │  │  Dark theme   │  │  Light+brand  │
     └──────────────┘  └───────────────┘  └───────────────┘
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 │ Vite proxy /api/*
                        ┌────────▼────────┐
                        │   apps/api      │
                        │   :3000         │
                        └─────────────────┘
```

---

## Appendix A — File Size Reference

| File | Lines | Notes |
|---|---|---|
| `signing-app/src/SigningPage.tsx` | 325 | Largest file — complex flow |
| `signing-app/src/components/DocumentViewer.tsx` | 169 | PDF.js integration |
| `web/src/components/layout/DashboardLayout.tsx` | 126 | Sidebar + topbar |
| `web/src/stores/auth.ts` | 124 | Zustand persist store |
| `web/src/pages/RegisterPage.tsx` | 139 | 5-field form |
| `admin/src/pages/OverviewPage.tsx` | 136 | 6 KPI cards |
| `signing-app/src/components/SignaturePad.tsx` | 107 | Canvas drawing |
| `web/src/hooks/use-contracts.ts` | 96 | 5 TanStack Query hooks |
| `web/src/pages/LoginPage.tsx` | 92 | Auth form |
| `admin/src/components/layout/AdminLayout.tsx` | 78 | Dark sidebar |

## Appendix B — API Endpoints Used by Frontend

| Method | Endpoint | Used by |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Web LoginPage, Admin (future) |
| `POST` | `/api/v1/auth/register` | Web RegisterPage |
| `POST` | `/api/v1/auth/refresh` | Web refreshAuth (not auto-triggered) |
| `GET` | `/api/v1/contracts` | Web ContractsPage |
| `POST` | `/api/v1/contracts` | Web ContractsPage create modal |
| `GET` | `/api/v1/contracts/:id` | Web ContractDetailPage |
| `POST` | `/api/v1/contracts/:id/send` | Web ContractDetailPage |
| `POST` | `/api/v1/contracts/:id/cancel` | Web ContractDetailPage |
| `GET` | `/api/v1/admin/stats` | Admin OverviewPage |
| `GET` | `/api/v1/admin/users` | Admin UsersPage |
| `GET` | `/api/v1/admin/organizations` | Admin OrganizationsPage |
| `GET` | `/api/v1/admin/audit-events` | Admin AuditLogsPage |
| `GET` | `/api/v1/admin/queues` | Admin QueuesPage |
| `GET` | `/api/v1/admin/health` | Admin HealthPage |
| `GET` | `/api/v1/admin/storage` | Admin StoragePage |
| `GET` | `/api/v1/admin/certificates` | Admin CertificatesPage |
| `GET` | `/api/v1/signing/session/:token` | Signing SigningPage |
| `POST` | `/api/v1/signing/session/authenticate` | Signing SigningPage |
| `GET` | `/api/v1/signing/session/:token/document` | Signing DocumentViewer (PDF fetch) |
| `POST` | `/api/v1/signing/sign` | Signing SigningPage |

---

*End of Frontend Audit — Tunaxa Sign (AXA Sign)*  
*Last updated: 2026-11-23*
