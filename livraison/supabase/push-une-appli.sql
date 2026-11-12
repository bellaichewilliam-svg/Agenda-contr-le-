-- Une notification = une seule appli (patron, 12/11 : « je reçois en 3 ») : chaque appli dit qui elle est ;
-- le patron reçoit ses alertes sur HOP! Patron, un livreur sur HOP! Livreur. Les abonnements des autres applis du même
-- compte sont mis de côté dans push_subs_off (rien n'est perdu : ils reviennent si l'appli redevient la bonne).
alter table public.push_subs add column if not exists app text check (app in ('admin', 'courier', 'client'));
create table if not exists public.push_subs_off (
  endpoint text primary key, courier_id uuid not null, p256dh text not null, auth text not null, app text, moved_at timestamptz not null default now());
alter table public.push_subs_off enable row level security;
revoke all on public.push_subs_off from anon, authenticated;

create or replace function public.push_subscribe_app(p_endpoint text, p_p256dh text, p_auth text, p_app text) returns boolean
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); role_ text; good text; app_ text := case when p_app in ('admin', 'courier', 'client') then p_app else 'client' end;
begin
  select role into role_ from couriers where id = me;
  if me is null or role_ is null then return false; end if;
  good := case when role_ = 'admin' then 'admin' else 'courier' end;
  if app_ = good then
    insert into push_subs (endpoint, courier_id, p256dh, auth, app) values (p_endpoint, me, p_p256dh, p_auth, app_)
    on conflict (endpoint) do update set courier_id = excluded.courier_id, p256dh = excluded.p256dh, auth = excluded.auth, app = excluded.app;
    delete from push_subs_off where endpoint = p_endpoint;
    insert into push_subs_off (endpoint, courier_id, p256dh, auth, app)
      select endpoint, courier_id, p256dh, auth, app from push_subs where courier_id = me and app is not null and app <> good
    on conflict (endpoint) do update set moved_at = now();
    delete from push_subs where courier_id = me and app is not null and app <> good;
  else
    if exists (select 1 from push_subs where courier_id = me and app = good and endpoint <> p_endpoint) then
      insert into push_subs_off (endpoint, courier_id, p256dh, auth, app) values (p_endpoint, me, p_p256dh, p_auth, app_)
      on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, app = excluded.app, moved_at = now();
      delete from push_subs where endpoint = p_endpoint;
    else
      insert into push_subs (endpoint, courier_id, p256dh, auth, app) values (p_endpoint, me, p_p256dh, p_auth, app_)
      on conflict (endpoint) do update set courier_id = excluded.courier_id, p256dh = excluded.p256dh, auth = excluded.auth, app = excluded.app;
    end if;
  end if;
  return true;
end $$;
revoke all on function public.push_subscribe_app(text, text, text, text) from public, anon;
grant execute on function public.push_subscribe_app(text, text, text, text) to authenticated;
