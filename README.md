# Lead-to-Revenue Platform

A reusable, multi-tenant, configuration-driven platform for turning enquiries into qualified sales opportunities and measurable revenue. Phase 3 adds the tenant-safe appointment and follow-up workflow plus an operational dashboard built from live tenant data.

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
    templates/          Future industry-template data

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

Creating a business provisions the default pipeline stages in the same database transaction. Authenticated tenant operators can create and edit leads at `/app/leads`, open lead details and create opportunities at `/app/leads/[id]`, and update opportunity stages at `/app/pipeline`.

Appointments and follow-ups are available at `/app/appointments` and `/app/followups`, and lead detail includes its operational history and creation forms. Owners, admins, sales, and front-desk members can create and update operational records; viewers are read-only. The dashboard uses only the active tenant and reports live lead, appointment, follow-up, opportunity, won, and pipeline-value metrics. Appointment times are stored as UTC instants and presented in the tenant's IANA timezone.

Phase 3 does not introduce `audit_logs` or event delivery because no shared audit/event infrastructure exists yet. Critical opportunity and operational outcome timestamps are enforced in PostgreSQL. Appointment and follow-up event names are documented in the data model for a later event-infrastructure phase.

### Verification commands

    pnpm lint
    pnpm typecheck
    pnpm build
    pnpm db:test

`pnpm db:test` runs the pgTAP isolation suite against the local Supabase database. No command in this repository automatically deploys migrations to a production Supabase project.
