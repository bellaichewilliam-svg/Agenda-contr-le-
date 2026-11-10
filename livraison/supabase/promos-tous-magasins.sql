-- ============================================================================
-- « Toutes vos promos réunies » (patron, 10/11/2026) : les promos de TOUS nos magasins au même endroit
-- (Rami Lévy, Carrefour, BOOOM…), pour que les clients ne ratent plus aucune promo.
-- • Carrefour : les vraies promos du site (branch.specials de chaque produit, agence Or Akiva 2996), relues tous les
--   jours : carrefour_specials_fetch() (lots de 100 produits), puis la tâche de nuit range les promos. Coupons exclus.
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

-- Rangement des promos lues (pas de fonction : fait par la tâche de nuit « hop-carrefour-promos-import », 3 h 46,
-- 5 min après « hop-carrefour-promos-fetch ») : une promo relue disparue du site est finie (ends = now()), jamais effacée.
-- Étiquettes du site : « 3 ב-₪9 » (lot 3, total 9), « במבצע! ₪21.90 » (prix promo à l'unité). Coupons exclus.
-- (texte exact de la tâche : select command from cron.job where jobname = 'hop-carrefour-promos-import')
do $cron$ begin
  if not exists (select 1 from cron.job where jobname = 'hop-carrefour-promos-fetch') then
    perform cron.schedule('hop-carrefour-promos-fetch', '41 3 * * *', 'select public.carrefour_specials_fetch()');
  end if;
end $cron$;

-- Toutes les promos, toutes boutiques HOP! confondues, en léger (89 Ko pour 459 promos le 10/11) :
--   { at, shops: [codes], cats: [rubriques], items: [[id, n° boutique, nom « FR · HE », prix payé (lot compris), ancien prix,
--     % remise, nb du lot, n° rubrique, photo raccourcie (r: Rami Lévy, c: Carrefour, b: BOOOM), fin « JJ/MM », 1 = petit prix BOOOM]] }
create or replace function public.promos_all() returns json
language sql stable security definer set search_path = public as $$
  with base as (
    select p.id, s.code, p.name, p.price, p.photo_url, p.description, c.name as cat
      from shop_products p join shops s on s.id = p.shop_id left join shop_categories c on c.id = p.category_id
     where hop_shop(s.id) and s.status = 'actif' and not coalesce(s.paused, false)
       and p.available and p.photo_url is not null and ext_photo_ok(p.photo_url)
  ), rl as (
    select b.*, replace(m[1], ',', '.')::numeric now_p, replace(m[2], ',', '.')::numeric old_p, (regexp_match(coalesce(b.description, ''), '^(\d+) pour '))[1]::int lot,
           (regexp_match(coalesce(b.description, ''), 'jusqu''au (\d\d/\d\d)'))[1] ends
      from base b, regexp_match(coalesce(b.description, ''), '(\d+(?:[.,]\d+)?) ₪ au lieu de (\d+(?:[.,]\d+)?) ₪') m
  ), cf as (
    select b.*, sp.lot, sp.lot_total, sp.regular, sp.ends
      from base b join rayon_items ri on md5('HOPMARKET:' || ri.item_id)::uuid = b.id
      join carrefour_specials sp on sp.item_id = ri.item_id and sp.ends > now()
     where b.code = 'HOPCARREFOUR'
  ), allp as (
    select id, code, name, now_p as p, old_p as o, round((1 - now_p / nullif(old_p, 0)) * 100)::int as f, coalesce(lot, 1) as l, cat, photo_url, ends as e, 0 as b
      from rl where old_p > 0 and now_p < old_p
    union all
    select id, code, name, coalesce(lot_total, price), case when lot_total is not null then round(regular * coalesce(lot, 1), 2) end,
           case when lot_total is not null and regular > 0 and lot_total < regular * coalesce(lot, 1) then round((1 - lot_total / (regular * coalesce(lot, 1))) * 100)::int end,
           coalesce(lot, 1), cat, photo_url, to_char(ends at time zone 'Asia/Jerusalem', 'DD/MM'), 0
      from cf
    union all
    select id, code, name, price, null, null, coalesce((regexp_match(name, '^Lot de (\d+)'))[1]::int, 1), cat, photo_url, null, 1
      from base where code = 'HOPBOOOM'
  ), ok as (select * from allp where coalesce(f, 1) > 0),
  shops as (select array_agg(distinct code order by code) a from ok),
  cats as (select array_agg(distinct coalesce(cat, '') order by coalesce(cat, '')) a from ok)
  select json_build_object('at', now(), 'shops', (select a from shops), 'cats', (select a from cats),
    'items', coalesce(json_agg(json_build_array(ok.id, array_position((select a from shops), ok.code) - 1, ok.name, ok.p, ok.o, ok.f, ok.l,
       array_position((select a from cats), coalesce(ok.cat, '')) - 1,
       regexp_replace(regexp_replace(regexp_replace(ok.photo_url, '^https://img\.rami-levy\.co\.il/product/', 'r:'),
         '^https://d226b0iufwcjmj\.cloudfront\.net/gs1-products/1540/medium/', 'c:'), '^https://booomisrael\.co\.il/uploads/', 'b:'),
       ok.e, ok.b) order by ok.b, coalesce(ok.f, 0) desc), '[]'::json))
    from ok;
$$;
grant execute on function public.promos_all() to anon, authenticated;
