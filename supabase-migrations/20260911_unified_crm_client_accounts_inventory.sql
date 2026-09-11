-- Applied to Supabase project tamyxenqhgstjorvsiym on 2026-09-11.
-- Adds owner CRM, client balances, completed-work metadata, and inventory tracking.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  contact_name text,
  email text,
  phone text,
  source text not null default 'manual',
  stage text not null default 'new' check (stage in ('new','contacted','follow_up','qualified','proposal','won','lost','nurture')),
  services_interest text,
  notes text,
  last_contact_at timestamptz,
  next_followup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_identity_check check (
    nullif(trim(coalesce(company_name,'')), '') is not null
    or nullif(trim(coalesce(contact_name,'')), '') is not null
    or nullif(trim(coalesce(email,'')), '') is not null
    or nullif(trim(coalesce(phone,'')), '') is not null
  )
);

create unique index leads_email_unique_idx on public.leads (lower(email)) where email is not null and trim(email) <> '';
create index leads_stage_followup_idx on public.leads(stage, next_followup_at);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  activity_type text not null check (activity_type in ('email','call','text','meeting','note','proposal','other')),
  direction text not null default 'outbound' check (direction in ('outbound','inbound','internal')),
  subject text,
  summary text,
  external_source text,
  external_id text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index lead_activities_external_unique_idx on public.lead_activities(external_source, external_id) where external_id is not null;
create index lead_activities_lead_date_idx on public.lead_activities(lead_id, occurred_at desc);

alter table public.customers add column if not exists source_lead_id uuid references public.leads(id) on delete set null;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists last_contact_at timestamptz;

alter table public.work_items add column if not exists completed_at timestamptz;
alter table public.work_items add column if not exists completion_summary text;

create table public.account_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  work_item_id uuid references public.work_items(id) on delete set null,
  entry_type text not null check (entry_type in ('charge','payment','credit','refund')),
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  balance_effect_cents integer generated always as (
    case when entry_type in ('charge','refund') then amount_cents else -amount_cents end
  ) stored,
  occurred_at timestamptz not null default now(),
  due_date date,
  reference text,
  client_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index account_entries_customer_date_idx on public.account_entries(customer_id, occurred_at desc);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null check (char_length(trim(name)) between 1 and 160),
  category text,
  description text,
  location text,
  reorder_level integer not null default 0 check (reorder_level >= 0),
  unit_cost_cents integer check (unit_cost_cents is null or unit_cost_cents >= 0),
  sale_price_cents integer check (sale_price_cents is null or sale_price_cents >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  movement_type text not null check (movement_type in ('purchase','use','sale','return','adjustment')),
  quantity_delta integer not null check (quantity_delta <> 0),
  unit_cost_cents integer check (unit_cost_cents is null or unit_cost_cents >= 0),
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index inventory_movements_item_date_idx on public.inventory_movements(inventory_item_id, occurred_at desc);

create trigger leads_set_updated_at before update on public.leads for each row execute function app_private.set_updated_at();
create trigger account_entries_set_updated_at before update on public.account_entries for each row execute function app_private.set_updated_at();
create trigger inventory_items_set_updated_at before update on public.inventory_items for each row execute function app_private.set_updated_at();

alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.account_entries enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on public.leads, public.lead_activities, public.account_entries, public.inventory_items, public.inventory_movements from anon, authenticated;
grant select, insert, update, delete on public.leads, public.lead_activities, public.account_entries, public.inventory_items, public.inventory_movements to authenticated;

create policy "Admins manage leads" on public.leads for all to authenticated
using ((select app_private.is_admin())) with check ((select app_private.is_admin()));

create policy "Admins manage lead activities" on public.lead_activities for all to authenticated
using ((select app_private.is_admin())) with check ((select app_private.is_admin()));

create policy "Admins manage account entries" on public.account_entries for all to authenticated
using ((select app_private.is_admin())) with check ((select app_private.is_admin()));

create policy "Clients read own account entries" on public.account_entries for select to authenticated
using (
  client_visible and customer_id in (
    select c.id from public.customers c where c.portal_user_id = (select auth.uid())
  )
);

create policy "Admins manage inventory" on public.inventory_items for all to authenticated
using ((select app_private.is_admin())) with check ((select app_private.is_admin()));

create policy "Admins manage inventory movements" on public.inventory_movements for all to authenticated
using ((select app_private.is_admin())) with check ((select app_private.is_admin()));

create policy "Clients read own customer record" on public.customers for select to authenticated
using (portal_user_id = (select auth.uid()));

drop policy if exists "Clients read their visible work" on public.work_items;
create policy "Clients read their visible work" on public.work_items for select to authenticated
using (
  client_visible and (
    requester_user_id = (select auth.uid())
    or customer_id in (select c.id from public.customers c where c.portal_user_id = (select auth.uid()))
    or site_id in (select s.id from public.sites s where s.owner_user_id = (select auth.uid()))
  )
);

drop policy if exists "Clients submit website requests" on public.work_items;
drop policy if exists "Clients submit work requests" on public.work_items;
create policy "Clients submit work requests" on public.work_items for insert to authenticated
with check (
  requester_user_id = (select auth.uid())
  and status = 'requested'
  and due_date is null
  and estimated_hours is null
  and billable_hours is null
  and hourly_rate_cents is null
  and fixed_amount_cents is null
  and invoice_url is null
  and completed_at is null
  and completion_summary is null
  and client_visible
  and (
    (customer_id is not null and customer_id in (select c.id from public.customers c where c.portal_user_id = (select auth.uid())))
    or (site_id is not null and site_id in (select s.id from public.sites s where s.owner_user_id = (select auth.uid())))
  )
);
