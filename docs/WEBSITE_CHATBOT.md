# Website chatbot and predefined conversation engine

Phase 5 is a managed, setup-first website chatbot product. It is not a self-service technical chatbot builder.

## Who uses what

The platform implementation team sets up the industry template, deterministic conversation flow, lead fields, content, and website installation. Owner/admin client users can operate the business and make simple content changes. Their customers use the floating chatbot on the client website.

Client users work in the operational application: Dashboard, Leads, Conversations, Pipeline, Appointments, Follow-ups, and Settings. The Conversations inbox shows normal customer/assistant transcripts, contact information when known, lead association, status, and activity time. It never exposes message JSON or graph internals.

## Client settings

`/app/settings/chatbot` contains business-friendly controls only: assistant display name, welcome/fallback/confirmation messages, colour, button position, visitor detail capture, enabled state, publishing state, and a clear **Preview chatbot** action. Owners and admins may also enter explicitly named **Advanced setup** and **Install on website** pages; sales, front desk, and viewer roles cannot access that setup surface.

Advanced setup preserves the deterministic flow editor without making node keys, database names, or routing IDs part of ordinary client work. A future explicit platform-admin role can separate our implementation team further without changing tenant security.

## Customer-facing widget and embed

The public website widget is an iframe rendered by Next.js at `/chatbot/widget?widget=<public-widget-id>`. It provides a floating responsive launcher, configurable bottom-left/right position, minimize/restart controls, option buttons, free-text input, and a normal chat panel. The authenticated preview simulates a client website and uses the exact same `ChatWidget` renderer and deterministic conversation engine as the public iframe.

The implementation team or client web developer can copy the iframe from **Install on website** and paste it before the client website's closing `</body>` tag. The identifier is public and is not a credential. Iframe isolation keeps host-site styles and scripts separate from the widget.

## Publishing and security

Draft chatbots are previewable only through the authenticated tenant route. The public route resolves only a published and enabled configuration by its public widget ID. Disabled or draft widgets return no tenant detail. Browsers never access Supabase directly and never receive service credentials; the server validates each graph transition and writes conversations server-side. Existing RLS confines authenticated operational reads to tenant membership.

`conversations` and `conversation_messages` are channel-neutral. Phase 5 uses `website`; future WhatsApp, Instagram, and Facebook adapters can normalize into the same model. When a configured capture flow completes, the server reuses or creates a contact, creates the standard lead with permitted dynamic `lead_data`, and links the conversation. Lead detail shows **Website chatbot** and links back to the transcript.

## Deliberate Phase 5 boundary

Unknown free text is persisted and returns the configured fallback. It makes no Dify, RAG, LLM, n8n, calendar, or external-channel call. Future work may place a query/intent router between deterministic handling and responses: predefined → database/business logic → Dify/RAG → AI, followed by a separately controlled action engine/n8n path. Public-launch rate limiting remains an edge/deployment responsibility; the current endpoint uses strict request validation.

## Managed journey correction

The chatbot is the first end-customer channel in a managed service, not a client-run CRM feature. Free text at a normal menu records the fallback and preserves the current menu state. Input is treated as a name, phone, email, or configured answer only when the conversation is explicitly at that capture node. Preview uses an isolated preview session but the same widget and engine as the public embed.

Platform operators, rather than tenant members, own cross-client setup and intervention work. They can explicitly replace a tenant chatbot with the tenant-selected template starter flow after a destructive confirmation; applying a template alone never overwrites an existing chatbot. A future query router may add tenant-scoped Dify/RAG responses and later n8n actions without replacing the channel-neutral conversation state.
