-- ============================================================================
-- « Toutes vos promos réunies » (patron, 10/11/2026) : les promos de TOUS nos magasins au même endroit
-- (Rami Lévy, Carrefour, BOOOM…), pour que les clients ne ratent plus aucune promo.
-- • Carrefour : les vraies promos du site (branch.specials de chaque produit, agence Or Akiva 2996), relues tous les
--   jours : carrefour_specials_fetch() (lots de 100 produits) puis carrefour_specials_import(). Coupons exclus.
-- • Rami Lévy : la description « X ₪ au lieu de Y ₪ » (fichier officiel des promos).
-- • BOOOM : « Promos de la semaine » + « Produits forts » (petits prix BOOOM, sans ancien prix).
-- • promos_all() : tout, en léger (photos par lien), pour la page « Toutes les promos ».
-- ============================================================================
create table if not exists public.carrefour_specials (
  item_id text primary key,               -- 'cf' || id Carrefour (même clé que rayon_items)
  tag_fr text, tag_he text,               -- ex. « 3 Pour ₪12.90 » / « 3 ב-₪12.90 »
  lot int, lot_total numeric,             -- 3 pour 12,90 ₪ → lot 3, total 12,90 (null si promo d'un autre genre)
  regular numeric,                        -- prix normal à l'unité
  starts timestamptz, ends timestamptz,
  updated_at timestamptz not null default now());
alter table public.carrefour_specials enable row level security;
create table if not exists public.carrefour_specials_sync (req bigint primary key, at timestamptz not null default now());
alter table public.carrefour_specials_sync enable row level security;

create or replace function public.carrefour_specials_fetch() returns int
language plpgsql security definer set search_path = public, net as $$
declare ids text; n int := 0; r bigint;
begin
  for ids in
    select string_agg(substr(item_id, 3), ',') from (
      select item_id, (row_number() over (order by item_id) - 1) / 100 as grp from rayon_items where item_id ~ '^cf\d+$') x group by grp
  loop
    r := net.http_get(
      url := 'https://www.carrefour.co.il/v2/retailers/1540/branches/2996/products?appId=4&from=0&size=100&filters=%7B%22must%22%3A%7B%22term%22%3A%7B%22id%22%3A%5B'
             || replace(ids, ',', '%2C') || '%5D%7D%7D%7D',
      headers := jsonb_build_object('User-Agent', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
        'Accept', 'application/json, text/plain, */*', 'Referer', 'https://www.carrefour.co.il/specials', 'Accept-Language', 'he-IL,he;q=0.9'),
      timeout_milliseconds := 30000);
    insert into carrefour_specials_sync (req) values (r) on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Lit les réponses de la dernière heure. Un produit relu sans promo voit sa promo finie (ends = now()), jamais effacée.
create or replace function public.carrefour_specials_import() returns json
language plpgsql security definer set search_path = public, net as $$
declare n_ok int; n_sp int; n_end int;
begin
  create temp table if not exists _cfp (item_id text primary key, regular numeric, sp json) on commit drop;
  truncate _cfp;
  insert into _cfp (item_id, regular, sp)
  select distinct on ('cf' || (p->>'id')) 'cf' || (p->>'id'), (p->'branch'->>'regularPrice')::numeric, p->'branch'->'specials'
    from carrefour_specials_sync s join net._http_response h on h.id = s.req and h.status_code = 200,
         json_array_elements(h.content::json->'products') p
   where s.at > now() - interval '1 hour';
  get diagnostics n_ok = row_count;
  if n_ok = 0 then return json_build_object('error', 'no_response'); end if;
  with sp as (
    select c.item_id, c.regular, x,
           x->'names'->'1'->>'promotionTag' as he, coalesce(x->'names'->'5'->>'promotionTag', x->'names'->'2'->>'promotionTag') as fr,
           row_number() over (partition by c.item_id order by (x->>'endDate')::timestamptz) as rk
      from _cfp c, json_array_elements(case when json_typeof(c.sp) = 'array' then c.sp else '[]'::json end) x
     where not coalesce((x->>'isCoupon')::boolean, false) and not coalesce((x->>'isCouponOnEntireCart')::boolean, false)
       and coalesce((x->>'endDate')::timestamptz, now() + interval '1 day') > now()
       and coalesce((x->>'startDate')::timestamptz, now()) <= now()
       and x->'names'->'1'->>'promotionTag' is not null
  ), up as (
    insert into carrefour_specials as cs (item_id, tag_fr, tag_he, lot, lot_total, regular, starts, ends, updated_at)
    select item_id, fr, he,
           case when he ~ '^\d+\s*ב-?\s*₪?\s*[\d.]+\s*₪?$' then (regexp_match(he, '^(\d+)'))[1]::int
                when he ~ '^₪?\s*[\d.]+\s*₪?$' then 1 end,
           case when he ~ '^\d+\s*ב-?\s*₪?\s*[\d.]+\s*₪?$' then (regexp_match(he, '([\d.]+)\s*₪?$'))[1]::numeric
                when he ~ '^₪?\s*[\d.]+\s*₪?$' then (regexp_match(he, '([\d.]+)'))[1]::numeric end,
           regular, (x->>'startDate')::timestamptz, (x->>'endDate')::timestamptz, now()
      from sp where rk = 1
    on conflict (item_id) do update set tag_fr = excluded.tag_fr, tag_he = excluded.tag_he, lot = excluded.lot, lot_total = excluded.lot_total,
      regular = excluded.regular, starts = excluded.starts, ends = excluded.ends, updated_at = now()
    returning cs.item_id
  )
  select count(*) into n_sp from up;
  update carrefour_specials cs set ends = now(), updated_at = now()
   where cs.ends > now() and cs.updated_at < now() - interval '1 minute' and exists (select 1 from _cfp c where c.item_id = cs.item_id);
  get diagnostics n_end = row_count;
  return json_build_object('produits_lus', n_ok, 'promos', n_sp, 'finies', n_end);
end $$;
revoke all on function public.carrefour_specials_fetch(), public.carrefour_specials_import() from public, anon, authenticated;

-- Toutes les promos, toutes boutiques HOP! confondues (léger : liens de photos, champs courts)
--  i id produit · c code boutique · n nom « FR · HE » · p prix payé (lot compris) · o ancien prix (même quantité) · f % de remise
--  l nombre d'articles du lot · t étiquette du magasin (Carrefour, FR | HE) · k rubrique · ph photo (lien) · e fin de la promo · b petit prix (sans ancien prix)
create or replace function public.promos_all() returns json
language sql stable security definer set search_path = public as $$
  with base as (
    select p.id, s.code, p.name, p.price, p.photo_url, p.description, c.name as cat
      from shop_products p join shops s on s.id = p.shop_id left join shop_categories c on c.id = p.category_id
     where hop_shop(s.id) and s.status = 'actif' and not coalesce(s.paused, false)
       and p.available and p.photo_url is not null and ext_photo_ok(p.photo_url)
  ), rl as (   -- « 3 pour 10 ₪ au lieu de 22,80 ₪ », « 6,50 ₪ au lieu de 19,70 ₪ »
    select b.*, replace(m[1], ',', '.')::numeric now_p, replace(m[2], ',', '.')::numeric old_p, (regexp_match(coalesce(b.description, ''), '^(\d+) pour '))[1]::int lot,
           (regexp_match(coalesce(b.description, ''), 'jusqu''au (\d\d/\d\d)'))[1] ends
      from base b, regexp_match(coalesce(b.description, ''), '(\d+(?:[.,]\d+)?) ₪ au lieu de (\d+(?:[.,]\d+)?) ₪') m
  ), cf as (
    select b.*, sp.tag_fr, sp.tag_he, sp.lot, sp.lot_total, sp.regular, sp.ends
      from base b join rayon_items ri on md5('HOPMARKET:' || ri.item_id)::uuid = b.id
      join carrefour_specials sp on sp.item_id = ri.item_id and sp.ends > now()
     where b.code = 'HOPCARREFOUR'
  ), bo as (
    select b.* from base b where b.code = 'HOPBOOOM'
  ), allp as (
    select id, code, name, now_p as p, old_p as o, round((1 - now_p / nullif(old_p, 0)) * 100)::int as f, coalesce(lot, 1) as l, null::text as t,
           cat, photo_url, ends as e, false as b
      from rl where old_p > 0 and now_p < old_p
    union all
    select id, code, name, coalesce(lot_total, price), case when lot_total is not null then round(regular * lot, 2) end,
           case when lot_total is not null and regular > 0 and lot_total < regular * lot then round((1 - lot_total / (regular * lot)) * 100)::int end,
           coalesce(lot, 1), coalesce(tag_fr, tag_he) || ' | ' || coalesce(tag_he, tag_fr), cat, photo_url, to_char(ends at time zone 'Asia/Jerusalem', 'DD/MM'), false
      from cf
    union all
    select id, code, name, price, null, null, coalesce((regexp_match(name, '^Lot de (\d+)'))[1]::int, 1), null, cat, photo_url, null, true
      from bo
  )
  select json_build_object('at', now(), 'items', coalesce(json_agg(json_build_object('i', id, 'c', code, 'n', name, 'p', p, 'o', o, 'f', f, 'l', l, 't', t, 'k', cat,
           'ph', photo_url, 'e', e, 'b', b) order by b, coalesce(f, 0) desc), '[]'::json))
    from allp where coalesce(f, 1) > 0;
$$;
grant execute on function public.promos_all() to anon, authenticated;

-- Tous les jours (avant l'ouverture) : les promos Carrefour sont relues
do $cron$ begin
  if not exists (select 1 from cron.job where jobname = 'hop-carrefour-promos-fetch') then
    perform cron.schedule('hop-carrefour-promos-fetch', '41 3 * * *', 'select public.carrefour_specials_fetch()');
  end if;
  if not exists (select 1 from cron.job where jobname = 'hop-carrefour-promos-import') then
    perform cron.schedule('hop-carrefour-promos-import', '46 3 * * *', 'select public.carrefour_specials_import()');
  end if;
end $cron$;
