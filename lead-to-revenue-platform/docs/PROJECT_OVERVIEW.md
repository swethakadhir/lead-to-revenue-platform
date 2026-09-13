# PROJECT OVERVIEW

## 1. Product Name
Working name: **Lead-to-Revenue Platform**

## 2. Product Vision
Build one reusable, multi-tenant, configuration-driven platform that helps high-value businesses turn more enquiries into qualified sales opportunities and revenue.

The platform must remain structurally the same across industries such as:
- Dental clinics
- Salons / parlours
- Interior design firms
- Real estate
- Education / immigration consultancies
- Other appointment- or enquiry-driven businesses

Industry-specific behavior must come from templates and tenant configuration, not separate codebases.

## 3. Core Business Promise
The product supports the full journey:

**Lead generation → lead capture → instant response → qualification → appointment booking → reminders → follow-up → sales handoff → conversion tracking → revenue attribution → review / repeat**

The client is not buying individual tools such as a chatbot, CRM, n8n workflow, Dify workflow, or WhatsApp automation.

The client is buying:

> **More qualified sales opportunities and better lead-to-revenue conversion.**

## 4. What This Product Is
A reusable Lead-to-Revenue operating system that:
- captures leads from websites, ads, WhatsApp, Meta lead forms, and future channels;
- stores all important business state centrally;
- qualifies leads using deterministic logic and AI where useful;
- books appointments;
- automates follow-ups and reminders;
- hands qualified leads to sales staff;
- tracks opportunity progress;
- links leads back to campaign/source;
- tracks conversions and revenue;
- supports niche-specific templates without changing the application code.

## 5. What This Product Is Not
Do not turn the product into:
- a generic AI agency dashboard;
- a generic chatbot platform;
- a full CRM replacement;
- a full ERP;
- a social media management tool;
- a marketing agency operating system;
- a separate application for every industry;
- an autonomous AI agent that controls critical business actions without validation.

The platform may integrate with existing CRM, ERP, calendar, payment, ad, or communication systems instead of replacing them.

## 6. Product Strategy
The business should evolve in this order:

1. **Implementation service**
   - Start with a small number of clients.
   - Manually configure and support the system.
   - Learn real-world funnel problems.

2. **Productized service**
   - Reuse the same platform.
   - Reuse workflows and templates.
   - Reduce client-specific custom work.

3. **Niche specialization**
   - Focus on one high-value niche when market validation identifies the best option.
   - Improve templates and reports around that niche.

4. **Vertical SaaS / platform**
   - Turn repeated implementation patterns into standardized product features.
   - Introduce self-service onboarding and billing only when justified.

## 7. Core Architectural Principle
The product must be configuration-driven.

Correct approach:

**Core Platform → Industry Template → Tenant Configuration → Lead Fields → Qualification Rules → Pipeline → Automation Rules**

Incorrect approach:

```ts
if (industry === "dental") {
  // dental-only application logic
}
```

Industry differences must come from data/configuration.

## 8. Core User Types
Initial roles:
- **Platform Admin** — manages tenants and platform operations.
- **Tenant Owner / Admin** — manages one business.
- **Sales / Front Desk User** — works with leads, appointments, follow-ups, and opportunities.
- **Viewer / Manager** — views reports and pipeline.

More roles can be added later.

## 9. Core User Journey
Typical journey:

1. A lead submits an enquiry.
2. The lead is saved immediately.
3. The platform records source/campaign information.
4. The system sends an instant response.
5. Qualification questions are asked.
6. AI may interpret free-text answers.
7. The lead is scored.
8. Qualified leads are offered an appointment.
9. Staff are notified.
10. Reminders and follow-ups run automatically.
11. The lead becomes an opportunity.
12. Sales staff update the opportunity stage.
13. The opportunity is marked won/lost.
14. Revenue is linked back to source/campaign.
15. The dashboard reports conversion performance.

## 10. MVP Scope
The first useful product should include:
- authentication;
- tenant/business setup;
- tenant isolation;
- generic industry template support;
- lead management;
- lead detail;
- configurable lead fields;
- configurable pipeline stages;
- qualification;
- opportunities;
- appointments;
- follow-ups;
- basic conversations/messages;
- basic dashboard;
- settings;
- n8n integration hooks;
- Dify integration hooks;
- audit logging;
- event/job tracking.

The first version does **not** need:
- Voice AI;
- full CRM functionality;
- ERP functionality;
- mobile apps;
- advanced BI;
- dozens of integrations;
- microservices;
- Kubernetes;
- Kafka;
- custom vector databases;
- complex ad optimization.

## 11. First Success Criterion
The first real end-to-end success case is:

> **A new lead enters the platform, receives an instant response, gets qualified, books an appointment, is handed to a salesperson, and can later be marked won/lost with revenue tracked.**

## 12. Multi-Industry Test
Before considering the core platform architecture successful, the same codebase must support at least two different example tenants, such as:

- `SmileCare Dental`
- `Glow Salon`

Switching between these businesses must not require changing application logic. Only templates/configuration should differ.

## 13. Long-Term Product Direction
The long-term platform may include:
- WhatsApp and Meta channel integrations;
- Google/Meta lead-source integrations;
- CRM integrations;
- RAG knowledge answering;
- voice AI;
- lead reactivation;
- review requests;
- revenue attribution;
- marketing performance reporting;
- niche-specific automation libraries;
- self-service onboarding;
- billing and usage metering.

These should be added only after real usage justifies them.
