-- Server-only Dify credentials stay in deployment environment variables. This table only holds
-- non-secret, tenant-scoped routing configuration for the shared Dify workflow.
create table public.tenant_ai_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  enabled boolean not null default false,
  provider text not null default 'dify' check (provider in ('dify')),
  knowledge_scope text not null check (char_length(btrim(knowledge_scope)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tenant_ai_configs_enabled_idx on public.tenant_ai_configs(tenant_id, enabled);
create trigger tenant_ai_configs_set_updated_at before update on public.tenant_ai_configs for each row execute function private.set_updated_at();

alter table public.tenant_ai_configs enable row level security;
create policy platform_operators_read_tenant_ai_configs on public.tenant_ai_configs for select to authenticated using (private.is_platform_operator());
create policy platform_operators_manage_tenant_ai_configs on public.tenant_ai_configs for all to authenticated using (private.is_platform_operator()) with check (private.is_platform_operator());
revoke all on public.tenant_ai_configs from anon, authenticated;
grant select, insert, update, delete on public.tenant_ai_configs to authenticated;

-- Operators can inspect routing metadata attached to messages; end customers never query this table.
-- AI output remains validated by Next.js before any lead/conversation mutation.
