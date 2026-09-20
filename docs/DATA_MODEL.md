# DATA MODEL

## 1. Design Principles

1. **Supabase PostgreSQL is the source of truth.**
2. Every tenant-owned table must include `tenant_id`.
3. Use UUID primary keys unless there is a clear reason not to.
4. Prefer normalized core business entities.
5. Allow niche-specific fields through configurable field definitions and structured metadata.
6. Do not create separate tables for every industry.
7. Do not store critical business state only in Dify or n8n.
8. Keep auditability for important state changes.
9. Make lead source and revenue attribution first-class concepts.
10. Separate a person/contact from a lead and an opportunity.

---

## 2. Core Entity Relationship

```text
Tenant
 ├── Users / Memberships
 ├── Industry Template
 ├── Settings
 ├── Contacts
 │     └── Leads
 │           └── Opportunities
 │                 ├── Appointments
 │                 ├── Follow-ups
 │                 └── Revenue Events
 ├── Conversations
 │     └── Messages
 ├── Campaigns
 │     └── Attribution Events
 ├── Integrations
 ├── Jobs / Automation Events
 └── Audit Logs
```

---

## 3. Core Tables

### `tenants`
Represents a client business.

Suggested fields:
- `id uuid primary key`
- `name text`
- `slug text unique`
- `industry_template_id uuid null`
- `timezone text`
- `currency text`
- `status text`
- `created_at timestamptz`
- `updated_at timestamptz`

Status examples:
- `active`
- `trial`
- `suspended`
- `archived`

---

### `profiles`
Application profile linked to Supabase Auth user.

Suggested fields:
- `id uuid primary key` — same ID as auth user where appropriate
- `full_name text`
- `email text`
- `phone text null`
- `created_at timestamptz`
- `updated_at timestamptz`

Do not use this table alone for tenant authorization.

---

### `tenant_members`
Links users to businesses.

Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `user_id uuid`
- `role text`
- `status text`
- `created_at timestamptz`

Role examples:
- `owner`
- `admin`
- `sales`
- `front_desk`
- `viewer`

Unique constraint:
- `(tenant_id, user_id)`

---

## 4. Template / Configuration Tables

### `industry_templates`
Reusable niche templates.

Phase 4 stores a versioned `configuration` JSONB definition on each global template. Template rows are authenticated-read-only; tenant users do not edit global definitions. The initial keys are `dental`, `salon`, `interior_design`, and `custom`.

Suggested fields:
- `id uuid primary key`
- `key text unique`
- `name text`
- `version integer`
- `description text`
- `is_active boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

Examples:
- `dental_v1`
- `salon_v1`
- `interiors_v1`

---

### `tenant_settings`
Business-specific configuration.

Phase 4 stores copied `appointment_types`, `followup_defaults`, and `terminology` JSONB alongside business information. The template is copied at provisioning, so changing a global template does not silently change a tenant. Currency remains on `tenants` only.

Suggested fields:
- `id uuid primary key`
- `tenant_id uuid unique`
- `business_name text`
- `business_description text null`
- `business_hours jsonb`
- `default_language text`
- `settings jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

Use structured columns for frequently queried fields. Use JSONB only for flexible settings that do not justify a dedicated schema yet.
`tenants.currency` is the canonical tenant currency; do not duplicate currency ownership in this table.

---

### `lead_field_definitions`
Defines dynamic fields shown for leads.

Phase 4 uses tenant-owned copies only (each row has `tenant_id`). The global template's `configuration.lead_fields` is the reusable definition. Each copy also has `placeholder`, `help_text`, `qualification_relevant`, and `updated_at`. The supported types are text, textarea, number, currency, select, multi_select, boolean, date, datetime, phone, and email. The application and database validate configured values; unconfigured legacy keys remain compatible.

Suggested fields:
- `id uuid primary key`
- `template_id uuid null`
- `tenant_id uuid null`
- `key text`
- `label text`
- `field_type text`
- `required boolean`
- `options jsonb null`
- `sort_order integer`
- `is_active boolean`
- `created_at timestamptz`

Examples:
- Dental: `treatment_type`
- Salon: `service_type`
- Interiors: `property_type`

Do not add separate database columns for every niche field.

---

### `pipeline_definitions`
Defines pipeline stages.

Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `key text`
- `name text`
- `stage_order integer`
- `stage_type text`
- `is_terminal boolean`
- `is_active boolean`

Recommended default stages:
- `new`
- `contacted`
- `engaged`
- `qualifying`
- `qualified`
- `appointment_booked`
- `appointment_completed`
- `proposal`
- `won`
- `lost`
- `dormant`

Initial stage types are `open`, `won`, `lost`, and `dormant`. `open` stages are non-terminal; the other stage types are explicitly terminal. Opportunity outcome timestamps are derived from stage type so tenant-defined keys remain configuration rather than application branches.

---

### `qualification_rules`
Configurable qualification rules.

Phase 4 copies starter presence/contact criteria to each tenant. These are visible configuration, not AI qualification or automatic scoring. Later phases can use the rules without changing the core schema.

Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `name text`
- `rule_type text`
- `field_key text`
- `operator text`
- `value jsonb`
- `score_delta integer`
- `is_required boolean`
- `is_active boolean`

AI may assist qualification, but deterministic rules should remain possible.

---

## 5. Sales / Lead Tables

### `contacts`
Represents a person/customer.

Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `first_name text`
- `last_name text null`
- `email text null`
- `phone text null`
- `whatsapp_number text null`
- `preferred_channel text null`
- `metadata jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

Potential deduplication keys:
- normalized phone;
- normalized email.

---

### `leads`
Represents an enquiry.

Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `contact_id uuid null`
- `source_id uuid null`
- `campaign_id uuid null`
- `external_lead_id text null`
- `status text`
- `qualification_status text`
- `qualification_score integer null`
- `assigned_user_id uuid null`
- `lead_data jsonb`
- `first_contacted_at timestamptz null`
- `last_contacted_at timestamptz null`
- `next_followup_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

Important:
`lead_data` stores niche-specific answers based on configured field definitions.

Initial lead statuses are `new`, `contacted`, `engaged`, `qualifying`, `qualified`, `disqualified`, `dormant`, and `converted`. Initial qualification statuses are `unqualified`, `pending`, `qualified`, and `disqualified`.

---

### `opportunities`
Represents a real sales opportunity.

Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `lead_id uuid`
- `contact_id uuid null`
- `name text`
- `stage_key text`
- `estimated_value numeric null`
- `currency text`
- `probability integer null`
- `assigned_user_id uuid null`
- `expected_close_date date null`
- `won_at timestamptz null`
- `lost_at timestamptz null`
- `lost_reason text null`
- `created_at timestamptz`
- `updated_at timestamptz`

Lead and opportunity must remain separate concepts.

---

## 6. Appointment / Follow-up Tables

### `appointments`
Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `lead_id uuid null`
- `opportunity_id uuid null`
- `contact_id uuid`
- `assigned_user_id uuid null`
- `title text`
- `appointment_type text null`
- `status text`
- `starts_at timestamptz`
- `ends_at timestamptz`
- `timezone text`
- `location text null`
- `meeting_url text null`
- `notes text null`
- `cancellation_reason text null`
- `completed_at timestamptz null`
- `cancelled_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

Initial statuses:
- `scheduled`
- `confirmed`
- `completed`
- `cancelled`
- `no_show`

Contact, lead, opportunity, and assignee relationships are tenant-bound. Assignees must be active tenant members, `ends_at` must be after `starts_at`, and PostgreSQL derives completion/cancellation timestamps from status transitions.

---

### `followups`
Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `lead_id uuid null`
- `opportunity_id uuid null`
- `contact_id uuid null`
- `assigned_user_id uuid null`
- `type text`
- `status text`
- `due_at timestamptz`
- `completed_at timestamptz null`
- `notes text null`
- `outcome text null`
- `created_at timestamptz`
- `updated_at timestamptz`

Initial types:
- `call`
- `whatsapp`
- `email`
- `meeting`
- `general`

Initial statuses:
- `pending`
- `completed`
- `cancelled`

Contact, lead, opportunity, and assignee relationships are tenant-bound. Assignees must be active tenant members, and PostgreSQL derives `completed_at` from status transitions.

Intended future domain events are `appointment.booked`, `appointment.confirmed`, `appointment.completed`, `appointment.cancelled`, `appointment.no_show`, `followup.created`, and `followup.completed`. Persistence and dispatch are deferred until the shared event/audit infrastructure is introduced; Phase 3 does not connect these events to an external system.

---

## 7. Conversation Tables

### `conversations`
Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `contact_id uuid null`
- `lead_id uuid null`
- `channel text`
- `external_thread_id text null`
- `status text`
- `assigned_user_id uuid null`
- `last_message_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

---

### `messages`
Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `conversation_id uuid`
- `external_message_id text null`
- `direction text`
- `sender_type text`
- `content_type text`
- `body text null`
- `payload jsonb null`
- `delivery_status text null`
- `sent_at timestamptz`
- `created_at timestamptz`

Directions:
- `inbound`
- `outbound`

Sender types:
- `contact`
- `user`
- `automation`
- `ai`
- `system`

Add uniqueness where possible for provider/external message IDs.

### Phase 5 chatbot conversation model

`chatbot_configs`, `chatbot_nodes`, and `chatbot_edges` hold a tenant-owned predefined graph. `conversations` and `conversation_messages` persist channel-neutral visitor/bot state; Phase 5 uses the `website` channel only. A public widget ID is safe to embed but resolves only a published/enabled configuration through a controlled server endpoint. Chatbot lead capture links to the existing contacts/leads tables and continues to use `leads.lead_data` for configurable answers.

### Managed-journey additions

`leads.status` is the single lifecycle state. It includes additive states for requirement understanding, booking readiness/in-progress, and human intervention while retaining existing values. A confirmed appointment maps its linked lead to `converted`; contact capture never does so. `human_interventions` links a tenant to optional lead/contact/conversation records, reason, queue status, request/resolution timestamps, resolution notes, and an internal handler. `platform_operators` is a separate internal-user allowlist and must never be conflated with tenant membership.

---

## 8. Marketing / Attribution Tables

### `lead_sources`
Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `key text`
- `name text`
- `channel text`
- `created_at timestamptz`

Examples:
- Meta Ads
- Google Ads
- Website
- WhatsApp
- Referral
- Walk-in
- Manual

---

### `campaigns`
Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `source_id uuid null`
- `name text`
- `external_campaign_id text null`
- `status text`
- `spend numeric null`
- `starts_at timestamptz null`
- `ends_at timestamptz null`
- `metadata jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

---

### `attribution_events`
Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `lead_id uuid null`
- `opportunity_id uuid null`
- `campaign_id uuid null`
- `event_type text`
- `event_value numeric null`
- `metadata jsonb`
- `occurred_at timestamptz`

Event examples:
- `lead_created`
- `qualified`
- `appointment_booked`
- `appointment_completed`
- `proposal`
- `won`
- `revenue`

---

### `revenue_events`
Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `opportunity_id uuid`
- `lead_id uuid null`
- `amount numeric`
- `currency text`
- `event_type text`
- `occurred_at timestamptz`
- `metadata jsonb`

Do not assume the first version must manage payments. This table can record attributed revenue without becoming a payment processor.

---

## 9. Integration / Operations Tables

### `integrations`
Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `provider text`
- `status text`
- `config jsonb`
- `secret_reference text null`
- `connected_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

Never store raw secrets in frontend-readable JSON.

---

### `jobs`
Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `job_type text`
- `idempotency_key text`
- `status text`
- `payload jsonb`
- `result jsonb null`
- `attempt_count integer`
- `scheduled_at timestamptz null`
- `started_at timestamptz null`
- `completed_at timestamptz null`
- `last_error text null`
- `created_at timestamptz`
- `updated_at timestamptz`

Unique constraint should protect idempotency when appropriate.

---

### `automation_events`
Suggested fields:
- `id uuid primary key`
- `tenant_id uuid`
- `event_type text`
- `entity_type text`
- `entity_id uuid null`
- `external_event_id text null`
- `provider text null`
- `payload jsonb`
- `status text`
- `created_at timestamptz`

Use uniqueness such as `(provider, external_event_id)` when external systems provide stable event IDs.

---

### `audit_logs`
Suggested fields:
- `id uuid primary key`
- `tenant_id uuid null`
- `actor_user_id uuid null`
- `actor_type text`
- `action text`
- `entity_type text`
- `entity_id uuid null`
- `before_data jsonb null`
- `after_data jsonb null`
- `created_at timestamptz`

Audit at least:
- tenant configuration changes;
- integration changes;
- permission changes;
- pipeline stage changes for critical entities;
- manual won/lost changes;
- destructive operations.

Phase 4 introduces tenant-owned `audit_logs` for configuration updates. Only owners/admins can read them; writes come from database triggers, not clients.

---

## 10. Dynamic Industry Data

Industry-specific fields should be stored through:
- `lead_field_definitions`;
- `lead_data jsonb`;
- configurable pipeline;
- configurable qualification rules.

Example Dental lead:

```json
{
  "treatment_type": "Implant",
  "pain_level": "moderate",
  "preferred_date": "2026-10-10"
}
```

Example Interior Design lead:

```json
{
  "property_type": "3BHK",
  "location": "OMR",
  "budget": 1200000,
  "possession_date": "2026-11-01",
  "scope": "full_interiors"
}
```

The application UI renders these fields from definitions rather than hard-coded components.

---

## 11. RLS Requirements

Every tenant-owned table must have RLS enabled.

Policies should ensure:
- authenticated users can access only tenants they belong to;
- users cannot inject another `tenant_id`;
- service/admin actions use server-side privileged access only where required;
- platform admin behavior is separate and explicit.

Tenant isolation must be covered by tests.

---

## 12. Data Model MVP Priority

Build first:
1. tenants
2. profiles
3. tenant_members
4. industry_templates
5. tenant_settings
6. lead_field_definitions
7. contacts
8. leads
9. opportunities
10. pipeline_definitions
11. appointments
12. followups
13. audit_logs

Then:
14. conversations
15. messages
16. lead_sources
17. campaigns
18. attribution_events
19. integrations
20. jobs
21. automation_events
22. revenue_events

Do not create all tables just because they are listed. Implement them according to the build phases.
