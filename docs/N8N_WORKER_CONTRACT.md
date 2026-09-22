# n8n Worker Contract

Supabase remembers. n8n executes. Dify understands.

Configure n8n with `AUTOMATION_WORKER_SECRET` as an HTTP header named `x-automation-worker-secret`; never use a Supabase service-role key. For local Docker n8n with Next.js on Windows, use `http://host.docker.internal:3000` as the application base URL.

## Reconciliation workflow

Schedule Trigger (and the first scheduled run after startup) → `GET /api/internal/automation/health` → `POST /api/internal/automation/jobs/claim` with `{ "limit": 10 }` → stop when `jobs` is empty → loop jobs → Switch on the allowlisted type (`internal_notification`, `lead_follow_up`, `appointment_reminder`) → execute → `POST /api/internal/automation/jobs/{id}/complete`.

Completion payload: `{ "success": true }` or `{ "success": false, "retryable": true, "errorCategory": "safe_category", "errorMessage": "safe message" }`.

Run repeatedly until no jobs remain or a safe run limit is reached. Jobs due while n8n is offline stay in Supabase and are claimed after restart. A processing claim leases for ten minutes; expired leases become recoverable. External exact-once delivery still requires provider-side idempotency using each returned `idempotencyKey`.
