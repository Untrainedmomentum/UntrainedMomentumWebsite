-- Applied to Supabase project tamyxenqhgstjorvsiym on 2026-09-11.
-- Consolidates client/admin RLS policies and adds FK indexes identified by Supabase advisors.

create index if not exists account_entries_work_item_id_idx on public.account_entries(work_item_id) where work_item_id is not null;
create index if not exists customers_source_lead_id_idx on public.customers(source_lead_id) where source_lead_id is not null;
create index if not exists inventory_movements_customer_id_idx on public.inventory_movements(customer_id) where customer_id is not null;
create index if not exists inventory_movements_work_item_id_idx on public.inventory_movements(work_item_id) where work_item_id is not null;

drop policy if exists "Admins manage customers" on public.customers;
drop policy if exists "Clients read own customer record" on public.customers;
drop policy if exists "Authenticated users read authorized customers" on public.customers;
drop policy if exists "Admins insert customers" on public.customers;
drop policy if exists "Admins update customers" on public.customers;
drop policy if exists "Admins delete customers" on public.customers;
create policy "Authenticated users read authorized customers" on public.customers for select to authenticated
using ((select app_private.is_admin()) or portal_user_id = (select auth.uid()));
create policy "Admins insert customers" on public.customers for insert to authenticated
with check ((select app_private.is_admin()));
create policy "Admins update customers" on public.customers for update to authenticated
using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
create policy "Admins delete customers" on public.customers for delete to authenticated
using ((select app_private.is_admin()));

drop policy if exists "Admins manage account entries" on public.account_entries;
drop policy if exists "Clients read own account entries" on public.account_entries;
drop policy if exists "Authenticated users read authorized account entries" on public.account_entries;
drop policy if exists "Admins insert account entries" on public.account_entries;
drop policy if exists "Admins update account entries" on public.account_entries;
drop policy if exists "Admins delete account entries" on public.account_entries;
create policy "Authenticated users read authorized account entries" on public.account_entries for select to authenticated
using (
  (select app_private.is_admin())
  or (
    client_visible
    and customer_id in (select c.id from public.customers c where c.portal_user_id = (select auth.uid()))
  )
);
create policy "Admins insert account entries" on public.account_entries for insert to authenticated
with check ((select app_private.is_admin()));
create policy "Admins update account entries" on public.account_entries for update to authenticated
using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
create policy "Admins delete account entries" on public.account_entries for delete to authenticated
using ((select app_private.is_admin()));

drop policy if exists "Authenticated users insert authorized work" on public.work_items;
drop policy if exists "Authenticated users read authorized work" on public.work_items;
drop policy if exists "Clients read their visible work" on public.work_items;
drop policy if exists "Clients submit work requests" on public.work_items;
create policy "Authenticated users read authorized work" on public.work_items for select to authenticated
using (
  (select app_private.is_admin())
  or (
    client_visible
    and (
      requester_user_id = (select auth.uid())
      or customer_id in (select c.id from public.customers c where c.portal_user_id = (select auth.uid()))
      or site_id in (select s.id from public.sites s where s.owner_user_id = (select auth.uid()))
    )
  )
);
create policy "Authenticated users insert authorized work" on public.work_items for insert to authenticated
with check (
  (select app_private.is_admin())
  or (
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
  )
);
