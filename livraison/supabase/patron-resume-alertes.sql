-- 15/11 (patron) : 7. résumé de la journée chaque soir sur son téléphone ; 8. alerte quand plusieurs clients bloquent au même
-- endroit de la commande (ou sur le micro). Notifications envoyées aux comptes « admin » par la fonction déjà en ligne.
create table if not exists public.boss_alerts (key text primary key, at timestamptz not null default now());
alter table public.boss_alerts enable row level security;

create or replace function public.boss_push(p_title text, p_body text, p_tag text) returns void
language plpgsql security definer set search_path = public as $function$
declare c record;
begin
  for c in select id from couriers where role = 'admin' loop
    begin
      perform public.push_call(jsonb_build_object('courier_id', c.id, 'title', left(p_title, 120), 'body', left(p_body, 600), 'tag', p_tag));
    exception when others then null;
    end;
  end loop;
end;
$function$;
revoke all on function public.boss_push(text, text, text) from public, anon, authenticated;

create or replace function public.boss_daily_summary() returns text
language plpgsql security definer set search_path = public as $function$
declare d0 timestamptz := date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
  n_all int; n_ok int; n_ko int; n_run int; ca numeric; vis int; st int; sent int; blk text; body text;
begin
  select count(*), count(*) filter (where status = 'livree'), count(*) filter (where status in ('annulee', 'refusee')),
         count(*) filter (where status in ('nouvelle', 'confirmee', 'recuperee')), coalesce(sum(price) filter (where status = 'livree'), 0)
    into n_all, n_ok, n_ko, n_run, ca
    from orders o where created_at >= d0 and not coalesce((to_jsonb(o)->>'is_test')::boolean, false);
  select count(distinct session) filter (where kind = 'view'), count(distinct session) filter (where kind = 'order_start'),
         count(distinct session) filter (where kind = 'order_sent')
    into vis, st, sent from site_all where created_at >= d0 and visitor not in (select visitor from staff_visitors);
  select page || ' (' || count(distinct session) || ')' into blk from site_all
   where created_at >= d0 and kind = 'order_block' and visitor not in (select visitor from staff_visitors)
   group by page order by count(distinct session) desc limit 1;
  body := n_all || ' commande' || case when n_all > 1 then 's' else '' end || ' · ' || n_ok || ' livrée' || case when n_ok > 1 then 's' else '' end
    || case when n_run > 0 then ' · ' || n_run || ' en cours' else '' end || case when n_ko > 0 then ' · ' || n_ko || ' annulée' || case when n_ko > 1 then 's' else '' end else '' end
    || E'\n💰 Livraisons : ' || round(ca) || ' ₪'
    || E'\n👀 ' || vis || ' visite' || case when vis > 1 then 's' else '' end || ' · ' || st || ' commande' || case when st > 1 then 's' else '' end || ' commencée' || case when st > 1 then 's' else '' end
    || ' · ' || sent || ' envoyée' || case when sent > 1 then 's' else '' end
    || case when st > sent then E'\n🛒 ' || (st - sent) || ' client' || case when st - sent > 1 then 's' else '' end || ' parti' || case when st - sent > 1 then 's' else '' end || ' avant la fin' else '' end
    || case when blk is not null then E'\n⚠️ Blocage le plus fréquent : ' || blk else '' end;
  perform public.boss_push('📊 HOP! · votre journée', body, 'hop-jour');
  return body;
end;
$function$;
revoke all on function public.boss_daily_summary() from public, anon, authenticated;

create or replace function public.boss_block_alert() returns void
language plpgsql security definer set search_path = public as $function$
declare r record; lbl text;
begin
  for r in select case when kind = 'voice_mic' then 'micro' else page end as what, count(distinct session) n
             from site_all
            where created_at > now() - interval '30 minutes' and visitor not in (select visitor from staff_visitors)
              and (kind = 'order_block' or (kind = 'voice_mic' and page like 'err:%'))
            group by 1 having count(distinct session) >= 3
  loop
    if exists (select 1 from boss_alerts where key = 'block:' || r.what and at > now() - interval '3 hours') then continue; end if;
    insert into boss_alerts (key, at) values ('block:' || r.what, now()) on conflict (key) do update set at = now();
    lbl := case when r.what = 'micro' then 'le micro de Hoppy'
                when r.what ~* 'address|number' then 'l''adresse'
                when r.what ~* 'phone' then 'le téléphone'
                when r.what ~* 'contact_name' then 'le prénom'
                when r.what ~* 'adult' then 'la case 18 ans'
                when r.what ~* 'kind|floor|apt|code|sum-' then 'la porte (type de lieu, étage, code)'
                when r.what ~* 'ready' then 'l''heure où la commande sera prête'
                when r.what ~* 'what_item' then '« ce qu''on transporte »'
                else r.what end;
    perform public.boss_push('⚠️ Des clients bloquent', r.n || ' clients ont bloqué en 30 min sur : ' || lbl || E'\nOuvrez le panneau → Statistiques pour le détail.', 'hop-bloc');
  end loop;
end;
$function$;
revoke all on function public.boss_block_alert() from public, anon, authenticated;

select cron.schedule('hop-resume-soir', '30 19 * * *', 'select public.boss_daily_summary()');
select cron.schedule('hop-alerte-blocage', '*/10 * * * *', 'select public.boss_block_alert()');
