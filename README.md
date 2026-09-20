# Lead-to-Revenue Platform

A reusable, multi-tenant, configuration-driven platform for turning enquiries into qualified sales opportunities and measurable revenue. Phase 4 adds industry templates and tenant-owned configuration for dynamic lead forms, pipeline labels, appointment types, and qualification criteria.

## Repository structure

    apps/
      web/              Next.js web application
    docs/               Product and architecture documentation
    packages/
      ai/               Future AI service interfaces
      db/               Future database access modules
      domain/           Future shared domain logic
      events/           Future event contracts
      integrations/     Future provider adapters
      ui/               Future shared UI components
    supabase/
      migrations/       Versioned database migrations
      seed/             Future local seed data
      tests/            pgTAP database and RLS tests
    templates/          Reserved for future template export assets

The shared-package directories remain placeholders until their relevant implementation phases.

## Local development

### Prerequisites

- Node.js 20.9 or newer
- pnpm 11.19.0
- Docker Desktop or another Docker-compatible runtime for local Supabase

### Setup

Install workspace dependencies from the repository root:

    pnpm install

Start local Supabase:

    pnpm supabase:start

Copy `apps/web/.env.example` to `apps/web/.env.local`. Use the local API URL, anon key, and service-role key printed by `supabase start` (or `pnpm exec supabase status`). The service-role key is server-only and must never use a `NEXT_PUBLIC_` prefix or be committed.

Apply migrations and reset local data:

    pnpm db:reset

Start the web application:

    pnpm dev

Open [http://localhost:3000](http://localhost:3000).

Create a test user through local Supabase Studio at [http://localhost:54323](http://localhost:54323), then sign in at `/login`. Profile provisioning is handled by a database trigger in the same transaction as auth-user creation. If the user has no tenant, `/app/dashboard` redirects to `/app/create-business`.

Creating a business now requires selecting Dental Clinic, Salon / Parlour, Interior Design, or Custom / Generic. The tenant, owner membership, tenant-owned configuration, and pipeline stages are provisioned in one database transaction. Pre-Phase-4 tenants receive generic configuration without changing their existing leads or pipeline records; an owner/admin can apply a named template once at `/app/settings`. Authenticated tenant operators can create and edit leads with fields generated from their tenant configuration at `/app/leads`, open lead details and create opportunities at `/app/leads/[id]`, and update opportunity stages at `/app/pipeline`.

Appointments and follow-ups are available at `/app/appointments` and `/app/followups`, and lead detail includes its operational history and creation forms. Owners, admins, sales, and front-desk members can create and update operational records; viewers are read-only. The dashboard uses only the active tenant and reports live lead, appointment, follow-up, opportunity, won, and pipeline-value metrics. Appointment times are stored as UTC instants and presented in the tenant's IANA timezone.

Owners/admins can rename and reorder lead fields, change required/active status and select options, rename pipeline stages, and edit appointment types at `/app/settings`. Viewers are read-only. Configuration updates are written to `audit_logs`. No n8n, Dify, or external event delivery is part of Phase 4. See [Industry template architecture](docs/INDUSTRY_TEMPLATES.md).

Phase 5 adds a tenant-configured deterministic website chatbot at `/app/settings/chatbot`. Publish an enabled chatbot, then use the displayed iframe URL in a client website. The widget is public but resolves only a published configuration, routes all interaction through a Next.js server endpoint, and creates standard contacts/leads when its capture flow completes. It does not call Dify, an LLM, n8n, or external channels. See [website chatbot architecture](docs/WEBSITE_CHATBOT.md).

### Verification commands

    pnpm lint
    pnpm typecheck
    pnpm build
    pnpm db:test

`pnpm db:test` runs the pgTAP isolation suite against the local Supabase database. No command in this repository automatically deploys migrations to a production Supabase project.

The Phase 4 application-level validation suite can be run with `node apps/web/lib/domain/configuration/dynamic-fields.test.mjs`. The Phase 4 pgTAP suite is `supabase/tests/industry_templates.test.sql`. Apply new migrations only to the intended development project after confirming the linked Supabase project reference; do not point the CLI at production.
