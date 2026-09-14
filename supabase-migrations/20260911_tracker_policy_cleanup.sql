create index admin_invites_claimed_by_idx on app_private.admin_invites(claimed_by);

create policy "No direct admin invite access"
on app_private.admin_invites
for all
to authenticated
using (false)
with check (false);

drop policy "Admins manage work items" on public.work_items;
drop policy "Clients read their visible work" on public.work_items;
drop policy "Clients submit website requests" on public.work_items;

create policy "Authenticated users read authorized work"
on public.work_items
for select
to authenticated
using (
  (select app_private.is_admin())
  or (
    client_visible
    and (
      requester_user_id = (select auth.uid())
      or exists (
        select 1 from public.sites s
        where s.id = work_items.site_id
          and s.owner_user_id = (select auth.uid())
      )
    )
  )
);

create policy "Authenticated users insert authorized work"
on public.work_items
for insert
to authenticated
with check (
  (select app_private.is_admin())
  or (
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
  )
);

create policy "Admins update work"
on public.work_items
for update
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

create policy "Admins delete work"
on public.work_items
for delete
to authenticated
using ((select app_private.is_admin()));
