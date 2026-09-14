# Lead-to-Revenue Platform

A reusable, multi-tenant, configuration-driven platform for turning enquiries into qualified sales opportunities and measurable revenue. Industry-specific behavior will be supplied through templates and tenant configuration rather than separate applications.

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
      migrations/       Future database migrations
      seed/             Future seed data
    templates/          Future industry-template data

The shared-package and Supabase directories are intentionally empty during Phase 1A.

## Local development

### Prerequisites

- Node.js 20.9 or newer
- pnpm 11.19.0

### Setup

Install workspace dependencies from the repository root:

    pnpm install

The scaffold does not connect to Supabase yet. When environment variables are needed, copy `apps/web/.env.example` to `apps/web/.env.local` and provide local values. Never commit real secrets.

Start the web application:

    pnpm dev

Open [http://localhost:3000](http://localhost:3000).

### Verification commands

    pnpm lint
    pnpm typecheck
    pnpm build
