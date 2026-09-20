# ARCHITECTURE

## 1. Final Technology Stack

### Frontend / Web Application
- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- Deployment: **Vercel**

### Database / Auth / Storage
- **Supabase PostgreSQL**
- **Supabase Auth**
- **Supabase Storage**
- **Supabase Row Level Security (RLS)**
- **Supabase Queues**
- **Supabase Cron**

### Automation
- **n8n Community Edition**
- Self-hosted on **Railway**

### AI / RAG / Prompt Orchestration
- **Dify Community Edition**
- Self-hosted on **Railway**

### LLM Providers
Use Dify/provider adapters to support replaceable model providers such as:
- OpenAI
- Anthropic
- Gemini
- other supported providers

Do not hard-code one model provider into core business logic.

### Messaging / Channels
Initial:
- Website forms
- Website chat
- WhatsApp via official Meta APIs

Later:
- Meta Lead Ads
- Instagram
- Facebook Messenger
- Google lead sources
- CRM webhooks

### Email
- Resend or equivalent

### Monitoring
- Sentry or equivalent

### DNS / Edge / Security
- Cloudflare where useful

### Source Control
- GitHub

---

## 2. Responsibility Split

### Next.js / Vercel owns:
- customer-facing application;
- tenant dashboard;
- admin dashboard;
- landing pages;
- settings;
- pipeline UI;
- reporting UI;
- authentication screens;
- lightweight API endpoints;
- webhook ingress;
- server-side validation;
- application business rules.

### Supabase owns:
- permanent business data;
- tenant state;
- user memberships;
- leads;
- opportunities;
- conversations;
- appointments;
- follow-ups;
- campaign attribution;
- jobs/events;
- audit logs;
- file storage;
- row-level tenant isolation.

### n8n owns:
- external actions;
- automation execution;
- sending WhatsApp messages;
- notifications;
- emails;
- calendar actions;
- CRM sync;
- scheduled workflow execution;
- integration orchestration.

n8n is **not** the source of truth.

### Dify owns:
- AI workflow orchestration;
- structured lead qualification;
- intent classification;
- conversation summarization;
- RAG;
- AI-assisted responses;
- model/provider routing.

Dify is **not** the source of truth.

### Railway owns:
- long-running/stateful compute;
- n8n Community;
- Dify Community and required supporting services;
- future background workers if necessary.

### Vercel owns:
- web experience;
- Next.js deployment;
- lightweight APIs/webhooks;
- front-end delivery.

---

## 3. Golden Architecture Rule

> **Supabase owns the truth. Next.js owns the product. n8n owns actions. Dify owns AI. Railway owns long-running compute. Vercel owns the web experience.**

Do not violate this separation without a documented architectural reason.

---

## 4. High-Level Architecture

```text
                         CUSTOMER
                            |
          +-----------------+------------------+
          |                 |                  |
       Website          WhatsApp          Lead Sources
          |                 |             Meta / Google
          +-----------------+------------------+
                            |
                            v
                 Next.js / API Ingress
                       on Vercel
                            |
               validate / normalize / dedupe
                            |
                            v
                        Supabase
                (persistent source of truth)
                  /                     \
                 /                       \
                v                         v
              Dify                       n8n
         AI / RAG / NLP             Automation Engine
            Railway                    Railway
                |                         |
                |                  +------+------+
                |                  |      |      |
                |              WhatsApp Calendar CRM/API
                |                         |
                +-----------+-------------+
                            |
                            v
                        Supabase
                            |
                            v
                    Next.js Dashboard
```

---

## 5. Inbound Event Principle

For external webhooks and incoming leads:

**Receive → validate → deduplicate → persist → queue → acknowledge**

Do not wait for multiple external systems before acknowledging an inbound webhook.

Correct:

```text
Meta webhook
  ↓
Verify signature
  ↓
Normalize
  ↓
Persist lead/event in Supabase
  ↓
Create queue/job entry
  ↓
Return HTTP 200
  ↓
Async processing begins
```

### Website chatbot (Phase 5)

The public website widget is an iframe rendered by Next.js. Its public request path is:

```text
Customer → website iframe → channel adapter → message router → conversation state
         → query / intent router (predefined now; database, RAG and AI later)
         → action engine (placeholder now; n8n later) → Supabase → dashboard
```

The widget invokes one controlled application boundary, not browser Supabase access. Predefined flows are tenant-owned graph data and are resolved only when a public widget ID belongs to an enabled, published configuration. `conversations` and `conversation_messages` use a normalized channel field so future adapters can feed the same engine. Dify, n8n, live availability, and external channels remain out of scope for Phase 5.

Incorrect:

```text
Meta webhook
  ↓
Dify
  ↓
n8n
  ↓
WhatsApp
  ↓
Calendar
  ↓
Database
  ↓
Return HTTP 200
```

The second design is fragile and risks losing leads.

---

## 6. Event-Driven Application Model

Important internal events should be explicit.

Examples:
- `lead.created`
- `lead.updated`
- `lead.contacted`
- `lead.replied`
- `lead.qualification_requested`
- `lead.qualified`
- `lead.disqualified`
- `appointment.booked`
- `appointment.rescheduled`
- `appointment.cancelled`
- `appointment.completed`
- `appointment.no_show`
- `followup.due`
- `opportunity.created`
- `opportunity.stage_changed`
- `opportunity.won`
- `opportunity.lost`
- `revenue.recorded`

Events should be persisted before downstream automation where practical.

---

## 7. Queue Architecture

Use Supabase Queues for durable work that should not disappear when a worker is unavailable.

Suggested logical queues:
- `lead_processing`
- `ai_processing`
- `outbound_messages`
- `followups`
- `appointment_reminders`
- `integration_sync`
- `analytics_events`

Each job should support:
- unique/idempotency key;
- tenant ID;
- event type;
- payload;
- status;
- retry count;
- timestamps;
- error message;
- result metadata.

Suggested states:
- `pending`
- `processing`
- `completed`
- `failed`
- `cancelled`

---

## 8. Scheduling

Use Supabase Cron for reliable scheduling triggers.

Examples:
- scan for due follow-ups;
- scan for appointment reminders;
- enqueue stale lead checks;
- enqueue reactivation work;
- periodic cleanup/maintenance.

Cron should enqueue work. It should not contain large business workflows itself.

---

## 9. AI Routing Principle

Do not send every message to an LLM.

Routing order:

```text
Incoming message
     |
     v
Known deterministic flow?
     | yes
     v
Use application logic

no
 |
 v
Can structured DB/business logic answer?
     | yes
     v
Query Supabase / code

no
 |
 v
Knowledge question?
     | yes
     v
Dify RAG

no
 |
 v
Needs interpretation/reasoning?
     |
     v
Dify / LLM
```

AI should be selective, not default.

---

## 10. Dify Responsibilities

Use Dify for:
- qualification extraction;
- intent detection;
- lead scoring support;
- summarization;
- RAG;
- response drafting;
- structured JSON extraction.

Example structured output:

```json
{
  "intent": "high",
  "qualification_score": 88,
  "budget": 1200000,
  "timeline": "1 month",
  "requested_appointment": true
}
```

The application must validate AI output before it changes important business state.

---

## 11. Dify Abstraction

The application should not scatter direct Dify API calls across the codebase.

Create an internal AI service interface such as:

```ts
interface AIService {
  qualifyLead(input: QualifyLeadInput): Promise<QualificationResult>
  classifyIntent(input: ClassifyIntentInput): Promise<IntentResult>
  summarizeConversation(input: SummarizeConversationInput): Promise<SummaryResult>
  answerKnowledgeQuestion(input: KnowledgeInput): Promise<KnowledgeResult>
}
```

Initial implementation:
`DifyAIService`

Future implementation could use direct LLM APIs without changing product/business logic.

---

## 12. n8n Responsibilities

n8n is an executor.

Typical n8n workflows:
- send WhatsApp message;
- send email;
- notify salesperson;
- create calendar event;
- sync CRM;
- run follow-up sequence;
- trigger review request;
- trigger lead reactivation;
- external API orchestration.

n8n must:
- read state from Supabase/API;
- perform validated action;
- write result/status back;
- use idempotency where possible.

n8n must not be the canonical owner of:
- lead status;
- appointment truth;
- sales status;
- conversation history;
- business configuration.

---

## 13. Messaging Abstraction

Use a provider abstraction.

Example interface:

```ts
interface MessagingProvider {
  sendText(...)
  sendTemplate(...)
  sendMedia(...)
  markRead(...)
}
```

Initial implementation can use official Meta WhatsApp Cloud API.

Do not couple business logic directly to one messaging provider.

---

## 14. Multi-Tenancy

Every tenant-owned record must include `tenant_id`.

Tenant isolation must be enforced through:
- Supabase RLS;
- server-side authorization;
- membership checks;
- tenant-scoped queries;
- tests.

No user should be able to read or mutate another tenant's records by changing a URL, request body, or API call.

---

## 15. Environment Separation

At minimum:
- development;
- production.

Recommended later:
- local/dev;
- staging;
- production.

Keep separate:
- Supabase projects;
- Railway environments/services;
- Vercel environments;
- Dify environments;
- n8n credentials;
- API secrets.

---

## 16. Deployment Layout

```text
Vercel
  └── Next.js application

Supabase
  ├── PostgreSQL
  ├── Auth
  ├── Storage
  ├── RLS
  ├── Queues
  └── Cron

Railway
  ├── n8n Community
  ├── Dify Community
  └── future worker service if justified

External
  ├── Meta WhatsApp API
  ├── LLM providers
  ├── Resend
  └── future CRM/calendar/ad providers
```

---

## 17. Infrastructure Not Allowed in MVP Without Justification

Do not introduce:
- Kubernetes;
- Kafka;
- RabbitMQ;
- Elasticsearch;
- microservices;
- custom vector database;
- Redis for core app needs;
- separate backend language;
- custom CRM engine;
- complex service mesh.

Add infrastructure only when measurable production needs justify it.

---

## 18. Reliability Requirements

Critical workflows should use:
- idempotency;
- webhook deduplication;
- retries;
- exponential backoff;
- timeout limits;
- persistent state;
- queue/job status;
- dead-letter/error handling;
- audit logs;
- human handoff where necessary.

A third-party outage must not corrupt core business state.

---

## 19. Security Requirements

- never expose Supabase service role keys to browser code;
- never expose provider secrets to frontend;
- validate webhooks/signatures;
- use OAuth where appropriate;
- use RLS on tenant-owned tables;
- log sensitive admin/configuration actions;
- store API secrets securely;
- follow least privilege;
- protect production n8n and Dify admin interfaces;
- create retention/deletion policies before real client launch.

---

## 20. Build Order

### Phase 1
Next.js + Supabase + Auth + tenants + RLS.

### Phase 2
Leads + contacts + opportunities + pipeline.

### Phase 3
Appointments + follow-ups.

### Phase 4
Industry templates + tenant configuration.

### Phase 5
n8n integration.

### Phase 6
Dify integration.

### Phase 7
WhatsApp / Meta integrations.

### Phase 8
Attribution + revenue reporting.

### Phase 9
Productization and reusable niche automation templates.

Do not build later phases before earlier foundations are working.
