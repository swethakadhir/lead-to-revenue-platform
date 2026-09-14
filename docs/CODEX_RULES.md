# CODEX RULES

## 1. Purpose
These rules are mandatory for any coding work on this repository.

Codex must read:
1. `PROJECT_OVERVIEW.md`
2. `ARCHITECTURE.md`
3. `DATA_MODEL.md`
4. `PRODUCT_REQUIREMENTS.md`
5. this file

before making substantial architectural changes.

If a request conflicts with these documents, Codex should identify the conflict before implementing it.

---

## 2. Core Product Rule

Build **one reusable multi-tenant Lead-to-Revenue platform**.

Do not build separate applications for:
- dental;
- salons;
- interior design;
- real estate;
- any other niche.

Industry behavior must come from templates and configuration.

Never solve niche differences using scattered hard-coded conditionals such as:

```ts
if (industry === "dental") { ... }
if (industry === "salon") { ... }
```

Instead use:
- template data;
- tenant settings;
- dynamic field definitions;
- configurable pipeline stages;
- qualification rules;
- automation configuration.

---

## 3. Architecture Rules

### Supabase
Supabase is the permanent source of truth.

Store core business state in Supabase:
- tenants;
- users/memberships;
- contacts;
- leads;
- opportunities;
- appointments;
- follow-ups;
- conversations/messages;
- campaign/source data;
- jobs/events;
- audit logs;
- revenue information.

Do not make n8n or Dify the canonical source of business state.

### Next.js
Next.js is the main product/application layer.

Business rules should live in the application/backend where appropriate.

### n8n
n8n executes automation.

Use n8n for:
- external actions;
- messages;
- notifications;
- calendar;
- CRM sync;
- API orchestration;
- follow-up execution.

Do not store permanent business truth only inside n8n workflows.

### Dify
Dify handles AI and RAG.

Use Dify for:
- qualification;
- extraction;
- classification;
- summarization;
- RAG;
- AI-assisted responses.

Dify must not directly own critical workflow state.

### Railway
Use Railway for long-running/self-hosted services such as n8n and Dify.

### Vercel
Use Vercel for the Next.js application and lightweight API/webhook entry points.

---

## 4. AI Rules

Do not send every request to AI.

Priority:
1. deterministic logic;
2. database/business logic;
3. RAG;
4. complex AI reasoning.

AI should return structured results whenever possible.

Validate AI output before using it to:
- change opportunity stages;
- mark leads won/lost;
- create/cancel appointments;
- send sensitive messages;
- modify pricing;
- trigger expensive or irreversible actions.

Do not allow autonomous AI behavior to bypass business rules.

---

## 5. Multi-Tenancy Rules

Every tenant-owned table must contain `tenant_id`.

Use Supabase RLS.

Never trust a client-provided `tenant_id` without verifying user membership.

All server-side queries must be tenant-scoped.

Add tests for cross-tenant access.

A user changing:
- URL parameters;
- form body;
- API request;
- browser state

must not gain access to another tenant.

---

## 6. Data Modeling Rules

Keep these concepts separate:
- Contact = person/customer.
- Lead = enquiry.
- Opportunity = actual sales opportunity.
- Appointment = scheduled meeting/service.
- Revenue Event = attributed revenue outcome.

Do not merge them into one giant lead table.

Use configurable fields/JSONB for niche-specific answers instead of adding industry-specific columns repeatedly.

Use typed/structured columns for frequently queried core fields.

---

## 7. Integration Rules

Create adapters/interfaces for external providers.

Examples:
- `AIService`
- `MessagingProvider`
- `CalendarProvider`
- `CRMProvider`

Do not scatter provider-specific HTTP code throughout the application.

The initial provider may change later.

---

## 8. Webhook Rules

External webhook flow:

```text
verify
→ normalize
→ deduplicate
→ persist
→ enqueue
→ acknowledge
```

Do not execute long AI/automation chains synchronously before acknowledging external webhooks.

Persist external event IDs.

Use idempotency.

---

## 9. Job / Background Work Rules

Background work must be recoverable.

Use:
- Supabase Queues;
- job records;
- retry count;
- status;
- error field;
- idempotency key.

Suggested statuses:
- pending
- processing
- completed
- failed
- cancelled

A worker failure must not silently lose the task.

---

## 10. Code Quality Rules

Use:
- TypeScript;
- clear types;
- schema validation;
- reusable modules;
- small functions;
- explicit naming;
- database migrations;
- linting;
- formatting;
- meaningful error handling.

Avoid:
- giant files;
- duplicated logic;
- magical constants;
- business logic inside UI components;
- provider secrets in client code;
- ad-hoc SQL spread across unrelated modules.

---

## 11. Folder Strategy

Recommended structure:

```text
/apps
  /web

/packages
  /ui
  /db
  /domain
  /ai
  /integrations
  /events

/supabase
  /migrations
  /seed

/templates
  dental.json
  salon.json
  interiors.json

/docs
  PROJECT_OVERVIEW.md
  ARCHITECTURE.md
  DATA_MODEL.md
  PRODUCT_REQUIREMENTS.md
  CODEX_RULES.md
```

Codex may adjust details when justified, but must keep separation of concerns.

---

## 12. UI Rules

The product should look like an operational sales/revenue tool.

Prioritize:
- Leads
- Pipeline
- Appointments
- Follow-ups
- Won/Lost
- Revenue

Do not make:
- token counts;
- AI request volume;
- Dify workflow metrics;
- n8n execution counts

the primary client-facing experience.

Technical metrics belong in admin/ops views.

---

## 13. Template Rules

Templates should be data, not application branches.

Each template may define:
- labels;
- fields;
- required fields;
- default pipeline;
- appointment types;
- qualification schema;
- automation defaults.

The app must render these dynamically.

Before considering template architecture complete, verify at least:
- Dental template;
- Salon template;

with no code changes between them.

---

## 14. Security Rules

Never:
- expose service-role keys to browser;
- commit `.env` secrets;
- expose n8n/Dify admin credentials;
- trust browser authorization;
- store passwords manually;
- disable RLS to “make it work”;
- log secrets.

Use secure environment variables.

---

## 15. Scope Rules

Do not add features merely because they might be useful later.

Before adding a major feature ask:
1. Is it required for current phase?
2. Does it improve lead-to-revenue conversion?
3. Is there a simpler version?
4. Does it introduce unnecessary infrastructure?
5. Can it wait until a real client needs it?

Avoid premature:
- microservices;
- Kubernetes;
- Kafka;
- custom vector DB;
- Voice AI;
- mobile app;
- advanced BI;
- custom workflow builder;
- full CRM;
- ERP;
- billing engine.

---

## 16. Build Sequence

Codex should work phase-by-phase.

### Phase 1
- project setup;
- Next.js;
- Supabase;
- auth;
- tenants;
- memberships;
- RLS;
- app shell.

### Phase 2
- contacts;
- leads;
- lead details;
- opportunities;
- pipeline.

### Phase 3
- appointments;
- follow-ups;
- dashboard basics.

### Phase 4
- industry templates;
- dynamic fields;
- configurable pipeline;
- qualification settings.

### Phase 5
- n8n adapter/integration;
- event/job tracking.

### Phase 6
- Dify AI adapter;
- structured qualification;
- summaries.

### Phase 7
- WhatsApp / Meta integration.

### Phase 8
- attribution;
- revenue reporting.

Do not jump several phases ahead unless explicitly requested.

---

## 17. Before Each Major Implementation

Codex should:
1. identify the current phase;
2. read relevant docs;
3. summarize planned changes;
4. list files/tables affected;
5. call out migrations;
6. call out security/RLS implications;
7. implement;
8. run tests/lint/typecheck if available;
9. summarize what changed;
10. state any unresolved risks.

---

## 18. Migration Rules

All database schema changes must be migrations.

Do not manually change production schema without migration history.

Migrations should:
- be reversible when practical;
- include indexes;
- include constraints;
- consider RLS;
- avoid destructive changes without warning.

---

## 19. Testing Priorities

Highest priority tests:
- tenant isolation;
- auth/authorization;
- lead creation/editing;
- pipeline changes;
- dynamic template fields;
- opportunity won/lost;
- webhook deduplication;
- idempotency;
- AI output validation;
- job retry behavior.

---

## 20. Definition of Done

A feature is not done because the screen renders.

It is done when:
- data model is correct;
- authorization is correct;
- tenant isolation is correct;
- error/loading states exist;
- important events are logged;
- types/validation are present;
- tests exist where critical;
- docs are updated when architecture/product behavior changes.

---

## 21. Non-Negotiable Final Principle

> **Keep the core platform generic, keep industry behavior configurable, keep data in Supabase, keep automation in n8n, keep AI in Dify, and do not overbuild before real client usage proves the need.**
