# PRODUCT REQUIREMENTS

## 1. Objective
Build a reusable, multi-tenant Lead-to-Revenue application that works across multiple industries without changing the codebase.

The first product should help a business:
- receive leads;
- understand/qualify them;
- move them through a pipeline;
- book appointments;
- follow up;
- hand them to staff;
- mark outcomes;
- measure conversions.

Industry differences must be controlled by templates and settings.

---

## 2. MVP Product Areas

### A. Authentication
Users must be able to:
- sign in;
- sign out;
- access only businesses they belong to.

Initial authentication can use Supabase Auth.

---

### B. Tenant / Business Setup
A tenant admin must be able to:
- create or access a business;
- set business name;
- set timezone;
- set currency;
- select an industry template;
- configure basic business details;
- configure business hours.

---

### C. Industry Templates
The system must support reusable templates.

Each template may define:
- lead fields;
- labels;
- qualification fields;
- default pipeline stages;
- appointment types;
- optional automations;
- default AI qualification schema.

Required initial example templates:
- Dental
- Salon / Parlour
- Interior Design

These are examples for testing architecture, not separate applications.

---

### D. Leads
Users must be able to:
- view lead list;
- create lead manually;
- open lead detail;
- edit basic information;
- assign a lead to a user;
- set lead status;
- view lead source;
- view qualification score;
- see dynamic niche-specific fields;
- set next follow-up;
- create opportunity;
- mark disqualified/dormant where needed.

Lead list filters should include:
- status;
- assignee;
- source;
- qualification;
- date range.

---

### E. Lead Detail Screen
The lead detail page should show:
- contact information;
- source/campaign;
- qualification score/status;
- dynamic lead fields;
- current pipeline stage;
- assigned person;
- next follow-up;
- appointments;
- notes/activity;
- conversation summary or messages when available;
- opportunity information.

---

### F. Pipeline
Provide a generic visual pipeline.

Default stages:
- New
- Contacted
- Engaged
- Qualifying
- Qualified
- Appointment Booked
- Appointment Completed
- Proposal
- Won
- Lost
- Dormant

Requirements:
- stages are configurable per tenant;
- users can move opportunities/leads between stages;
- important changes are logged;
- terminal stages are explicit.

Do not hard-code niche-specific stage behavior.

---

### G. Opportunities
Users must be able to:
- create an opportunity from a lead;
- assign estimated value;
- assign sales owner;
- change stage;
- set expected close date;
- mark won;
- mark lost;
- provide lost reason;
- record final revenue.

---

### H. Appointments
Users must be able to:
- create appointment;
- link appointment to contact/lead/opportunity;
- assign staff;
- set date/time;
- reschedule;
- cancel;
- mark completed;
- mark no-show.

Future integrations can sync external calendars.

---

### I. Follow-Ups
Users must be able to:
- create manual follow-up;
- set due date/time;
- choose channel;
- mark complete;
- cancel;
- see overdue follow-ups.

Later, n8n can create and execute automated follow-ups.

---

### J. Dashboard
The MVP dashboard should focus on business outcomes.

Primary metrics:
- new leads;
- contacted leads;
- qualified leads;
- appointments booked;
- appointments completed;
- opportunities;
- won;
- lost;
- revenue recorded.

Later add:
- campaign/source performance;
- cost per lead;
- cost per qualified lead;
- cost per appointment;
- conversion rates;
- attributed revenue;
- ROAS.

Avoid making AI usage the main customer-facing dashboard.

---

### K. Settings
Tenant settings should support:
- business information;
- industry template;
- lead fields;
- pipeline stages;
- user management;
- qualification settings;
- integration placeholders;
- automation settings later.

---

## 3. AI Requirements

Initial Dify use cases:
1. Lead qualification.
2. Intent classification.
3. Conversation summarization.
4. RAG / knowledge answering later.

AI output should be structured whenever possible.

Example:

```json
{
  "qualified": true,
  "score": 84,
  "intent": "appointment",
  "extracted_fields": {
    "service": "Dental Implant",
    "preferred_date": "2026-10-10"
  }
}
```

The application validates output before changing important business state.

---

## 4. Automation Requirements

Initial n8n use cases:
- notify staff about new lead;
- send WhatsApp message later;
- send follow-up;
- create calendar action later;
- send appointment reminders;
- sync external systems later.

All workflow results must be written back to the application/Supabase.

---

## 5. Initial Application Pages

Recommended initial route structure:

```text
/login

/dashboard

/leads
/leads/[id]

/pipeline

/appointments

/followups

/settings
/settings/business
/settings/team
/settings/template
/settings/pipeline
/settings/integrations
```

Possible later routes:

```text
/conversations
/campaigns
/reports
/automations
/admin
```

---

## 6. Navigation
Initial sidebar:
- Dashboard
- Leads
- Pipeline
- Appointments
- Follow-ups
- Settings

Later:
- Conversations
- Campaigns
- Reports
- Automations

Keep the MVP navigation simple.

---

## 7. Template Behavior Requirement

Changing the industry template must not require code changes.

Example:

### Dental
Fields may include:
- treatment;
- issue/pain;
- preferred date;
- location.

### Salon
Fields may include:
- service;
- preferred stylist;
- branch;
- preferred appointment time.

### Interior Design
Fields may include:
- property type;
- location;
- budget;
- possession date;
- project scope.

The same lead-detail UI must render each configuration dynamically.

---

## 8. UX Requirements
- responsive web application;
- desktop-first but usable on mobile;
- clear status labels;
- low-clutter dashboard;
- fast lead search;
- easy next-action visibility;
- avoid unnecessary AI branding;
- business outcomes should be more prominent than technical metrics.

The app should feel like an operational sales tool, not an AI demo.

---

## 9. Security Requirements
- tenant data isolation;
- Supabase RLS;
- server-side authorization;
- no secrets in frontend;
- audit important changes;
- authenticated routes;
- safe input validation;
- secure webhook validation later.

---

## 10. Non-Functional Requirements
- TypeScript strict mode where practical;
- consistent validation;
- clear error states;
- loading states;
- reusable UI components;
- no duplicate business logic;
- modular integration adapters;
- database migrations in source control;
- basic tests for tenant isolation and critical workflows.

---

## 11. MVP Acceptance Criteria

The MVP passes when:

1. User can log in.
2. User belongs to one tenant.
3. User cannot access another tenant's data.
4. Tenant can select a template.
5. Lead form changes based on template configuration.
6. User can create/edit/view leads.
7. User can move a lead/opportunity through pipeline.
8. User can create an appointment.
9. User can create a follow-up.
10. User can mark an opportunity won/lost.
11. Dashboard reflects key counts.
12. Two example businesses from different industries work without code changes.

Example validation:
- SmileCare Dental
- Glow Salon

---

## 12. First Integration Acceptance Criteria

After core MVP works:

### n8n
- application can trigger one n8n workflow;
- workflow result is recorded;
- failures are visible.

### Dify
- application can send lead text;
- Dify returns structured qualification;
- result is validated and stored.

### WhatsApp
Later:
- inbound/outbound message IDs are stored;
- duplicate webhooks are ignored;
- messages are linked to correct contact/conversation;
- delivery failures do not corrupt lead state.

---

## 13. Explicitly Out of Scope for First MVP
- voice AI;
- billing system;
- complex subscription plans;
- self-service tenant signup;
- full CRM replacement;
- full marketing campaign builder;
- ad buying;
- ERP;
- mobile apps;
- advanced BI;
- custom workflow builder;
- marketplace;
- dozens of integrations;
- multi-language AI unless required by first real pilot.

---

## 14. Product Success Logic
The system should make it possible to answer:

- How many leads entered?
- How many were contacted?
- How many qualified?
- How many booked?
- How many attended?
- How many became opportunities?
- How many were won?
- What revenue resulted?
- Where did the best leads come from?

That is the core Lead-to-Revenue promise.
