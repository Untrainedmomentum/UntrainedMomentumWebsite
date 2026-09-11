-- Customer and work tracking for the existing Untrained Momentum client portal.
-- Sales/prospect tracking remains in the separate CRM repository.

create table if not exists app_private.admin_invites (
  email text primary key,
  full_name text,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table app_private.admin_invites enable row level security;
revoke all on app_private.admin_invites from anon, authenticated;

insert into app_private.admin_invites (email, full_name)
values ('jen.brynelsen@untrainedmomentum.com', 'Jennifer Brynelsen')
on conflict (email) do update set full_name = excluded.full_name;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  inv app_private.client_invites%rowtype;
  admin_inv app_private.admin_invites%rowtype;
  display_name text;
begin
  select * into admin_inv
  from app_private.admin_invites
  where lower(email) = lower(coalesce(new.email, ''))
    and claimed_at is null
  limit 1;

  if admin_inv.email is null then
    select * into inv
    from app_private.client_invites
    where lower(email) = lower(coalesce(new.email, ''))
      and claimed_at is null
    limit 1;
  end if;

  display_name := coalesce(
    admin_inv.full_name,
    inv.full_name,
    new.raw_user_meta_data->>'full_name',
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.profiles (id, email, full_name, role, disabled)
  values (
    new.id,
    coalesce(new.email, ''),
    display_name,
    case when admin_inv.email is not null then 'admin' else 'client' end,
    admin_inv.email is null and inv.id is null
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    disabled = excluded.disabled,
    updated_at = now();

  if admin_inv.email is not null then
    update app_private.admin_invites
    set claimed_by = new.id, claimed_at = now()
    where email = admin_inv.email;
  elsif inv.id is not null then
    insert into public.sites (
      owner_user_id, slug, name, site_type, site_url, custom_domain,
      content, builder_enabled, platform_fee_bps, status
    ) values (
      new.id, inv.site_slug, inv.site_name, inv.site_type, inv.site_url, inv.custom_domain,
      inv.content, inv.builder_enabled, inv.platform_fee_bps, 'active'
    ) on conflict (slug) do update set
      owner_user_id = excluded.owner_user_id,
      name = excluded.name,
      site_type = excluded.site_type,
      site_url = excluded.site_url,
      custom_domain = excluded.custom_domain,
      content = excluded.content,
      builder_enabled = excluded.builder_enabled,
      platform_fee_bps = excluded.platform_fee_bps,
      status = 'active',
      updated_at = now();

    update app_private.client_invites
    set claimed_by = new.id, claimed_at = now()
    where id = inv.id;
  end if;
  return new;
end;
$function$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  portal_user_id uuid unique references public.profiles(id) on delete set null,
  company_name text not null check (char_length(trim(company_name)) between 1 and 160),
  contact_name text,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active', 'paused', 'former')),
  services text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  requester_user_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text not null default '',
  category text not null default 'website' check (category in ('website', 'tech_support', 'content', 'maintenance', 'other')),
  status text not null default 'requested' check (status in ('requested', 'scheduled', 'in_progress', 'waiting_client', 'complete', 'invoiced', 'paid', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_date date,
  estimated_hours numeric(8,2) check (estimated_hours is null or estimated_hours >= 0),
  billable_hours numeric(8,2) check (billable_hours is null or billable_hours >= 0),
  hourly_rate_cents integer check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  fixed_amount_cents integer check (fixed_amount_cents is null or fixed_amount_cents >= 0),
  invoice_url text,
  client_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index work_items_customer_id_idx on public.work_items(customer_id);
create index work_items_site_id_idx on public.work_items(site_id);
create index work_items_requester_user_id_idx on public.work_items(requester_user_id);
create index work_items_status_due_date_idx on public.work_items(status, due_date);

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create trigger customers_set_updated_at
before update on public.customers
for each row execute function app_private.set_updated_at();

create trigger work_items_set_updated_at
before update on public.work_items
for each row execute function app_private.set_updated_at();

alter table public.customers enable row level security;
alter table public.work_items enable row level security;

revoke all on public.customers from anon, authenticated;
revoke all on public.work_items from anon, authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.work_items to authenticated;

create policy "Admins manage customers"
on public.customers
for all
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

create policy "Admins manage work items"
on public.work_items
for all
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

create policy "Clients read their visible work"
on public.work_items
for select
to authenticated
using (
  client_visible
  and (
    requester_user_id = (select auth.uid())
    or exists (
      select 1 from public.sites s
      where s.id = work_items.site_id
        and s.owner_user_id = (select auth.uid())
    )
  )
);

create policy "Clients submit website requests"
on public.work_items
for insert
to authenticated
with check (
  requester_user_id = (select auth.uid())
  and customer_id is null
  and status = 'requested'
  and due_date is null
  and estimated_hours is null
  and billable_hours is null
  and hourly_rate_cents is null
  and fixed_amount_cents is null
  and invoice_url is null
  and client_visible
  and exists (
    select 1 from public.sites s
    where s.id = work_items.site_id
      and s.owner_user_id = (select auth.uid())
  )
);

