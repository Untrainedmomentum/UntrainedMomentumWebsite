-- Defense in depth for invitation records used only by the auth trigger.
alter table app_private.client_invites enable row level security;
revoke all on app_private.client_invites from public, anon, authenticated;

create policy "No direct client invite access"
on app_private.client_invites
for all
to authenticated
using (false)
with check (false);
