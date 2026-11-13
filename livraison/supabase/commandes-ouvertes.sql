-- ============================================================================
-- Commandes ouvertes (demande du patron du 07/11/2026 : « il y en a eu 5, je les vois pas »)
-- 1. Réparation : depuis le 02/11, les étapes de commande (1er article, écran 2, écran 3, « Continuer » refusé)
--    n'étaient jamais enregistrées : la table site_events n'accepte que view / order_start / order_sent / shop_view
--    (contrainte d'origine). Sans rien supprimer, ces étapes vont maintenant dans une table à part, site_steps,
--    et les chiffres du patron lisent les deux (vue site_all, fermée au public).
-- 2. admin_analytics renvoie aussi « opened » : chaque commande ouverte et pas envoyée (heure, d'où vient le client,
--    commerces regardés, jusqu'où il est allé, ce qui l'a bloqué, déjà venu / déjà client), pour l'onglet 📊 du patron.
--    Sans nom ni téléphone : le client n'a encore rien envoyé.
-- Uniquement create / create or replace / if not exists : rien n'est supprimé.
-- ============================================================================
create table if not exists public.site_steps (like public.site_events including defaults including identity);
create index if not exists site_steps_at on public.site_steps (created_at);
create index if not exists site_steps_session on public.site_steps (session, created_at);
alter table public.site_steps enable row level security;

create or replace view public.site_all as
  select * from public.site_events union all select * from public.site_steps;
revoke all on public.site_all from anon, authenticated;

create or replace function public.site_track(p jsonb) returns void
language plpgsql security definer set search_path = public as $function$
declare s text := left(coalesce(p->>'session', ''), 40); k text := p->>'kind';
begin
  if length(s) < 8 or length(coalesce(p->>'visitor', '')) < 8
     or k not in ('view', 'order_start', 'order_sent', 'shop_view', 'cart_add', 'order_step_2', 'order_step_3', 'order_block') then return; end if;
  if (select count(*) from site_all where session = s and created_at > now() - interval '1 hour') >= 200 then return; end if;
  if k in ('view', 'order_start', 'order_sent', 'shop_view') then
    insert into site_events (visitor, session, kind, page, source, medium, campaign, first_source, ref_host, device, lang, app, shop_code, order_ref, amount)
    values (left(p->>'visitor', 40), s, k, left(p->>'page', 40), left(lower(p->>'source'), 60), left(lower(p->>'medium'), 40), left(p->>'campaign', 60),
            left(lower(p->>'first_source'), 60), left(lower(p->>'ref_host'), 80), left(p->>'device', 12), left(p->>'lang', 4),
            coalesce((p->>'app')::boolean, false), left(upper(p->>'shop_code'), 30), left(p->>'order_ref', 30),
            case when (p->>'amount') ~ '^[0-9]+(\.[0-9]+)?$' then least((p->>'amount')::numeric, 100000) end);
  else
    insert into site_steps (visitor, session, kind, page, source, medium, campaign, first_source, ref_host, device, lang, app, shop_code, order_ref, amount)
    values (left(p->>'visitor', 40), s, k, left(p->>'page', 40), left(lower(p->>'source'), 60), left(lower(p->>'medium'), 40), left(p->>'campaign', 60),
            left(lower(p->>'first_source'), 60), left(lower(p->>'ref_host'), 80), left(p->>'device', 12), left(p->>'lang', 4),
            coalesce((p->>'app')::boolean, false), left(upper(p->>'shop_code'), 30), left(p->>'order_ref', 30), null);
  end if;
end;
$function$;

create or replace function public.admin_funnel(p_days integer) returns json
language plpgsql stable security definer set search_path = public as $function$
declare since timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  since := case when coalesce(p_days, 7) <= 1 then date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
                else now() - make_interval(days => least(greatest(p_days, 1), 365)) end;
  return (with e as (select * from site_all where created_at >= since and visitor not in (select visitor from staff_visitors))
    select json_build_object(
      'visits', (select count(distinct session) from e where kind = 'view'),
      'started', (select count(distinct session) from e where kind = 'order_start'),
      'cart', (select count(distinct session) from e where kind = 'cart_add'),
      'step2', (select count(distinct session) from e where kind = 'order_step_2'),
      'step3', (select count(distinct session) from e where kind = 'order_step_3'),
      'sent', (select count(distinct session) from e where kind = 'order_sent'),
      'blocks', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (
          select page as what, count(*) as n, count(distinct session) as sessions from e where kind = 'order_block'
           group by page order by count(*) desc limit 10) x)));
end;
$function$;

create or replace function public.admin_analytics(p_days integer) returns json
language plpgsql stable security definer set search_path = public as $function$
declare since timestamptz; r json;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  since := case when coalesce(p_days, 7) <= 1 then date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
                else now() - make_interval(days => least(greatest(p_days, 1), 365)) end;
  with e as (select * from site_all where created_at >= since and visitor not in (select visitor from staff_visitors)),
  ss as (select distinct on (session) session, visitor, coalesce(nullif(source, ''), 'direct') as source, medium, campaign, device, lang, app, page,
                created_at from e where kind = 'view' order by session, created_at),
  st as (select ss.*, exists (select 1 from e x where x.session = ss.session and x.kind = 'order_start') as started,
                exists (select 1 from e x where x.session = ss.session and x.kind = 'order_sent') as sent from ss)
  select json_build_object(
    'since', since,
    'views', (select count(*) from e where kind = 'view'),
    'sessions', (select count(*) from ss),
    'visitors', (select count(distinct visitor) from ss),
    'new_visitors', (select count(distinct visitor) from ss where not exists (select 1 from site_events o where o.visitor = ss.visitor and o.created_at < since)),
    -- (13/11 : visiteurs revenus au moins une 2ᵉ fois pendant la période ; « nouveaux » vaut tout le monde quand la période remonte au début du suivi)
    'back', (select count(*) from (select visitor from ss group by visitor having count(*) > 1) b),
    'started', (select count(distinct session) from e where kind = 'order_start'),
    'sent', (select count(*) from e where kind = 'order_sent'),
    'sent_amount', (select coalesce(sum(amount), 0) from e where kind = 'order_sent'),
    'app', (select count(*) from ss where app),
    'by_day', (select coalesce(json_agg(x order by x.d), '[]'::json) from (
        select to_char(created_at at time zone 'Asia/Jerusalem', 'YYYY-MM-DD') as d, count(distinct session) as sessions,
               count(*) filter (where kind = 'order_sent') as sent from e group by 1) x),
    'by_hour', (select coalesce(json_agg(x order by x.h), '[]'::json) from (
        select extract(hour from created_at at time zone 'Asia/Jerusalem')::int as h, count(*) as sessions from ss group by 1) x),
    'sources', (select coalesce(json_agg(x order by x.sessions desc), '[]'::json) from (
        select source, count(*) as sessions, count(distinct visitor) as visitors, count(*) filter (where started) as started,
               count(*) filter (where sent) as sent from st group by source order by count(*) desc limit 20) x),
    'campaigns', (select coalesce(json_agg(x order by x.sessions desc), '[]'::json) from (
        select campaign, source, count(*) as sessions, count(*) filter (where sent) as sent from st
         where coalesce(campaign, '') <> '' group by campaign, source order by count(*) desc limit 15) x),
    'pages', (select coalesce(json_agg(x order by x.views desc), '[]'::json) from (
        select coalesce(page, '?') as page, count(*) as views from e where kind = 'view' group by 1 order by 2 desc limit 12) x),
    'devices', (select coalesce(json_agg(x order by x.sessions desc), '[]'::json) from (
        select coalesce(device, '?') as device, count(*) as sessions from ss group by 1) x),
    'langs', (select coalesce(json_agg(x order by x.sessions desc), '[]'::json) from (
        select coalesce(lang, '?') as lang, count(*) as sessions from ss group by 1) x),
    'shops', (select coalesce(json_agg(x order by x.views desc), '[]'::json) from (
        select e.shop_code as code, max(s.name) as name, count(*) as views, count(distinct e.session) as sessions
          from e left join shops s on s.code = e.shop_code where e.kind = 'shop_view' and e.shop_code is not null
         group by e.shop_code order by count(*) desc limit 12) x),
    'orders', (select coalesce(json_agg(x order by x.at desc), '[]'::json) from (
        select e.created_at as at, e.order_ref as ref, e.amount, coalesce(nullif(ss.source, ''), 'direct') as source, e.first_source, ss.campaign
          from e left join ss on ss.session = e.session where e.kind = 'order_sent' order by e.created_at desc limit 30) x),
    -- Commandes ouvertes et pas envoyées : une ligne par visite
    'opened', (select coalesce(json_agg(x order by x.at desc), '[]'::json) from (
        select (select min(o.created_at) from e o where o.session = st.session and o.kind = 'order_start') as at,
               (select max(o.created_at) from e o where o.session = st.session) as last_at,
               st.source, st.campaign, st.device, st.lang, st.app,
               (select string_agg(distinct coalesce(sh.name, o.shop_code), ', ') from e o left join shops sh on sh.code = o.shop_code
                 where o.session = st.session and o.kind in ('shop_view', 'cart_add') and o.shop_code is not null) as shops,
               case when exists (select 1 from e o where o.session = st.session and o.kind = 'order_step_3') then 3
                    when exists (select 1 from e o where o.session = st.session and o.kind = 'order_step_2') then 2
                    when exists (select 1 from e o where o.session = st.session and o.kind = 'cart_add') then 1 else 0 end as reached,
               (select o.page from e o where o.session = st.session and o.kind = 'order_block' order by o.created_at desc limit 1) as block,
               (select count(*) from e o where o.session = st.session and o.kind = 'view') as views,
               exists (select 1 from site_events o where o.visitor = st.visitor and o.created_at < st.created_at) as returning,
               (select count(*) from site_events o where o.visitor = st.visitor and o.kind = 'order_sent') as client_orders
          from st where st.started and not st.sent
         order by 1 desc limit 40) x)
  ) into r;
  return r;
end;
$function$;
