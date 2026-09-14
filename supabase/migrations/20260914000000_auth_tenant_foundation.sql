create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 63),
  timezone text not null check (char_length(btrim(timezone)) between 1 and 100),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'active' check (status in ('active', 'trial', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'sales', 'front_desk', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended', 'removed')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index tenant_members_user_status_idx on public.tenant_members (user_id, status);
create index tenant_members_tenant_status_idx on public.tenant_members (tenant_id, status);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function private.set_updated_at();

-- The auth trigger is the source of profile provisioning. It runs in the same
-- transaction as auth.users creation, so a failed profile insert cannot leave a
-- partially provisioned auth user. The backfill covers users created earlier.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, full_name, email, created_at, updated_at)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', ''),
  coalesce(email, ''),
  created_at,
  updated_at
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

-- SECURITY DEFINER avoids recursive tenant_members RLS evaluation. The helper
-- returns only active memberships for the authenticated JWT subject.
create function private.user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tenant_id
  from public.tenant_members
  where user_id = auth.uid()
    and status = 'active';
$$;

revoke all on function private.user_tenant_ids() from public;
grant usage on schema private to authenticated;
grant execute on function private.user_tenant_ids() to authenticated;

create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy tenants_select_for_members
on public.tenants for select
to authenticated
using (id in (select private.user_tenant_ids()));

create policy tenant_members_select_for_members
on public.tenant_members for select
to authenticated
using (tenant_id in (select private.user_tenant_ids()));

revoke all on public.profiles, public.tenants, public.tenant_members from anon, authenticated;
grant select on public.profiles, public.tenants, public.tenant_members to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- This RPC is intentionally executable only by service_role. The Next.js
-- Server Action derives p_creator_user_id from a verified session and never
-- accepts a role or owner id from the form. PostgreSQL executes both inserts in
-- one transaction, so membership failure rolls back tenant creation.
create function public.create_tenant_with_owner(
  p_creator_user_id uuid,
  p_name text,
  p_slug text,
  p_timezone text,
  p_currency text
)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_tenant public.tenants;
begin
  if not exists (select 1 from auth.users where id = p_creator_user_id) then
    raise exception 'Creator must be an authenticated user' using errcode = '23503';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = btrim(p_timezone)) then
    raise exception 'Invalid IANA timezone' using errcode = '22023';
  end if;

  insert into public.tenants (name, slug, timezone, currency)
  values (btrim(p_name), lower(btrim(p_slug)), btrim(p_timezone), upper(btrim(p_currency)))
  returning * into new_tenant;

  insert into public.tenant_members (tenant_id, user_id, role, status)
  values (new_tenant.id, p_creator_user_id, 'owner', 'active');

  return new_tenant;
end;
$$;

revoke all on function public.create_tenant_with_owner(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_tenant_with_owner(uuid, text, text, text, text) to service_role;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
