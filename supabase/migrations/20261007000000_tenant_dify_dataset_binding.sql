-- The dataset reference is recorded by platform operators after external Dify setup.
-- It is not a browser-controlled routing hint or a secret.
alter table public.tenant_ai_configs
  add column dify_dataset_id text,
  add column knowledge_binding_status text not null default 'unavailable';

alter table public.tenant_ai_configs
  add constraint tenant_ai_configs_dataset_reference_check
    check (dify_dataset_id is null or char_length(btrim(dify_dataset_id)) between 1 and 200),
  add constraint tenant_ai_configs_binding_status_check
    check (knowledge_binding_status in ('active', 'inactive', 'invalid', 'unavailable')),
  add constraint tenant_ai_configs_active_binding_check
    check (knowledge_binding_status <> 'active' or dify_dataset_id is not null);

comment on column public.tenant_ai_configs.knowledge_scope is 'Optional Dify routing/prompt hint; never the retrieval isolation boundary.';
comment on column public.tenant_ai_configs.dify_dataset_id is 'Trusted primary Dify dataset reference for this tenant, recorded by platform operators.';
comment on column public.tenant_ai_configs.knowledge_binding_status is 'Whether the externally managed Dify dataset binding is usable.';
